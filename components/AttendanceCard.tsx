"use client";

import { useEffect, useState } from "react";

import {
  setSessionAttendance,
  syncCourseClassSessions,
  type RemoteClassSession,
  type SessionAttendanceStatus,
} from "@/app/attendance-actions";
import {
  attendanceRecordForClassSession,
  calculateAttendanceSummary,
} from "@/lib/attendance";
import { dateOnly } from "@/lib/date";
import type { AttendanceSession, ClassSession, Course } from "@/lib/types";
import { getUserStorageKey, USER_STORAGE_KEYS } from "@/lib/user-storage";
import { useAuthUser } from "./AuthUserProvider";
import { useProgress } from "./ProgressProvider";

const statusOptions: {
  value: AttendanceSession["status"];
  label: string;
  activeClass: string;
}[] = [
  {
    value: "attended",
    label: "Asistí",
    activeClass: "border-emerald-700 bg-emerald-700",
  },
  {
    value: "absent",
    label: "Falté",
    activeClass: "border-red-700 bg-red-700",
  },
  {
    value: "justified",
    label: "Inasistencia justificada",
    activeClass: "border-blue-700 bg-blue-700",
  },
];

function classSessionKey(session: ClassSession, index: number) {
  return `${session.date}|${session.start ?? ""}|${index}`;
}

function sessionDateLabel(session: ClassSession, includeYear = false) {
  const date = new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(new Date(`${session.date}T12:00:00`));

  return `${date}${session.start ? ` · ${session.start}` : ""}`;
}

function historyStatus(
  course: Course,
  record: ReturnType<typeof useProgress>["attendance"][string] | undefined,
  session: ClassSession
) {
  if (session.status === "cancelled") {
    return { label: "Cancelada", symbol: "—", className: "text-slate-500" };
  }

  const attendance = attendanceRecordForClassSession(course, record, session);
  if (attendance?.status === "attended") {
    return { label: "Asistí", symbol: "✓", className: "text-emerald-700" };
  }
  if (attendance?.status === "absent") {
    return { label: "Falté", symbol: "×", className: "text-red-700" };
  }
  if (attendance?.status === "justified") {
    return {
      label: "Inasistencia justificada",
      symbol: "✓",
      className: "text-blue-700",
    };
  }

  return { label: "Sin registrar", symbol: "○", className: "text-slate-500" };
}

export default function AttendanceCard({
  course,
  compact = false,
}: {
  course: Course;
  compact?: boolean;
}) {
  const { userId } = useAuthUser();
  const { attendance, setAttendance } = useProgress();
  const record = attendance[course.id];
  const today = dateOnly(new Date());
  const summary = calculateAttendanceSummary(course, record, today);
  const [remoteSessions, setRemoteSessions] = useState<RemoteClassSession[]>([]);
  const [syncMessage, setSyncMessage] = useState("");
  const todayBlock = course.classes.find(
    (block) => block.day === new Date().getDay()
  );

  const selectableSessions = course.classSessions
    .map((session, index) => ({
      session,
      key: classSessionKey(session, index),
    }))
    .filter(
      ({ session }) => session.status !== "cancelled" && session.date <= today
    )
    .sort((a, b) =>
      `${b.session.date} ${b.session.start ?? ""}`.localeCompare(
        `${a.session.date} ${a.session.start ?? ""}`
      )
    );

  const [selectedKey, setSelectedKey] = useState(
    () => selectableSessions[0]?.key ?? ""
  );
  const selected = selectableSessions.find((item) => item.key === selectedKey);
  const selectedStatus = selected
    ? attendanceRecordForClassSession(course, record, selected.session)?.status
    : undefined;
  const savedTodaySession = course.classSessions.find(
    (session) => session.date === today && session.status !== "cancelled"
  );
  const compactSession = savedTodaySession
    ? {
        session: savedTodaySession,
        key: classSessionKey(
          savedTodaySession,
          course.classSessions.indexOf(savedTodaySession)
        ),
      }
    : todayBlock
      ? {
          session: {
            date: today,
            start: todayBlock.start,
            end: todayBlock.end,
            room: todayBlock.room,
            status: "scheduled" as const,
          },
          key: `${today}|${todayBlock.start}|today`,
        }
      : undefined;
  const compactStatus = compactSession
    ? attendanceRecordForClassSession(course, record, compactSession.session)?.status
    : undefined;

  const history = course.classSessions
    .filter((session) => session.date <= today)
    .sort((a, b) =>
      `${b.date} ${b.start ?? ""}`.localeCompare(`${a.date} ${a.start ?? ""}`)
    );

  useEffect(() => {
    if (!userId) return;

    const hasSavedTodaySession = course.classSessions.some(
      (session) => session.date === today && session.status !== "cancelled"
    );
    const sessionsToSync =
      compact && todayBlock && !hasSavedTodaySession
        ? [
            ...course.classSessions,
            {
              date: today,
              start: todayBlock.start,
              end: todayBlock.end,
              room: todayBlock.room,
              status: "scheduled" as const,
            },
          ]
        : course.classSessions;

    if (sessionsToSync.length === 0) return;

    const mapKey = getUserStorageKey(userId, USER_STORAGE_KEYS.courseIdMap);
    const rawMap = localStorage.getItem(mapKey) ?? sessionStorage.getItem(mapKey);
    if (!rawMap) return;

    let remoteCourseId: string | undefined;
    try {
      remoteCourseId = (JSON.parse(rawMap) as Record<string, string>)[course.id];
    } catch {
      return;
    }
    if (!remoteCourseId) return;

    let active = true;
    void syncCourseClassSessions(remoteCourseId, sessionsToSync).then((result) => {
      if (!active) return;
      if (result.success) {
        setRemoteSessions(result.sessions);
        setSyncMessage("");
      } else {
        setSyncMessage("La asistencia seguirá guardándose localmente por ahora.");
      }
    });

    return () => {
      active = false;
    };
  }, [compact, course.classSessions, course.id, today, todayBlock, userId]);

  function register(
    status: AttendanceSession["status"],
    target = selected
  ) {
    if (!target) return;

    const { session } = target;
    setAttendance((previous) => {
      const previousRecord = previous[course.id] ?? { attended: 0, total: 0 };
      const previousSessions = previousRecord.sessions ?? [];
      const sessionsOnDate = course.classSessions.filter(
        (item) => item.date === session.date && item.status !== "cancelled"
      );
      const updatedSessions = [
        ...previousSessions.filter(
          (item) =>
            !(
              item.date === session.date &&
              (item.start === session.start ||
                (!item.start && sessionsOnDate.length === 1))
            )
        ),
        { date: session.date, start: session.start, status },
      ].sort((a, b) =>
        `${a.date} ${a.start ?? ""}`.localeCompare(`${b.date} ${b.start ?? ""}`)
      );
      const previousDatedAttended = previousSessions.filter(
        (item) => item.status === "attended"
      ).length;
      const legacyTotal = Math.max(0, previousRecord.total - previousSessions.length);
      const legacyAttended = Math.max(
        0,
        previousRecord.attended - previousDatedAttended
      );

      return {
        ...previous,
        [course.id]: {
          attended:
            legacyAttended +
            updatedSessions.filter((item) => item.status === "attended").length,
          total: legacyTotal + updatedSessions.length,
          sessions: updatedSessions,
        },
      };
    });

    const remoteSession = remoteSessions.find(
      (item) =>
        item.date === session.date &&
        (item.start?.slice(0, 5) ?? null) === (session.start ?? null)
    );

    if (remoteSession) {
      void setSessionAttendance({
        courseId: remoteSession.courseId,
        sessionId: remoteSession.id,
        status: status as SessionAttendanceStatus,
      }).then((result) => {
        setSyncMessage(
          result.success ? "" : "La marca quedó guardada localmente, pero no se pudo sincronizar."
        );
      });
    }
  }

  const progressLabel = summary.total
    ? `${summary.occurred} / ${summary.total} clases`
    : `${summary.occurred} ${summary.occurred === 1 ? "clase realizada" : "clases realizadas"}`;
  const semesterProgress = summary.total
    ? Math.min(100, (summary.occurred / summary.total) * 100)
    : null;

  if (compact) {
    return (
      <article className={`rounded-3xl p-5 ${course.color}`}>
        <h3 className="font-semibold">{course.name}</h3>
        {todayBlock && (
          <p className="mt-1 text-sm">
            {todayBlock.start}–{todayBlock.end}
            {todayBlock.room ? ` · ${todayBlock.room}` : ""}
          </p>
        )}
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80">
          <div
            className="h-full rounded-full bg-slate-950"
            style={{ width: `${summary.percentage ?? 0}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium">{progressLabel}</p>
        <p className="mt-1 text-xs text-slate-600">
          Asistencia: {summary.percentage === null ? "Sin registros" : `${summary.percentage.toFixed(1)}%`}
        </p>
        {compactSession && (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {statusOptions.map((option) => {
              const active = compactStatus === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => register(option.value, compactSession)}
                  style={active ? { color: "#ffffff" } : undefined}
                  className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${
                    active
                      ? option.activeClass
                      : "border-white/80 bg-white/80 text-slate-700 hover:bg-white"
                  }`}
                >
                  {active ? "✓ " : ""}
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
        {syncMessage && (
          <p className="mt-3 text-xs text-amber-800">{syncMessage}</p>
        )}
      </article>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Asistencia
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{progressLabel}</p>
          {semesterProgress !== null && (
            <p className="mt-1 text-sm text-slate-500">
              {semesterProgress.toFixed(0)}% de las clases cursadas
            </p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-slate-500">Asistencia actual</p>
          <p className="mt-1 text-4xl font-bold text-slate-950">
            {summary.percentage === null ? "—" : `${summary.percentage.toFixed(1)}%`}
          </p>
          {course.attendanceRequired !== undefined && (
            <p className="mt-1 text-sm text-slate-500">
              Mínimo requerido: {course.attendanceRequired}%
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Asistidas" value={summary.attended} />
        <Stat label="Faltas" value={summary.absent} />
        <Stat label="Justificadas" value={summary.justified} />
        <Stat label="Sin registrar" value={summary.unregistered} />
      </div>

      <div className="mt-7 rounded-2xl bg-slate-50 p-4">
        <label className="text-sm font-semibold text-slate-700">
          Clase
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            disabled={selectableSessions.length === 0}
            className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {selectableSessions.length === 0 ? (
              <option value="">No hay clases realizadas disponibles</option>
            ) : (
              selectableSessions.map(({ session, key }) => (
                <option key={key} value={key}>
                  {sessionDateLabel(session, true)}
                </option>
              ))
            )}
          </select>
        </label>

        {selected && (
          <div className="mt-4">
            <p className="font-semibold capitalize">
              {sessionDateLabel(selected.session)}
              {selected.session.room ? ` · ${selected.session.room}` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Estado: {statusOptions.find((option) => option.value === selectedStatus)?.label ?? "Sin registrar"}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {statusOptions.map((option) => {
                const active = selectedStatus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => register(option.value)}
                    style={active ? { color: "#ffffff" } : undefined}
                    className={`min-h-11 rounded-xl border px-3 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${
                      active
                        ? option.activeClass
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {active ? "✓ " : ""}{option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {syncMessage && (
        <p className="mt-3 text-sm text-amber-700">{syncMessage}</p>
      )}

      <div className="mt-7">
        <h3 className="text-lg font-semibold">Últimas clases</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Todavía no hay sesiones reales registradas para este ramo.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {history.slice(0, 10).map((session, index) => {
              const status = historyStatus(course, record, session);
              return (
                <div
                  key={classSessionKey(session, index)}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="capitalize text-slate-700">
                    {sessionDateLabel(session)}
                  </span>
                  <span className={`text-right font-semibold ${status.className}`}>
                    <span aria-hidden="true">{status.symbol} </span>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
