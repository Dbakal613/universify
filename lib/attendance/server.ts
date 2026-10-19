import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  classSessionIdentity,
  normalizeClassSessions,
  normalizeSessionTime,
  GENERATED_SCHEDULE_NOTE,
} from "@/lib/class-sessions";
import type { ClassSession } from "@/lib/types";

type SessionRow = {
  id: string;
  course_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  topics: string | null;
  status: "scheduled" | "cancelled";
  note: string | null;
};

const sessionSelection =
  "id, course_id, session_date, start_time, end_time, room, topics, status, note";

export function sessionRowToClassSession(row: SessionRow): ClassSession {
  return {
    id: row.id,
    date: row.session_date,
    start: normalizeSessionTime(row.start_time),
    end: normalizeSessionTime(row.end_time),
    room: row.room ?? undefined,
    topics: row.topics ?? undefined,
    status: row.status,
    note: row.note ?? undefined,
  };
}

export async function loadCourseSessionRows(
  supabase: SupabaseClient,
  courseIds: string[]
) {
  if (courseIds.length === 0) {
    return { data: [] as SessionRow[], error: null };
  }

  const result = await supabase
    .from("course_class_sessions")
    .select(sessionSelection)
    .in("course_id", courseIds)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  return { data: (result.data ?? []) as SessionRow[], error: result.error };
}

export async function syncCanonicalCourseSessions(
  supabase: SupabaseClient,
  courseId: string,
  sessions: ClassSession[],
  options?: { retireGeneratedAfter?: string }
) {
  const normalized = normalizeClassSessions(sessions);
  if (normalized.length === 0) return { success: true as const };

  const loaded = await loadCourseSessionRows(supabase, [courseId]);
  if (loaded.error) return { success: false as const, error: loaded.error };

  const existingByIdentity = new Map(
    loaded.data.map((row) => [
      classSessionIdentity({
        date: row.session_date,
        start: normalizeSessionTime(row.start_time),
      }),
      row,
    ])
  );
  const inserts: Record<string, unknown>[] = [];
  const updates: Array<{ id: string; values: Record<string, unknown> }> = [];

  for (const session of normalized) {
    const values = {
      course_id: courseId,
      session_date: session.date,
      start_time: normalizeSessionTime(session.start) ?? null,
      end_time: normalizeSessionTime(session.end) ?? null,
      room: session.room ?? null,
      topics: session.topics ?? null,
      status: session.status,
      note: session.note ?? null,
      updated_at: new Date().toISOString(),
    };
    const existing = existingByIdentity.get(classSessionIdentity(session));
    if (existing) updates.push({ id: existing.id, values });
    else inserts.push(values);
  }

  if (options?.retireGeneratedAfter) {
    const desired = new Set(normalized.map(classSessionIdentity));
    for (const existing of loaded.data) {
      if (
        existing.note === GENERATED_SCHEDULE_NOTE &&
        existing.session_date >= options.retireGeneratedAfter &&
        existing.status === "scheduled" &&
        !desired.has(classSessionIdentity({
          date: existing.session_date,
          start: normalizeSessionTime(existing.start_time),
        }))
      ) {
        updates.push({
          id: existing.id,
          values: {
            status: "cancelled",
            note: "Cancelada al actualizar el horario del ramo.",
            updated_at: new Date().toISOString(),
          },
        });
      }
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("course_class_sessions").insert(inserts);
    if (error && error.code !== "23505") {
      return { success: false as const, error };
    }
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("course_class_sessions")
      .update(update.values)
      .eq("id", update.id)
      .eq("course_id", courseId);
    if (error) return { success: false as const, error };
  }

  return { success: true as const };
}
