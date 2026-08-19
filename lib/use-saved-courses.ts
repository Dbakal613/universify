"use client";

import { useInitialData } from "@/components/InitialDataProvider";

export { readSavedCourses, writeSavedCourses } from "./saved-courses-storage";

export function useSavedCourses() {
  const {
    courses,
    status,
    error,
    replaceCourse,
    saveCourses,
    deleteCourse,
  } = useInitialData();

  return {
    courses,
    status,
    isLoading: status === "loading",
    error,
    replaceCourse,
    saveCourses,
    deleteCourse,
  };
}
