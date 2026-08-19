"use server";

import type { SemesterSettings } from "@/lib/types";
import { upsertAuthenticatedSemester } from "@/lib/semesters/server";

export async function upsertActiveSemester(settings: SemesterSettings) {
  return upsertAuthenticatedSemester(settings);
}
