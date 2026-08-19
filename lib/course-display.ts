import { DAY_NAMES, daysUntil } from "./date";
import type { Course, Evaluation } from "./types";

export function nextCourseEvaluation(course: Course) {
  return [...course.evaluations]
    .filter((evaluation) => daysUntil(evaluation.date) >= 0)
    .sort((a, b) =>
      `${a.date} ${a.time ?? "23:59"}`.localeCompare(
        `${b.date} ${b.time ?? "23:59"}`
      )
    )[0];
}

export function courseScheduleSummary(course: Course) {
  if (course.classes.length === 0) return null;

  const days = [...new Set(course.classes.map((block) => DAY_NAMES[block.day]))];
  const firstBlock = [...course.classes].sort((a, b) =>
    a.start.localeCompare(b.start)
  )[0];

  return `${days.join(" · ")} · ${firstBlock.start}–${firstBlock.end}`;
}

export function splitEvaluations(evaluations: Evaluation[]) {
  const sorted = [...evaluations].sort((a, b) =>
    `${a.date} ${a.time ?? "23:59"}`.localeCompare(
      `${b.date} ${b.time ?? "23:59"}`
    )
  );

  return {
    upcoming: sorted.filter((evaluation) => daysUntil(evaluation.date) >= 0),
    past: sorted.filter((evaluation) => daysUntil(evaluation.date) < 0),
  };
}
