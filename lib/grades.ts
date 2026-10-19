import type { Course, CourseGradeItems, GradeComponent, GradeItem } from "./types";

export function gradeComponentKey(component: GradeComponent) {
  if (component.key) return component.key;
  return component.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "categoria";
}

export function gradeComponentKind(component: GradeComponent) {
  if (component.kind) return component.kind;
  if (component.expandable) return "grouped" as const;
  const name = component.name.toLocaleLowerCase("es-CL");
  return /control|tarea|trabajo|quiz|laboratorio|actividad|ejercicio|prueba/.test(name)
    ? "grouped" as const
    : "individual" as const;
}

export function isValidGrade(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 7;
}

export function componentGrade(items: GradeItem[]) {
  const values = items.flatMap((item) => isValidGrade(item.grade) ? [item.grade] : []);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type GradeSummary = {
  currentAverage: number | null;
  enteredWeight: number;
  remainingWeight: number;
  pendingItems: number;
  gradedItems: number;
  contribution: number;
};

export function calculateCourseGradeSummary(
  course: Course,
  gradeItems: CourseGradeItems | undefined
): GradeSummary {
  let enteredWeight = 0;
  let contribution = 0;
  let pendingItems = 0;
  let gradedItems = 0;

  for (const component of course.gradeComponents) {
    const items = gradeItems?.[gradeComponentKey(component)] ?? [];
    const average = componentGrade(items);
    gradedItems += items.filter((item) => isValidGrade(item.grade)).length;
    pendingItems += items.filter((item) => !isValidGrade(item.grade)).length;
    if (average === null) continue;
    enteredWeight += component.weight;
    contribution += average * (component.weight / 100);
  }

  return {
    currentAverage: enteredWeight > 0 ? contribution / (enteredWeight / 100) : null,
    enteredWeight,
    remainingWeight: Math.max(0, 100 - enteredWeight),
    pendingItems,
    gradedItems,
    contribution,
  };
}
