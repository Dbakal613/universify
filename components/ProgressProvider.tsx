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
import type { ProgressState } from "../lib/types";
import { useAuthUser } from "./AuthUserProvider";
import { getUserStorageKey, USER_STORAGE_KEYS } from "../lib/user-storage";

type ProgressContextValue = ProgressState & {
  setAttendance: Dispatch<SetStateAction<ProgressState["attendance"]>>;
  setGrades: Dispatch<SetStateAction<ProgressState["grades"]>>;
  setCustomActivities: Dispatch<
    SetStateAction<ProgressState["customActivities"]>
  >;
  setTargets: Dispatch<SetStateAction<ProgressState["targets"]>>;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export default function ProgressProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthLoading } = useAuthUser();
  const [attendance, setAttendance] = useState<ProgressState["attendance"]>({});
  const [grades, setGrades] = useState<ProgressState["grades"]>({});
  const [customActivities, setCustomActivities] = useState<
    ProgressState["customActivities"]
  >({});
  const [targets, setTargets] = useState<ProgressState["targets"]>({});
  const [readyUserId, setReadyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    const timeoutId = window.setTimeout(() => {
      setAttendance({});
      setGrades({});
      setCustomActivities({});
      setTargets({});
      setReadyUserId(null);

      if (!userId) return;

      try {
        const raw = localStorage.getItem(
          getUserStorageKey(userId, USER_STORAGE_KEYS.progress)
        );

        if (raw) {
          const saved = JSON.parse(raw) as Partial<ProgressState>;
          setAttendance(saved.attendance ?? {});
          setGrades(saved.grades ?? {});
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
    if (!userId || readyUserId !== userId) return;

    localStorage.setItem(
      getUserStorageKey(userId, USER_STORAGE_KEYS.progress),
      JSON.stringify({ attendance, grades, customActivities, targets })
    );
  }, [attendance, grades, customActivities, targets, readyUserId, userId]);

  return (
    <ProgressContext.Provider
      value={{
        attendance: readyUserId === userId ? attendance : {},
        setAttendance,
        grades: readyUserId === userId ? grades : {},
        setGrades,
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
