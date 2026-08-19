"use server";

import type { Course } from "@/lib/types";
import {
  deleteAuthenticatedCourse,
  loadAuthenticatedCourses,
  saveAuthenticatedCourses,
} from "@/lib/courses/server";

export async function loadMyCourses(localCourses: Course[]) {
  return loadAuthenticatedCourses(localCourses);
}

export async function upsertBaseCourses(courses: Course[]) {
  return saveAuthenticatedCourses(courses);
}

export async function deleteMyCourse(legacyId: string) {
  return deleteAuthenticatedCourse(legacyId);
}
