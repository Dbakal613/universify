"use server";

import {
  loadCourseSessionRows,
  sessionRowToClassSession,
  syncCanonicalCourseSessions,
} from "@/lib/attendance/server";
import { classSessionIdentity, normalizeSessionTime } from "@/lib/class-sessions";
import type { AttendanceRecord, ClassSession } from "@/lib/types";
import { createClient } from "@/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SessionAttendanceStatus = "attended" | "absent" | "justified";

export type RemoteClassSession = ClassSession & {
  id: string;
  courseId: string;
};

export type RemoteAttendanceRecord = {
  legacyCourseId: string;
  courseId: string;
  sessionId: string;
  date: string;
  start?: string;
  status: SessionAttendanceStatus;
};

type ActionError = { success: false; error: string };

async function authenticatedContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return null;
  return { supabase, userId };
}

async function ownedCourse(
  context: NonNullable<Awaited<ReturnType<typeof authenticatedContext>>>,
  courseId: string
) {
  if (!uuidPattern.test(courseId)) return null;
  const { data, error } = await context.supabase
    .from("courses")
    .select("id, legacy_id")
    .eq("id", courseId)
    .maybeSingle();
  return error ? null : data;
}

export async function getCourseClassSessions(
  courseId: string
): Promise<{ success: true; sessions: RemoteClassSession[] } | ActionError> {
  const context = await authenticatedContext();
  if (!context) return { success: false, error: "Debes iniciar sesión." };
  if (!(await ownedCourse(context, courseId))) {
    return { success: false, error: "No encontramos este ramo." };
  }

  const result = await loadCourseSessionRows(context.supabase, [courseId]);
  if (result.error) {
    console.error("No fue posible cargar las sesiones de clase:", result.error);
    return { success: false, error: "No fue posible cargar las sesiones." };
  }

  return {
    success: true,
    sessions: result.data.map((row) => ({
      ...sessionRowToClassSession(row),
      id: row.id,
      courseId: row.course_id,
    })),
  };
}

export async function syncCourseClassSessions(
  courseId: string,
  sessions: ClassSession[]
): Promise<{ success: true; sessions: RemoteClassSession[] } | ActionError> {
  const context = await authenticatedContext();
  if (!context) return { success: false, error: "Debes iniciar sesión." };
  if (!(await ownedCourse(context, courseId))) {
    return { success: false, error: "No encontramos este ramo." };
  }

  const result = await syncCanonicalCourseSessions(context.supabase, courseId, sessions);
  if (!result.success) {
    console.error("No fue posible sincronizar las sesiones:", result.error);
    return { success: false, error: "No fue posible sincronizar las sesiones." };
  }
  return getCourseClassSessions(courseId);
}

async function persistAttendance(
  context: NonNullable<Awaited<ReturnType<typeof authenticatedContext>>>,
  values: {
    course_id: string;
    user_id: string;
    course_class_session_id: string;
    class_date: string;
    status: SessionAttendanceStatus;
    updated_at: string;
  },
  overwrite: boolean
) {
  if (!overwrite) {
    const { data: existing, error } = await context.supabase
      .from("attendance_records")
      .select("id")
      .eq("user_id", context.userId)
      .eq("course_class_session_id", values.course_class_session_id)
      .maybeSingle();
    if (error || existing) return error;
  }

  const upsert = await context.supabase
    .from("attendance_records")
    .upsert(values, { onConflict: "user_id,course_class_session_id" });
  if (!upsert.error || upsert.error.code !== "42P10") return upsert.error;

  const updated = await context.supabase
    .from("attendance_records")
    .update(values)
    .eq("user_id", context.userId)
    .eq("course_class_session_id", values.course_class_session_id)
    .select("id");
  if (updated.error || (updated.data?.length ?? 0) > 0) return updated.error;

  const inserted = await context.supabase.from("attendance_records").insert(values);
  if (inserted.error?.code !== "23505") return inserted.error;

  const retried = await context.supabase
    .from("attendance_records")
    .update(values)
    .eq("user_id", context.userId)
    .eq("course_class_session_id", values.course_class_session_id);
  return retried.error;
}

export async function loadMyAttendance(
  localAttendance: Record<string, AttendanceRecord>
): Promise<{ success: true; records: RemoteAttendanceRecord[] } | ActionError> {
  const context = await authenticatedContext();
  if (!context) return { success: false, error: "Debes iniciar sesión." };

  const { data: courses, error: coursesError } = await context.supabase
    .from("courses")
    .select("id, legacy_id");
  if (coursesError) {
    console.error("No fue posible cargar los ramos para asistencia:", coursesError);
    return { success: false, error: "No fue posible cargar tu asistencia." };
  }

  const courseIds = (courses ?? []).map((course) => course.id);
  const sessionsResult = await loadCourseSessionRows(context.supabase, courseIds);
  if (sessionsResult.error) {
    console.error("No fue posible cargar las sesiones para asistencia:", sessionsResult.error);
    return { success: false, error: "No fue posible cargar tu asistencia." };
  }

  const courseById = new Map((courses ?? []).map((course) => [course.id, course]));
  const sessionByCourseAndIdentity = new Map<string, (typeof sessionsResult.data)[number]>();
  for (const session of sessionsResult.data) {
    sessionByCourseAndIdentity.set(
      `${session.course_id}|${classSessionIdentity({
        date: session.session_date,
        start: normalizeSessionTime(session.start_time),
      })}`,
      session
    );
  }

  if (localAttendance && typeof localAttendance === "object") {
    for (const course of courses ?? []) {
      const localSessions = localAttendance[course.legacy_id]?.sessions ?? [];
      for (const local of localSessions) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(local.date)) continue;
        if (!(local.status === "attended" || local.status === "absent" || local.status === "justified")) continue;
        const session = sessionByCourseAndIdentity.get(
          `${course.id}|${classSessionIdentity(local)}`
        ) ?? (local.start
          ? undefined
          : sessionsResult.data.filter(
              (candidate) => candidate.course_id === course.id && candidate.session_date === local.date
            ).length === 1
            ? sessionsResult.data.find(
                (candidate) => candidate.course_id === course.id && candidate.session_date === local.date
              )
            : undefined);
        if (!session || session.status === "cancelled") continue;
        const error = await persistAttendance(
          context,
          {
            course_id: course.id,
            user_id: context.userId,
            course_class_session_id: session.id,
            class_date: session.session_date,
            status: local.status,
            updated_at: new Date().toISOString(),
          },
          false
        );
        if (error) {
          console.error("No fue posible migrar una asistencia local:", error);
          return { success: false, error: "No fue posible sincronizar tu asistencia guardada." };
        }
      }
    }
  }

  const { data: records, error } = await context.supabase
    .from("attendance_records")
    .select("course_id, course_class_session_id, class_date, status")
    .not("course_class_session_id", "is", null);
  if (error) {
    console.error("No fue posible cargar la asistencia:", error);
    return { success: false, error: "No fue posible cargar tu asistencia." };
  }

  return {
    success: true,
    records: (records ?? []).flatMap((record) => {
      const course = courseById.get(record.course_id);
      const session = sessionsResult.data.find(
        (item) => item.id === record.course_class_session_id
      );
      if (!course || !session || !record.course_class_session_id) return [];
      const status = record.status === "present" ? "attended" : record.status;
      if (!(status === "attended" || status === "absent" || status === "justified")) return [];
      return [{
        legacyCourseId: course.legacy_id,
        courseId: course.id,
        sessionId: record.course_class_session_id,
        date: record.class_date,
        start: normalizeSessionTime(session.start_time),
        status,
      }];
    }),
  };
}

export async function setSessionAttendance(input: {
  courseId: string;
  sessionId: string;
  status: SessionAttendanceStatus;
}): Promise<{ success: true } | ActionError> {
  const context = await authenticatedContext();
  if (!context) return { success: false, error: "Debes iniciar sesión." };
  if (!uuidPattern.test(input.courseId) || !uuidPattern.test(input.sessionId) ||
      !(input.status === "attended" || input.status === "absent" || input.status === "justified")) {
    return { success: false, error: "La asistencia no es válida." };
  }
  if (!(await ownedCourse(context, input.courseId))) {
    return { success: false, error: "No encontramos este ramo." };
  }

  const { data: session, error: sessionError } = await context.supabase
    .from("course_class_sessions")
    .select("id, course_id, session_date, status")
    .eq("id", input.sessionId)
    .eq("course_id", input.courseId)
    .maybeSingle();
  if (sessionError || !session) return { success: false, error: "No encontramos esta sesión de clase." };
  if (session.status === "cancelled") return { success: false, error: "No se registra asistencia en una clase cancelada." };

  const error = await persistAttendance(context, {
    course_id: input.courseId,
    user_id: context.userId,
    course_class_session_id: session.id,
    class_date: session.session_date,
    status: input.status,
    updated_at: new Date().toISOString(),
  }, true);
  if (error) {
    console.error("No fue posible guardar la asistencia:", error);
    return { success: false, error: "No fue posible guardar la asistencia." };
  }
  return { success: true };
}

export async function clearSessionAttendance(input: { courseId: string; sessionId: string }) {
  const context = await authenticatedContext();
  if (!context) return { success: false as const, error: "Debes iniciar sesión." };
  if (!uuidPattern.test(input.courseId) || !uuidPattern.test(input.sessionId) ||
      !(await ownedCourse(context, input.courseId))) {
    return { success: false as const, error: "La sesión no es válida." };
  }
  const { error } = await context.supabase
    .from("attendance_records")
    .delete()
    .eq("user_id", context.userId)
    .eq("course_id", input.courseId)
    .eq("course_class_session_id", input.sessionId);
  return error
    ? { success: false as const, error: "No fue posible revertir la asistencia." }
    : { success: true as const };
}
