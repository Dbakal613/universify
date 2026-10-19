import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  courseWithCanonicalSessions,
  generateScheduledSessions,
  GENERATED_SCHEDULE_NOTE,
  normalizeClassSessions,
} from "@/lib/class-sessions";
import {
  loadCourseSessionRows,
  sessionRowToClassSession,
  syncCanonicalCourseSessions,
} from "@/lib/attendance/server";
import type { Course, SemesterSettings } from "@/lib/types";
import { gradeComponentKey, gradeComponentKind } from "@/lib/grades";
import { dateInTimeZone } from "@/lib/date";
import { createClient } from "@/supabase/server";

type CourseIdMapping = {
  legacyId: string;
  courseId: string;
};

type ActiveSemester = {
  id: string;
  settings: SemesterSettings;
};

type CourseRow = {
  id: string;
  legacy_id: string;
  name: string;
  professor_name: string | null;
  professor_email: string | null;
  autonomous_hours: number | null;
  total_classes: number | null;
  attendance_required_percentage: number | null;
  attendance_rules: string | null;
  color_key: string | null;
  course_data: unknown;
};

export type LoadMyCoursesResult =
  | {
      success: true;
      state: "ready";
      semester: ActiveSemester;
      courses: Course[];
      mappings: CourseIdMapping[];
    }
  | {
      success: true;
      state: "needs_onboarding";
      semester: null;
      courses: [];
      mappings: [];
    }
  | { success: false; error: string };

export type SaveMyCoursesResult =
  | {
      success: true;
      courses: CourseIdMapping[];
      components: { legacyId: string; key: string; componentId: string }[];
    }
  | { success: false; error: string };

function isCourse(value: unknown): value is Course {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const course = value as Partial<Course>;
  return (
    typeof course.id === "string" &&
    course.id.trim().length > 0 &&
    typeof course.name === "string" &&
    course.name.trim().length > 0 &&
    typeof course.professor === "string" &&
    typeof course.email === "string" &&
    typeof course.autonomousHours === "number" &&
    Number.isFinite(course.autonomousHours) &&
    typeof course.totalClasses === "number" &&
    Number.isInteger(course.totalClasses) &&
    (course.attendanceRequired === undefined ||
      (typeof course.attendanceRequired === "number" &&
        Number.isFinite(course.attendanceRequired))) &&
    (course.attendanceNote === undefined ||
      typeof course.attendanceNote === "string") &&
    typeof course.color === "string" &&
    Array.isArray(course.classes) &&
    Array.isArray(course.classSessions) &&
    Array.isArray(course.evaluations) &&
    Array.isArray(course.gradeComponents) &&
    Array.isArray(course.autonomousTasks)
  );
}

function validatedCourses(courses: Course[]) {
  if (!Array.isArray(courses) || courses.some((course) => !isCourse(course))) {
    return null;
  }

  const ids = courses.map((course) => course.id.trim());
  return new Set(ids).size === ids.length ? courses : null;
}

function courseValues(semesterId: string, course: Course) {
  const canonical = courseWithCanonicalSessions(course, course.classSessions);
  return {
    semester_id: semesterId,
    legacy_id: course.id.trim(),
    name: course.name.trim(),
    professor_name: course.professor.trim() || null,
    professor_email: course.email.trim() || null,
    autonomous_hours: course.autonomousHours,
    total_classes: canonical.totalClasses,
    attendance_required_percentage: course.attendanceRequired ?? null,
    attendance_rules: course.attendanceNote?.trim() || null,
    color_key: course.color,
    course_data: canonical,
    updated_at: new Date().toISOString(),
  };
}

function rowToCourse(row: CourseRow): Course {
  if (isCourse(row.course_data)) {
    return { ...row.course_data, id: row.legacy_id, remoteId: row.id };
  }

  return {
    id: row.legacy_id,
    remoteId: row.id,
    name: row.name,
    professor: row.professor_name ?? "",
    email: row.professor_email ?? "",
    autonomousHours: Number(row.autonomous_hours ?? 0),
    totalClasses: row.total_classes ?? 0,
    attendanceRequired:
      row.attendance_required_percentage === null
        ? undefined
        : Number(row.attendance_required_percentage),
    attendanceNote: row.attendance_rules ?? undefined,
    color: row.color_key ?? "bg-blue-100",
    classes: [],
    classSessions: [],
    evaluations: [],
    gradeComponents: [],
    autonomousTasks: [],
  };
}

async function authenticatedActiveSemester() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (claimsError || !userId) {
    return { success: false as const, error: "Debes iniciar sesión para cargar tus ramos." };
  }

  const { data: semester, error: semesterError } = await supabase
    .from("semesters")
    .select("id, name, year, term, start_date, end_date, timezone, location_name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (semesterError) {
    console.error("No fue posible cargar el semestre activo:", semesterError);
    return { success: false as const, error: "No fue posible cargar tu semestre." };
  }

  if (!semester) {
    return { success: true as const, state: "needs_onboarding" as const };
  }

  return { success: true as const, state: "ready" as const, supabase, semester };
}

const courseSelection =
  "id, legacy_id, name, professor_name, professor_email, autonomous_hours, total_classes, attendance_required_percentage, attendance_rules, color_key, course_data";

async function syncGradeComponents(supabase: SupabaseClient, course: Course) {
  if (!course.remoteId) return { success: true as const };
  const { data: existing, error } = await supabase
    .from("grade_components")
    .select("id, name, component_type")
    .eq("course_id", course.remoteId);
  if (error) return { success: false as const, error };
  const existingByKey = new Map(
    (existing ?? []).map((row) => {
      const encoded = row.component_type?.match(/^universify:([^:]+):(individual|grouped)$/);
      return [encoded?.[1] ?? gradeComponentKey({ name: row.name, weight: 0 }), row.id];
    })
  );

  for (const component of course.gradeComponents) {
    const legacyKey = gradeComponentKey(component);
    const values = {
      course_id: course.remoteId,
      name: component.name.trim(),
      weight: component.weight,
      component_type: `universify:${legacyKey}:${gradeComponentKind(component)}`,
      is_expandable: gradeComponentKind(component) === "grouped",
    };
    const existingId = existingByKey.get(legacyKey);
    const mutation = existingId
      ? supabase.from("grade_components").update(values).eq("id", existingId).eq("course_id", course.remoteId)
      : supabase.from("grade_components").insert(values);
    const { error: mutationError } = await mutation;
    if (mutationError) return { success: false as const, error: mutationError };
  }
  return { success: true as const };
}

async function loadGradeComponents(supabase: SupabaseClient, courseIds: string[]) {
  if (courseIds.length === 0) return { data: [], error: null };
  return supabase
    .from("grade_components")
    .select("id, course_id, name, weight, component_type, is_expandable")
    .in("course_id", courseIds)
    .order("created_at", { ascending: true });
}

export async function loadAuthenticatedCourses(
  localCourses: Course[]
): Promise<LoadMyCoursesResult> {
  const context = await authenticatedActiveSemester();
  if (!context.success) return context;
  if (context.state === "needs_onboarding") {
    return {
      success: true,
      state: "needs_onboarding",
      semester: null,
      courses: [],
      mappings: [],
    };
  }

  const safeLocalCourses = validatedCourses(localCourses) ?? [];
  const { supabase, semester } = context;
  let { data: remoteRows, error: coursesError } = await supabase
    .from("courses")
    .select(courseSelection)
    .eq("semester_id", semester.id)
    .order("created_at", { ascending: true });

  if (coursesError) {
    console.error("No fue posible cargar los ramos:", coursesError);
    return { success: false, error: "No fue posible cargar tus ramos." };
  }

  const rows = (remoteRows ?? []) as CourseRow[];
  const localById = new Map(safeLocalCourses.map((course) => [course.id, course]));
  const coursesToMigrate =
    rows.length === 0
      ? safeLocalCourses
      : rows
          .filter((row) => !isCourse(row.course_data))
          .map((row) => localById.get(row.legacy_id))
          .filter((course): course is Course => Boolean(course));

  if (coursesToMigrate.length > 0) {
    const { error: migrationError } = await supabase.from("courses").upsert(
      coursesToMigrate.map((course) => courseValues(semester.id, course)),
      { onConflict: "semester_id,legacy_id" }
    );

    if (migrationError) {
      console.error("No fue posible migrar los ramos locales:", migrationError);
      return {
        success: false,
        error: "No fue posible sincronizar tus ramos guardados.",
      };
    }

    const refreshed = await supabase
      .from("courses")
      .select(courseSelection)
      .eq("semester_id", semester.id)
      .order("created_at", { ascending: true });

    remoteRows = refreshed.data;
    coursesError = refreshed.error;

    if (coursesError) {
      console.error("No fue posible recargar los ramos migrados:", coursesError);
      return { success: false, error: "No fue posible cargar tus ramos." };
    }
  }

  const finalRows = (remoteRows ?? []) as CourseRow[];
  const coursesWithFallback = finalRows.map((row) => {
    const course = rowToCourse(row);
    if (course.classSessions.length > 0 || course.classes.length === 0) return course;

    return courseWithCanonicalSessions(
      course,
      generateScheduledSessions(
        course.classes,
        semester.start_date,
        semester.end_date
      )
    );
  });

  for (const course of coursesWithFallback) {
    if (!course.remoteId || course.classSessions.length === 0) continue;
    const syncResult = await syncCanonicalCourseSessions(
      supabase,
      course.remoteId,
      course.classSessions
    );
    if (!syncResult.success) {
      console.error("No fue posible sincronizar las sesiones canónicas:", syncResult.error);
      return { success: false, error: "No fue posible cargar las sesiones de tus ramos." };
    }
  }

  const sessionResult = await loadCourseSessionRows(
    supabase,
    finalRows.map((row) => row.id)
  );
  if (sessionResult.error) {
    console.error("No fue posible cargar las sesiones canónicas:", sessionResult.error);
    return { success: false, error: "No fue posible cargar las sesiones de tus ramos." };
  }

  const sessionsByCourse = new Map<string, ReturnType<typeof sessionRowToClassSession>[]>();
  for (const row of sessionResult.data) {
    const sessions = sessionsByCourse.get(row.course_id) ?? [];
    sessions.push(sessionRowToClassSession(row));
    sessionsByCourse.set(row.course_id, sessions);
  }

  let canonicalCourses = coursesWithFallback.map((course) =>
    courseWithCanonicalSessions(
      course,
      course.remoteId ? sessionsByCourse.get(course.remoteId) ?? [] : []
    )
  );

  for (const course of canonicalCourses) {
    const result = await syncGradeComponents(supabase, course);
    if (!result.success) {
      console.error("No fue posible sincronizar las categorías de notas:", result.error);
      return { success: false, error: "No fue posible cargar las categorías de notas." };
    }
  }
  const gradeComponentsResult = await loadGradeComponents(
    supabase,
    finalRows.map((row) => row.id)
  );
  if (gradeComponentsResult.error) {
    console.error("No fue posible cargar las categorías de notas:", gradeComponentsResult.error);
    return { success: false, error: "No fue posible cargar las categorías de notas." };
  }
  const componentsByCourse = new Map<string, Course["gradeComponents"]>();
  for (const row of gradeComponentsResult.data ?? []) {
    const encoded = row.component_type?.match(/^universify:([^:]+):(individual|grouped)$/);
    const components = componentsByCourse.get(row.course_id) ?? [];
    components.push({
      id: row.id,
      key: encoded?.[1] ?? gradeComponentKey({ name: row.name, weight: Number(row.weight ?? 0) }),
      name: row.name,
      weight: Number(row.weight ?? 0),
      kind: encoded?.[2] === "grouped" || row.is_expandable ? "grouped" : "individual",
    });
    componentsByCourse.set(row.course_id, components);
  }
  canonicalCourses = canonicalCourses.map((course) => ({
    ...course,
    gradeComponents: course.remoteId
      ? componentsByCourse.get(course.remoteId) ?? course.gradeComponents
      : course.gradeComponents,
  }));

  for (const course of canonicalCourses) {
    if (!course.remoteId || course.classSessions.length === 0) continue;
    const { error } = await supabase
      .from("courses")
      .update({
        total_classes: course.totalClasses,
        course_data: course,
        updated_at: new Date().toISOString(),
      })
      .eq("id", course.remoteId)
      .eq("semester_id", semester.id);
    if (error) {
      console.error("No fue posible actualizar el total canónico del ramo:", error);
      return { success: false, error: "No fue posible actualizar las sesiones de tus ramos." };
    }
  }

  return {
    success: true,
    state: "ready",
    semester: {
      id: semester.id,
      settings: {
        name: semester.name,
        year: semester.year,
        term: semester.term,
        startDate: semester.start_date,
        endDate: semester.end_date,
        timezone: semester.timezone,
        locationName: semester.location_name,
      },
    },
    courses: canonicalCourses,
    mappings: finalRows.map((row) => ({
      legacyId: row.legacy_id,
      courseId: row.id,
    })),
  };
}

export async function saveAuthenticatedCourses(
  courses: Course[]
): Promise<SaveMyCoursesResult> {
  const safeCourses = validatedCourses(courses);
  if (!safeCourses || safeCourses.length === 0) {
    return { success: false, error: "Los datos de los ramos no tienen un formato válido." };
  }

  const context = await authenticatedActiveSemester();
  if (!context.success) return context;
  if (context.state === "needs_onboarding") {
    return {
      success: false,
      error: "Configura tu semestre antes de guardar ramos.",
    };
  }

  const { data, error } = await context.supabase
    .from("courses")
    .upsert(
      safeCourses.map((course) => courseValues(context.semester.id, course)),
      { onConflict: "semester_id,legacy_id" }
    )
    .select("id, legacy_id");

  if (error || !data) {
    console.error("No fue posible guardar los ramos:", error);
    return { success: false, error: "No fue posible guardar los ramos." };
  }

  const remoteIdByLegacyId = new Map(
    data.map((course) => [course.legacy_id, course.id])
  );
  for (const course of safeCourses) {
    const remoteId = remoteIdByLegacyId.get(course.id);
    if (!remoteId) continue;
    const today = dateInTimeZone(context.semester.timezone ?? "America/Santiago");
    const existingSessions = normalizeClassSessions(course.classSessions);
    const hasGeneratedSchedule = existingSessions.some(
      (session) => session.note === GENERATED_SCHEDULE_NOTE
    );
    const sessions = hasGeneratedSchedule
      ? normalizeClassSessions([
          ...existingSessions.filter(
            (session) => session.note !== GENERATED_SCHEDULE_NOTE || session.date < today
          ),
          ...generateScheduledSessions(
            course.classes,
            context.semester.start_date,
            context.semester.end_date
          ).filter((session) => session.date >= today),
        ])
      : existingSessions;
    if (sessions.length > 0) {
      const syncResult = await syncCanonicalCourseSessions(
        context.supabase,
        remoteId,
        sessions,
        hasGeneratedSchedule ? { retireGeneratedAfter: today } : undefined
      );
      if (!syncResult.success) {
        console.error("No fue posible guardar las sesiones del ramo:", syncResult.error);
        return { success: false, error: "No fue posible guardar las sesiones del ramo." };
      }
    }

    const canonical = courseWithCanonicalSessions(
      { ...course, remoteId },
      sessions
    );
    const gradeResult = await syncGradeComponents(context.supabase, canonical);
    if (!gradeResult.success) {
      console.error("No fue posible guardar las categorías de notas:", gradeResult.error);
      return { success: false, error: "No fue posible guardar las categorías de notas." };
    }
    const { error: canonicalError } = await context.supabase
      .from("courses")
      .update({
        total_classes: canonical.totalClasses,
        course_data: canonical,
        updated_at: new Date().toISOString(),
      })
      .eq("id", remoteId)
      .eq("semester_id", context.semester.id);
    if (canonicalError) {
      console.error("No fue posible guardar el total canónico:", canonicalError);
      return { success: false, error: "No fue posible guardar el total de clases." };
    }
  }

  const savedComponents = await loadGradeComponents(
    context.supabase,
    data.map((course) => course.id)
  );
  if (savedComponents.error) {
    console.error("No fue posible recargar las categorías guardadas:", savedComponents.error);
    return { success: false, error: "No fue posible cargar las categorías guardadas." };
  }
  const legacyIdByRemoteId = new Map(
    data.map((course) => [course.id, course.legacy_id])
  );

  return {
    success: true,
    courses: data.map((course) => ({
      legacyId: course.legacy_id,
      courseId: course.id,
    })),
    components: (savedComponents.data ?? []).flatMap((component) => {
      const legacyId = legacyIdByRemoteId.get(component.course_id);
      return legacyId
        ? [{
            legacyId,
            key: component.component_type?.match(/^universify:([^:]+):/)?.[1]
              ?? gradeComponentKey({ name: component.name, weight: Number(component.weight ?? 0) }),
            componentId: component.id,
          }]
        : [];
    }),
  };
}

export async function deleteAuthenticatedCourse(legacyId: string) {
  if (typeof legacyId !== "string" || legacyId.trim().length === 0) {
    return { success: false as const, error: "El ramo no es válido." };
  }

  const context = await authenticatedActiveSemester();
  if (!context.success) return context;
  if (context.state === "needs_onboarding") {
    return {
      success: false as const,
      error: "Configura tu semestre antes de eliminar ramos.",
    };
  }

  const { error } = await context.supabase
    .from("courses")
    .delete()
    .eq("semester_id", context.semester.id)
    .eq("legacy_id", legacyId.trim());

  if (error) {
    console.error("No fue posible eliminar el ramo:", error);
    return { success: false as const, error: "No fue posible eliminar el ramo." };
  }

  return { success: true as const };
}
