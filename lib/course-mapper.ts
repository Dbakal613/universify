import type { ExtractedCourse } from "./ai/course-schema";
import type { Course, EvaluationKind } from "./types";

const courseColors = [
  "bg-blue-100",
  "bg-slate-200",
  "bg-amber-100",
  "bg-rose-100",
  "bg-violet-100",
  "bg-emerald-100",
  "bg-cyan-100",
];

function createCourseId(name: string) {
  return `${name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizedKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeEvaluationDate(value: string) {
  const isoDate = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}`;
  }

  const localDate = value.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);

  if (localDate) {
    return `${localDate[3]}-${localDate[2].padStart(2, "0")}-${localDate[1].padStart(2, "0")}`;
  }

  return value;
}

export function mergeCourseSupplement(
  current: Course,
  supplement: Course
): Course {
  const classes = [...current.classes];

  supplement.classes.forEach((nextBlock) => {
    const matchingIndex = classes.findIndex(
      (block) =>
        block.day === nextBlock.day &&
        block.start === nextBlock.start &&
        block.end === nextBlock.end
    );

    if (matchingIndex === -1) {
      classes.push(nextBlock);
      return;
    }

    classes[matchingIndex] = {
      ...classes[matchingIndex],
      ...(nextBlock.room ? { room: nextBlock.room } : {}),
    };
  });

  const classSessions = [...current.classSessions];

  supplement.classSessions.forEach((nextSession) => {
    const matchingIndex = classSessions.findIndex(
      (session) =>
        session.date === nextSession.date &&
        (session.start ?? "") === (nextSession.start ?? "")
    );

    if (matchingIndex === -1) {
      classSessions.push(nextSession);
    } else {
      classSessions[matchingIndex] = {
        ...classSessions[matchingIndex],
        ...nextSession,
      };
    }
  });

  const evaluations = [...current.evaluations];

  supplement.evaluations.forEach((nextEvaluation) => {
    const matchingIndex = evaluations.findIndex(
      (evaluation) =>
        normalizedKey(evaluation.name) === normalizedKey(nextEvaluation.name)
    );

    if (matchingIndex === -1) {
      evaluations.push(nextEvaluation);
      return;
    }

    evaluations[matchingIndex] = {
      ...evaluations[matchingIndex],
      ...nextEvaluation,
      detail:
        nextEvaluation.detail ?? evaluations[matchingIndex].detail,
    };
  });

  const gradeComponents = [...current.gradeComponents];

  supplement.gradeComponents.forEach((nextComponent) => {
    const matchingIndex = gradeComponents.findIndex(
      (component) =>
        normalizedKey(component.name) === normalizedKey(nextComponent.name)
    );

    if (matchingIndex === -1) {
      gradeComponents.push(nextComponent);
    } else {
      gradeComponents[matchingIndex] = {
        ...gradeComponents[matchingIndex],
        ...nextComponent,
      };
    }
  });

  const autonomousTasks = [...current.autonomousTasks];

  supplement.autonomousTasks.forEach((nextTask) => {
    const matchingIndex = autonomousTasks.findIndex(
      (task) =>
        task.weekStart === nextTask.weekStart &&
        normalizedKey(task.title) === normalizedKey(nextTask.title)
    );

    if (matchingIndex === -1) {
      autonomousTasks.push(nextTask);
    } else {
      autonomousTasks[matchingIndex] = {
        ...autonomousTasks[matchingIndex],
        ...nextTask,
      };
    }
  });

  return {
    ...current,
    professor: supplement.professor || current.professor,
    email: supplement.email || current.email,
    autonomousHours:
      supplement.autonomousHours || current.autonomousHours,
    totalClasses: supplement.totalClasses || current.totalClasses,
    attendanceRequired:
      supplement.attendanceRequired ?? current.attendanceRequired,
    attendanceNote: supplement.attendanceNote ?? current.attendanceNote,
    classes,
    classSessions,
    evaluations,
    gradeComponents,
    autonomousTasks,
  };
}

export function extractedCourseToCourse(
  extracted: ExtractedCourse,
  colorIndex = 0
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

    attendanceNote:
      extracted.attendance.rules ?? undefined,

    color: courseColors[colorIndex % courseColors.length],

    classes: extracted.classes.map((classBlock) => ({
      day: classBlock.day === 7 ? 0 : classBlock.day,
      start: classBlock.start,
      end: classBlock.end,
      room: classBlock.room ?? undefined,
    })),

    classSessions: extracted.classSessions.map((session) => ({
      date: normalizeEvaluationDate(session.date),
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
        date: normalizeEvaluationDate(evaluation.date),
        time: evaluation.time ?? undefined,
        kind: evaluation.type as EvaluationKind,
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
        minutes: task.estimatedMinutes ?? undefined,
        evaluation: task.relatedEvaluation ?? undefined,
      })),
  };
}
