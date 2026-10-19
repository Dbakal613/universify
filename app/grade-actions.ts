"use server";

import type { CourseGradeItems } from "@/lib/types";
import { createClient } from "@/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RemoteGradeItem = {
  id: string;
  clientId: string;
  legacyCourseId: string;
  componentKey: string;
  name: string;
  grade?: number;
  date?: string;
};

type StoredEvaluation = {
  name: string;
  date?: string;
  kind: string;
};

function courseEvaluations(courseData: unknown): StoredEvaluation[] {
  if (!courseData || typeof courseData !== "object" || Array.isArray(courseData)) return [];
  const evaluations = (courseData as { evaluations?: unknown }).evaluations;
  if (!Array.isArray(evaluations)) return [];

  return evaluations.flatMap((evaluation) => {
    if (!evaluation || typeof evaluation !== "object" || Array.isArray(evaluation)) return [];
    const candidate = evaluation as { name?: unknown; date?: unknown; kind?: unknown };
    if (typeof candidate.name !== "string" || typeof candidate.kind !== "string") return [];
    return [{
      name: candidate.name,
      kind: candidate.kind,
      date: typeof candidate.date === "string" ? candidate.date : undefined,
    }];
  });
}

function expectedGradeItems(
  courseName: string,
  courseData: unknown,
  componentName: string
) {
  const normalizedCourse = normalized(courseName);
  const normalizedComponent = normalized(componentName);
  const isStatistics = normalizedCourse.includes("estadistica");
  const isEconomics = normalizedCourse.includes("economia");
  if (!isStatistics && !isEconomics) return [];

  const expectedKind = normalizedComponent.includes("prueba")
    ? "prueba"
    : normalizedComponent.includes("control")
      ? "control"
      : null;
  if (!expectedKind || (isEconomics && expectedKind !== "control")) return [];

  return courseEvaluations(courseData).filter(
    (evaluation) => evaluation.kind === expectedKind
  );
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");
}

function legacyItemCandidates(
  componentName: string,
  values: Record<string, string>
) {
  const base = normalized(componentName)
    .replace(/(es|s)$/i, "")
    .replace(/[^a-z0-9]/g, "");
  return Object.entries(values).flatMap(([name, value]) => {
    const grade = value.trim() === "" ? undefined : Number(value);
    const candidate = normalized(name).replace(/[^a-z0-9]/g, "");
    return candidate !== normalized(componentName).replace(/[^a-z0-9]/g, "") &&
      candidate.startsWith(base) && grade !== undefined &&
      Number.isFinite(grade) && grade >= 1 && grade <= 7
      ? [{ name, grade }]
      : [];
  });
}

async function context() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  return error || !userId ? null : { supabase, userId };
}

export async function loadMyGradeItems(
  legacyGrades: Record<string, Record<string, string>>,
  cachedItems: Record<string, CourseGradeItems>
) {
  const auth = await context();
  if (!auth) return { success: false as const, error: "Debes iniciar sesión." };

  const { data: courses, error: coursesError } = await auth.supabase
    .from("courses")
    .select("id, legacy_id, name, course_data");
  if (coursesError) return { success: false as const, error: "No fue posible cargar tus notas." };
  const courseById = new Map((courses ?? []).map((course) => [course.id, course]));
  if ((courses ?? []).length === 0) {
    return { success: true as const, items: [] as RemoteGradeItem[] };
  }

  const { data: components, error: componentsError } = await auth.supabase
    .from("grade_components")
    .select("id, course_id, legacy_key, name, component_kind")
    .in("course_id", (courses ?? []).map((course) => course.id));
  if (componentsError) return { success: false as const, error: "No fue posible cargar tus notas." };

  const componentById = new Map((components ?? []).map((component) => [component.id, component]));
  let { data: entries, error: entriesError } = await auth.supabase
    .from("grade_entries")
    .select("id, client_id, course_id, grade_component_id, label, grade, evaluation_date")
    .order("position", { ascending: true });
  if (entriesError) return { success: false as const, error: "No fue posible cargar tus notas." };

  const populatedComponents = new Set((entries ?? []).map((entry) => entry.grade_component_id));
  const inserts: Record<string, unknown>[] = [];
  for (const [position, component] of (components ?? []).entries()) {
    if (populatedComponents.has(component.id)) continue;
    const course = courseById.get(component.course_id);
    if (!course) continue;
    const cached = cachedItems?.[course.legacy_id]?.[component.legacy_key] ?? [];
    if (cached.length > 0) {
      cached.forEach((item, itemPosition) => inserts.push({
        user_id: auth.userId,
        course_id: course.id,
        grade_component_id: component.id,
        client_id: uuidPattern.test(item.id) ? item.id : crypto.randomUUID(),
        label: item.name,
        grade: item.grade ?? null,
        evaluation_date: item.date ?? null,
        position: itemPosition,
      }));
      continue;
    }

    const legacyValue = legacyGrades?.[course.legacy_id]?.[component.name];
    const legacyChildren = component.component_kind === "grouped"
      ? legacyItemCandidates(component.name, legacyGrades?.[course.legacy_id] ?? {})
      : [];
    if (legacyChildren.length > 0) {
      legacyChildren.forEach((item, itemPosition) => inserts.push({
        user_id: auth.userId,
        course_id: course.id,
        grade_component_id: component.id,
        client_id: crypto.randomUUID(),
        label: item.name,
        grade: item.grade,
        position: itemPosition,
      }));
      continue;
    }
    const expectedItems = component.component_kind === "grouped"
      ? expectedGradeItems(course.name, course.course_data, component.name)
      : [];
    if (expectedItems.length > 0) {
      expectedItems.forEach((item, itemPosition) => inserts.push({
        user_id: auth.userId,
        course_id: course.id,
        grade_component_id: component.id,
        client_id: crypto.randomUUID(),
        label: item.name,
        grade: null,
        evaluation_date: item.date ?? null,
        position: itemPosition,
      }));
      continue;
    }
    const parsed = legacyValue === undefined || legacyValue.trim() === "" ? undefined : Number(legacyValue);
    if (parsed === undefined || !Number.isFinite(parsed) || parsed < 1 || parsed > 7) continue;
    inserts.push({
      user_id: auth.userId,
      course_id: course.id,
      grade_component_id: component.id,
      client_id: crypto.randomUUID(),
      label: component.component_kind === "grouped" ? `${component.name} 1` : component.name,
      grade: parsed,
      position,
    });
  }

  if (inserts.length > 0) {
    const inserted = await auth.supabase.from("grade_entries").insert(inserts);
    if (inserted.error) {
      console.error("No fue posible migrar las notas locales:", inserted.error);
      return { success: false as const, error: "No fue posible migrar tus notas guardadas." };
    }
    const refreshed = await auth.supabase
      .from("grade_entries")
      .select("id, client_id, course_id, grade_component_id, label, grade, evaluation_date")
      .order("position", { ascending: true });
    entries = refreshed.data;
    entriesError = refreshed.error;
    if (entriesError) return { success: false as const, error: "No fue posible cargar tus notas." };
  }

  const items: RemoteGradeItem[] = (entries ?? []).flatMap((entry) => {
    const course = courseById.get(entry.course_id);
    const component = entry.grade_component_id ? componentById.get(entry.grade_component_id) : undefined;
    if (!course || !component) return [];
    return [{
      id: entry.id,
      clientId: entry.client_id,
      legacyCourseId: course.legacy_id,
      componentKey: component.legacy_key,
      name: entry.label,
      grade: entry.grade === null ? undefined : Number(entry.grade),
      date: entry.evaluation_date ?? undefined,
    }];
  });
  return { success: true as const, items };
}

export async function saveGradeItem(input: {
  courseId: string;
  componentId: string;
  clientId: string;
  name: string;
  grade?: number;
  date?: string;
  position: number;
}) {
  const auth = await context();
  if (!auth) return { success: false as const, error: "Debes iniciar sesión." };
  if (!uuidPattern.test(input.courseId) || !uuidPattern.test(input.componentId) ||
      !uuidPattern.test(input.clientId) || !input.name.trim() ||
      (input.grade !== undefined && (!Number.isFinite(input.grade) || input.grade < 1 || input.grade > 7))) {
    return { success: false as const, error: "Revisa los datos de la nota." };
  }

  const { data: component, error: componentError } = await auth.supabase
    .from("grade_components")
    .select("id")
    .eq("id", input.componentId)
    .eq("course_id", input.courseId)
    .maybeSingle();
  if (componentError || !component) return { success: false as const, error: "No encontramos esta categoría." };

  const { data, error } = await auth.supabase
    .from("grade_entries")
    .upsert({
      user_id: auth.userId,
      course_id: input.courseId,
      grade_component_id: input.componentId,
      client_id: input.clientId,
      label: input.name.trim(),
      grade: input.grade ?? null,
      evaluation_date: input.date || null,
      position: input.position,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,grade_component_id,client_id" })
    .select("id")
    .single();
  if (error || !data) {
    console.error("No fue posible guardar la nota:", error);
    return { success: false as const, error: "No fue posible guardar la nota." };
  }
  return { success: true as const, id: data.id };
}

export async function deleteGradeItem(input: { courseId: string; componentId: string; clientId: string }) {
  const auth = await context();
  if (!auth) return { success: false as const, error: "Debes iniciar sesión." };
  if (!uuidPattern.test(input.courseId) || !uuidPattern.test(input.componentId) || !uuidPattern.test(input.clientId)) {
    return { success: false as const, error: "La nota no es válida." };
  }
  const { error } = await auth.supabase
    .from("grade_entries")
    .delete()
    .eq("user_id", auth.userId)
    .eq("course_id", input.courseId)
    .eq("grade_component_id", input.componentId)
    .eq("client_id", input.clientId);
  return error
    ? { success: false as const, error: "No fue posible eliminar la nota." }
    : { success: true as const };
}
