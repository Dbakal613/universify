import { countScheduledClasses } from "./date";
import type { Course } from "./types";
import { getUserStorageKey, USER_STORAGE_KEYS } from "./user-storage";

function normalizeCourse(value: unknown): Course | null {
  if (!value || typeof value !== "object") return null;

  const course = value as Partial<Course>;
  if (typeof course.id !== "string" || typeof course.name !== "string") {
    return null;
  }

  return {
    id: course.id,
    name: course.name,
    professor: typeof course.professor === "string" ? course.professor : "",
    email: typeof course.email === "string" ? course.email : "",
    autonomousHours:
      typeof course.autonomousHours === "number" ? course.autonomousHours : 0,
    totalClasses:
      typeof course.totalClasses === "number" ? course.totalClasses : 0,
    attendanceRequired:
      typeof course.attendanceRequired === "number"
        ? course.attendanceRequired
        : undefined,
    attendanceNote:
      typeof course.attendanceNote === "string"
        ? course.attendanceNote
        : undefined,
    color: typeof course.color === "string" ? course.color : "bg-blue-100",
    classes: (Array.isArray(course.classes) ? course.classes : []).map(
      (block) => ({ ...block, day: block.day === 7 ? 0 : block.day })
    ),
    classSessions: Array.isArray(course.classSessions)
      ? course.classSessions
      : [],
    evaluations: Array.isArray(course.evaluations) ? course.evaluations : [],
    gradeComponents: Array.isArray(course.gradeComponents)
      ? course.gradeComponents
      : [],
    autonomousTasks: Array.isArray(course.autonomousTasks)
      ? course.autonomousTasks
      : [],
  };
}

export function readSavedCourses(userId: string): Course[] {
  const coursesKey = getUserStorageKey(userId, USER_STORAGE_KEYS.courses);
  const saved = localStorage.getItem(coursesKey);

  if (!saved) return [];

  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) {
    throw new Error("Los ramos guardados no tienen un formato válido.");
  }

  const courses = parsed
    .map(normalizeCourse)
    .filter((course): course is Course => course !== null);

  try {
    const semesterRaw =
      localStorage.getItem(
        getUserStorageKey(userId, USER_STORAGE_KEYS.semester)
      ) ??
      sessionStorage.getItem(
        getUserStorageKey(userId, USER_STORAGE_KEYS.semester)
      );

    if (semesterRaw) {
      const semester = JSON.parse(semesterRaw) as {
        startDate?: string;
        endDate?: string;
      };

      if (semester.startDate && semester.endDate) {
        courses.forEach((course) => {
          if (
            course.totalClasses === 0 &&
            course.classes.length > 0 &&
            course.classSessions.length === 0
          ) {
            course.totalClasses = countScheduledClasses(
              course.classes,
              semester.startDate!,
              semester.endDate!
            );
          }
        });

        localStorage.setItem(coursesKey, JSON.stringify(courses));
      }
    }
  } catch {
    // Keep the extracted total when semester settings are unavailable.
  }

  return courses;
}

export function writeSavedCourses(userId: string, courses: Course[]) {
  localStorage.setItem(
    getUserStorageKey(userId, USER_STORAGE_KEYS.courses),
    JSON.stringify(courses)
  );
}
