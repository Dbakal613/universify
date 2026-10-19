import type { ClassBlock, ClassSession, Course } from "./types";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
export const GENERATED_SCHEDULE_NOTE = "Generada desde el horario semanal del semestre.";

export function normalizeSessionTime(value?: string | null) {
  if (!value) return undefined;
  const match = value.trim().match(timePattern);
  if (!match) return undefined;
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

export function displaySessionTime(value?: string | null) {
  const normalized = normalizeSessionTime(value);
  return normalized?.slice(0, 5);
}

export function classSessionIdentity(session: Pick<ClassSession, "date" | "start">) {
  return `${session.date}|${normalizeSessionTime(session.start) ?? "untimed"}`;
}

export function normalizeClassSessions(sessions: ClassSession[]) {
  const byIdentity = new Map<string, ClassSession>();

  for (const session of sessions) {
    if (!isoDatePattern.test(session.date)) continue;
    const start = normalizeSessionTime(session.start);
    const end = normalizeSessionTime(session.end);
    if (session.start && !start) continue;
    if (session.end && !end) continue;
    if (start && end && start >= end) continue;

    const normalized: ClassSession = {
      ...session,
      start,
      end,
      room: session.room?.trim() || undefined,
      topics: session.topics?.trim() || undefined,
      note: session.note?.trim() || undefined,
    };
    const identity = classSessionIdentity(normalized);
    const current = byIdentity.get(identity);
    byIdentity.set(identity, current ? { ...current, ...normalized } : normalized);
  }

  return [...byIdentity.values()].sort((left, right) =>
    classSessionIdentity(left).localeCompare(classSessionIdentity(right))
  );
}

export function scheduledSessionCount(sessions: ClassSession[]) {
  return sessions.filter((session) => session.status === "scheduled").length;
}

export function courseWithCanonicalSessions(course: Course, sessions: ClassSession[]) {
  const normalized = normalizeClassSessions(sessions);
  return {
    ...course,
    classSessions: normalized,
    totalClasses:
      normalized.length > 0 ? scheduledSessionCount(normalized) : course.totalClasses,
  };
}

export function generateScheduledSessions(
  classes: ClassBlock[],
  startDate: string,
  endDate: string
) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const sessions: ClassSession[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, "0"),
      String(cursor.getDate()).padStart(2, "0"),
    ].join("-");

    for (const block of classes) {
      if (block.day !== cursor.getDay()) continue;
      sessions.push({
        date,
        start: normalizeSessionTime(block.start),
        end: normalizeSessionTime(block.end),
        room: block.room,
        status: "scheduled",
        note: GENERATED_SCHEDULE_NOTE,
      });
    }
  }

  return normalizeClassSessions(sessions);
}
