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
  const [attendance, setAttendance] = useState<ProgressState["attendance"]>({});
  const [grades, setGrades] = useState<ProgressState["grades"]>({});
  const [customActivities, setCustomActivities] = useState<
    ProgressState["customActivities"]
  >({});
  const [targets, setTargets] = useState<ProgressState["targets"]>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("universify-progress-v3");

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
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    localStorage.setItem(
      "universify-progress-v3",
      JSON.stringify({ attendance, grades, customActivities, targets })
    );
  }, [attendance, grades, customActivities, targets, ready]);

  return (
    <ProgressContext.Provider
      value={{
        attendance,
        setAttendance,
        grades,
        setGrades,
        customActivities,
        setCustomActivities,
        targets,
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
