"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  deleteMyCourse,
  loadMyCourses,
  upsertBaseCourses,
} from "@/app/course-actions";
import { readSavedCourses, writeSavedCourses } from "@/lib/saved-courses-storage";
import type { Course, SemesterSettings } from "@/lib/types";
import { getUserStorageKey, USER_STORAGE_KEYS } from "@/lib/user-storage";
import { useAuthUser } from "./AuthUserProvider";

type InitialDataStatus = "loading" | "success" | "error";

type InitialDataContextValue = {
  courses: Course[];
  semester: SemesterSettings | null;
  onboardingCompleted: boolean;
  status: InitialDataStatus;
  error: string | null;
  replaceCourse: (
    course: Course
  ) => Promise<{ success: boolean; error?: string }>;
  saveCourses: (
    courses: Course[]
  ) => Promise<{ success: boolean; error?: string }>;
  deleteCourse: (
    legacyId: string
  ) => Promise<{ success: boolean; error?: string }>;
};

type InitialDataState = Omit<
  InitialDataContextValue,
  "replaceCourse" | "saveCourses" | "deleteCourse"
> & {
  loadedUserId: string | null;
};

const InitialDataContext = createContext<InitialDataContextValue | null>(null);

function readSavedSemester(userId: string): SemesterSettings | null {
  const semesterKey = getUserStorageKey(userId, USER_STORAGE_KEYS.semester);
  const saved =
    localStorage.getItem(semesterKey) ?? sessionStorage.getItem(semesterKey);

  if (!saved) return null;

  const parsed: unknown = JSON.parse(saved);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("La configuración del semestre no tiene un formato válido.");
  }

  return parsed as SemesterSettings;
}

function persistMappings(
  userId: string,
  nextMappings: { legacyId: string; courseId: string }[]
) {
  const mappingKey = getUserStorageKey(userId, USER_STORAGE_KEYS.courseIdMap);
  let mappings: Record<string, string> = {};

  try {
    const raw = localStorage.getItem(mappingKey);
    if (raw) mappings = JSON.parse(raw) as Record<string, string>;
  } catch {
    mappings = {};
  }

  nextMappings.forEach(({ legacyId, courseId }) => {
    mappings[legacyId] = courseId;
  });

  const serialized = JSON.stringify(mappings);
  localStorage.setItem(mappingKey, serialized);
  sessionStorage.setItem(mappingKey, serialized);
}

export default function InitialDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, isAuthLoading, authError } = useAuthUser();
  const [data, setData] = useState<InitialDataState>({
    courses: [],
    semester: null,
    onboardingCompleted: false,
    status: "loading",
    error: null,
    loadedUserId: null,
  });

  useEffect(() => {
    if (isAuthLoading) return;

    let active = true;

    queueMicrotask(() => {
      void (async () => {
        if (!active) return;

        if (authError) {
          setData({
            courses: [],
            semester: null,
            onboardingCompleted: false,
            status: "error",
            error: authError,
            loadedUserId: null,
          });
          return;
        }

        if (!userId) {
          setData({
            courses: [],
            semester: null,
            onboardingCompleted: false,
            status: "success",
            error: null,
            loadedUserId: null,
          });
          return;
        }

        let localSemester: SemesterSettings | null = null;
        let localCourses: Course[] = [];

        try {
          localSemester = readSavedSemester(userId);
        } catch (error) {
          console.warn("El respaldo local del semestre no es válido:", error);
        }

        try {
          localCourses = readSavedCourses(userId);
        } catch (error) {
          console.warn("El respaldo local de ramos no es válido:", error);
        }

        try {
          const locallyCompleted =
            localStorage.getItem(
              getUserStorageKey(userId, USER_STORAGE_KEYS.onboardingCompleted)
            ) === "true";
          const result = await loadMyCourses(localCourses);

          if (!active) return;

          if (!result.success) {
            setData({
              courses: [],
              semester: localSemester,
              onboardingCompleted: locallyCompleted,
              status: "error",
              error: result.error,
              loadedUserId: userId,
            });
            return;
          }

          const semester = result.semester.settings;
          const courses = result.courses;
          const onboardingCompleted = locallyCompleted || courses.length > 0;
          const semesterKey = getUserStorageKey(
            userId,
            USER_STORAGE_KEYS.semester
          );
          const semesterIdKey = getUserStorageKey(
            userId,
            USER_STORAGE_KEYS.semesterId
          );
          const serializedSemester = JSON.stringify(semester);

          writeSavedCourses(userId, courses);
          localStorage.setItem(semesterKey, serializedSemester);
          sessionStorage.setItem(semesterKey, serializedSemester);
          localStorage.setItem(semesterIdKey, result.semester.id);
          sessionStorage.setItem(semesterIdKey, result.semester.id);
          persistMappings(userId, result.mappings);

          if (onboardingCompleted) {
            localStorage.setItem(
              getUserStorageKey(userId, USER_STORAGE_KEYS.onboardingCompleted),
              "true"
            );
          }

          setData({
            courses,
            semester,
            onboardingCompleted,
            status: "success",
            error: null,
            loadedUserId: userId,
          });
        } catch (error) {
          console.error("No fue posible preparar los datos iniciales:", error);
          setData({
            courses: [],
            semester: null,
            onboardingCompleted: false,
            status: "error",
            error: "No fue posible cargar tus ramos. Inténtalo nuevamente.",
            loadedUserId: userId,
          });
        }
      })();
    });

    return () => {
      active = false;
    };
  }, [authError, isAuthLoading, userId]);

  const status: InitialDataStatus =
    isAuthLoading || (userId !== null && data.loadedUserId !== userId)
      ? "loading"
      : data.status;

  useEffect(() => {
    if (
      status === "success" &&
      userId &&
      !data.onboardingCompleted &&
      !pathname.startsWith("/onboarding/")
    ) {
      router.replace("/onboarding/semester");
    }
  }, [data.onboardingCompleted, pathname, router, status, userId]);

  async function saveCourses(nextCourses: Course[]) {
    if (!userId || status !== "success") {
      return { success: false, error: "No fue posible identificar tu sesión." };
    }

    const result = await upsertBaseCourses(nextCourses);
    if (!result.success) return result;

    setData((current) => {
      const incomingById = new Map(
        nextCourses.map((course) => [course.id, course])
      );
      const courses = current.courses
        .map((course) => incomingById.get(course.id) ?? course)
        .concat(
          nextCourses.filter(
            (course) =>
              !current.courses.some((currentCourse) => currentCourse.id === course.id)
          )
        );

      writeSavedCourses(userId, courses);
      localStorage.setItem(
        getUserStorageKey(userId, USER_STORAGE_KEYS.onboardingCompleted),
        "true"
      );
      return { ...current, courses, onboardingCompleted: true };
    });

    persistMappings(userId, result.courses);
    return { success: true };
  }

  async function replaceCourse(updatedCourse: Course) {
    return saveCourses([updatedCourse]);
  }

  async function deleteCourse(legacyId: string) {
    if (!userId || status !== "success") {
      return { success: false, error: "No fue posible identificar tu sesión." };
    }

    const result = await deleteMyCourse(legacyId);
    if (!result.success) return result;

    setData((current) => {
      const courses = current.courses.filter((course) => course.id !== legacyId);
      writeSavedCourses(userId, courses);
      return { ...current, courses };
    });

    const mappingKey = getUserStorageKey(userId, USER_STORAGE_KEYS.courseIdMap);
    let mappings: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(mappingKey);
      if (raw) mappings = JSON.parse(raw) as Record<string, string>;
    } catch {
      mappings = {};
    }
    delete mappings[legacyId];
    const serialized = JSON.stringify(mappings);
    localStorage.setItem(mappingKey, serialized);
    sessionStorage.setItem(mappingKey, serialized);
    return { success: true };
  }

  const isPublicOrOnboardingRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/onboarding/");
  const isWaitingForOnboardingRedirect =
    status === "success" && Boolean(userId) && !data.onboardingCompleted;
  const showLoadingOverlay =
    status === "loading" || isWaitingForOnboardingRedirect;
  const showOverlay =
    !isPublicOrOnboardingRoute && (showLoadingOverlay || status === "error");

  return (
    <InitialDataContext.Provider
      value={{
        courses: data.loadedUserId === userId ? data.courses : [],
        semester: data.loadedUserId === userId ? data.semester : null,
        onboardingCompleted:
          data.loadedUserId === userId && data.onboardingCompleted,
        status,
        error: status === "error" ? data.error : null,
        replaceCourse,
        saveCourses,
        deleteCourse,
      }}
    >
      {children}

      {showOverlay && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/20 px-5 backdrop-blur-[2px]">
          <section
            role={status === "error" ? "alert" : "status"}
            aria-live="polite"
            className="w-full max-w-sm rounded-3xl bg-white px-7 py-8 text-center shadow-xl"
          >
            {showLoadingOverlay ? (
              <>
                <span
                  aria-hidden="true"
                  className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950"
                />
                <h2 className="mt-5 text-xl font-semibold">Cargando tus ramos...</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Estamos preparando tu semestre.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold">No pudimos cargar tus ramos</h2>
                <p className="mt-2 text-sm text-slate-500">{data.error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                >
                  Intentar nuevamente
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </InitialDataContext.Provider>
  );
}

export function useInitialData() {
  const context = useContext(InitialDataContext);

  if (!context) {
    throw new Error("useInitialData debe usarse dentro de InitialDataProvider");
  }

  return context;
}
