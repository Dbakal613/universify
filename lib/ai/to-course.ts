import type { ExtractedCourse } from "./course-schema";
import type {
  Course,
  EvaluationKind,
} from "../types";

function createCourseId(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "ramo"}-${Date.now()}`;
}

function mapEvaluationKind(
  type: ExtractedCourse["evaluations"][number]["type"]
): EvaluationKind {
  if (type === "presentacion") {
    return "entrega";
  }

  return type;
}

function buildAttendanceNote(
  course: ExtractedCourse
): string | undefined {
  if (course.attendance.rules) {
    return course.attendance.rules;
  }

  if (course.attendance.requiredPercentage !== null) {
    return `Asistencia mínima requerida: ${course.attendance.requiredPercentage}%.`;
  }

  return undefined;
}

export function extractedCourseToCourse(
  extracted: ExtractedCourse
): Course {
  return {
    id: createCourseId(extracted.name),

    name: extracted.name,

    professor: extracted.professor.name ?? "",

    email: extracted.professor.email ?? "",

    autonomousHours: extracted.autonomousHours ?? 0,

    totalClasses:
      extracted.attendance.totalClasses ??
      extracted.classSessions.filter((session) => session.status === "scheduled").length,

    attendanceRequired:
      extracted.attendance.requiredPercentage ?? undefined,

    attendanceNote: buildAttendanceNote(extracted),

    color: "bg-indigo-100",

    classes: extracted.classes.map((classBlock) => ({
      day: classBlock.day === 7 ? 0 : classBlock.day,
      start: classBlock.start,
      end: classBlock.end,
      room: classBlock.room ?? undefined,
    })),

    classSessions: extracted.classSessions.map((session) => ({
      date: session.date,
      start: session.start ?? undefined,
      end: session.end ?? undefined,
      room: session.room ?? undefined,
      topics: session.topics ?? undefined,
      status: session.status,
      note: session.note ?? undefined,
    })),

    evaluations: extracted.evaluations
      .filter(
        (
          evaluation
        ): evaluation is typeof evaluation & {
          date: string;
        } => Boolean(evaluation.date)
      )
      .map((evaluation) => ({
        name: evaluation.name,
        date: evaluation.date,
        time: evaluation.time ?? undefined,
        kind: mapEvaluationKind(evaluation.type),
        detail: evaluation.topics ?? undefined,
      })),

    gradeComponents: extracted.gradeComponents
      .filter(
        (
          component
        ): component is typeof component & {
          weight: number;
        } => component.weight !== null
      )
      .map((component) => ({
        name: component.name,
        weight: component.weight,
      })),

    autonomousTasks: extracted.autonomousWork
      .filter(
        (
          task
        ): task is typeof task & {
          weekStart: string;
        } => Boolean(task.weekStart)
      )
      .map((task) => ({
        weekStart: task.weekStart,
        title: task.title,
        classTopics: task.classTopics ?? undefined,
        minutes: task.estimatedMinutes ?? 0,
        evaluation: task.relatedEvaluation ?? undefined,
      })),
  };
}
