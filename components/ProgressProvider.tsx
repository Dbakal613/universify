"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";
import { loadMyAttendance } from "../app/attendance-actions";
import { loadMyGradeItems } from "../app/grade-actions";
import type { ProgressState } from "../lib/types";
import { useAuthUser } from "./AuthUserProvider";
import { useInitialData } from "./InitialDataProvider";
import { getUserStorageKey, USER_STORAGE_KEYS } from "../lib/user-storage";

type ProgressContextValue = ProgressState & {
  attendanceStatus: "loading" | "success" | "error";
  attendanceError: string | null;
  gradesStatus: "loading" | "success" | "error";
  gradesError: string | null;
  setAttendance: Dispatch<SetStateAction<ProgressState["attendance"]>>;
  setGrades: Dispatch<SetStateAction<ProgressState["grades"]>>;
  setGradeItems: Dispatch<SetStateAction<ProgressState["gradeItems"]>>;
  setCustomActivities: Dispatch<
    SetStateAction<ProgressState["customActivities"]>
  >;
  setTargets: Dispatch<SetStateAction<ProgressState["targets"]>>;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export default function ProgressProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthLoading } = useAuthUser();
  const { status: initialDataStatus } = useInitialData();
  const [attendance, setAttendance] = useState<ProgressState["attendance"]>({});
  const [grades, setGrades] = useState<ProgressState["grades"]>({});
  const [gradeItems, setGradeItems] = useState<ProgressState["gradeItems"]>({});
  const [customActivities, setCustomActivities] = useState<
    ProgressState["customActivities"]
  >({});
  const [targets, setTargets] = useState<ProgressState["targets"]>({});
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<
    "loading" | "success" | "error"
  >("loading");
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [gradesStatus, setGradesStatus] = useState<"loading" | "success" | "error">("loading");
  const [gradesError, setGradesError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    const timeoutId = window.setTimeout(() => {
      setAttendance({});
      setGrades({});
      setGradeItems({});
      setCustomActivities({});
      setTargets({});
      setReadyUserId(null);
      setAttendanceStatus("loading");
      setAttendanceError(null);
      setGradesStatus("loading");
      setGradesError(null);

      if (!userId) return;

      try {
        const raw = localStorage.getItem(
          getUserStorageKey(userId, USER_STORAGE_KEYS.progress)
        );

        if (raw) {
          const saved = JSON.parse(raw) as Partial<ProgressState>;
          setAttendance(saved.attendance ?? {});
          setGrades(saved.grades ?? {});
          setGradeItems(saved.gradeItems ?? {});
          setCustomActivities(saved.customActivities ?? {});
          setTargets(saved.targets ?? {});
        }
      } catch {
        // Ignore invalid browser data and start clean.
      } finally {
        setReadyUserId(userId);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthLoading, userId]);

  useEffect(() => {
    if (!userId || readyUserId !== userId || initialDataStatus !== "success") return;

    let active = true;
    void Promise.all([
      loadMyAttendance(attendance),
      loadMyGradeItems(grades, gradeItems),
    ]).then(([result, gradeResult]) => {
      if (!active) return;
      if (!result.success) {
        setAttendanceStatus("error");
        setAttendanceError(result.error);
      } else {
        const hydrated: ProgressState["attendance"] = {};
        for (const remote of result.records) {
          const current = hydrated[remote.legacyCourseId] ?? {
            attended: 0,
            total: 0,
            sessions: [],
          };
          const sessions = [
            ...(current.sessions ?? []).filter(
              (session) => session.sessionId !== remote.sessionId
            ),
            {
              sessionId: remote.sessionId,
              date: remote.date,
              start: remote.start,
              status: remote.status,
            },
          ];
          hydrated[remote.legacyCourseId] = {
            attended: sessions.filter((session) => session.status === "attended").length,
            total: sessions.length,
            sessions,
          };
        }

        setAttendance(hydrated);
        setAttendanceStatus("success");
        setAttendanceError(null);
      }

      if (!gradeResult.success) {
        setGradesStatus("error");
        setGradesError(gradeResult.error);
      } else {
        const hydrated: ProgressState["gradeItems"] = {};
        for (const remote of gradeResult.items) {
          const course = hydrated[remote.legacyCourseId] ?? {};
          const items = course[remote.componentKey] ?? [];
          course[remote.componentKey] = [...items, {
            id: remote.clientId,
            remoteId: remote.id,
            name: remote.name,
            grade: remote.grade,
            date: remote.date,
          }];
          hydrated[remote.legacyCourseId] = course;
        }
        setGradeItems(hydrated);
        setGradesStatus("success");
        setGradesError(null);
      }
    });

    return () => {
      active = false;
    };
    // Local progress is intentionally captured once as migration/cache input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataStatus, readyUserId, userId]);

  useEffect(() => {
    if (!userId || readyUserId !== userId) return;

    localStorage.setItem(
      getUserStorageKey(userId, USER_STORAGE_KEYS.progress),
      JSON.stringify({ attendance, grades, gradeItems, customActivities, targets })
    );
  }, [attendance, gradeItems, grades, customActivities, targets, readyUserId, userId]);

  return (
    <ProgressContext.Provider
      value={{
        attendance: readyUserId === userId ? attendance : {},
        attendanceStatus,
        attendanceError,
        setAttendance,
        grades: readyUserId === userId ? grades : {},
        setGrades,
        gradeItems: readyUserId === userId ? gradeItems : {},
        setGradeItems,
        gradesStatus,
        gradesError,
        customActivities: readyUserId === userId ? customActivities : {},
        setCustomActivities,
        targets: readyUserId === userId ? targets : {},
        setTargets,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);

  if (!context) {
    throw new Error("useProgress debe usarse dentro de ProgressProvider");
  }

  return context;
}
