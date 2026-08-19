"use server";

import type { ClassSession } from "@/lib/types";
import { createClient } from "@/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}(?::\d{2})?$/;

export type SessionAttendanceStatus = "attended" | "absent" | "justified";

export type RemoteClassSession = {
  id: string;
  courseId: string;
  date: string;
  start: string | null;
  end: string | null;
  room: string | null;
  topics: string | null;
  status: "scheduled" | "cancelled";
  note: string | null;
};

type ActionError = { success: false; error: string };

async function authenticatedContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) return null;
  return { supabase, userId };
}

async function ownsCourse(
  context: NonNullable<Awaited<ReturnType<typeof authenticatedContext>>>,
  courseId: string
) {
  if (!uuidPattern.test(courseId)) return false;

  const { data, error } = await context.supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .maybeSingle();

  return !error && Boolean(data);
}

function validSession(session: ClassSession) {
  return (
    datePattern.test(session.date) &&
    (!session.start || timePattern.test(session.start)) &&
    (!session.end || timePattern.test(session.end)) &&
    (!session.start || !session.end || session.start < session.end) &&
    (session.status === "scheduled" || session.status === "cancelled")
  );
}

function toRemoteSession(row: {
  id: string;
  course_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  topics: string | null;
  status: string;
  note: string | null;
}): RemoteClassSession {
  return {
    id: row.id,
    courseId: row.course_id,
    date: row.session_date,
    start: row.start_time,
    end: row.end_time,
    room: row.room,
    topics: row.topics,
    status: row.status as RemoteClassSession["status"],
    note: row.note,
  };
}

export async function getCourseClassSessions(
  courseId: string
): Promise<{ success: true; sessions: RemoteClassSession[] } | ActionError> {
  const context = await authenticatedContext();
  if (!context) return { success: false, error: "Debes iniciar sesión." };
  if (!(await ownsCourse(context, courseId))) {
    return { success: false, error: "No encontramos este ramo." };
  }

  const { data, error } = await context.supabase
    .from("course_class_sessions")
    .select("id, course_id, session_date, start_time, end_time, room, topics, status, note")
    .eq("course_id", courseId)
    .order("session_date")
    .order("start_time");

  if (error) {
    console.error("No fue posible cargar las sesiones de clase:", error);
    return { success: false, error: "No fue posible cargar las sesiones." };
  }

  return { success: true, sessions: (data ?? []).map(toRemoteSession) };
}

export async function syncCourseClassSessions(
  courseId: string,
  sessions: ClassSession[]
): Promise<{ success: true; sessions: RemoteClassSession[] } | ActionError> {
  const context = await authenticatedContext();
  if (!context) return { success: false, error: "Debes iniciar sesión." };
  if (!(await ownsCourse(context, courseId))) {
    return { success: false, error: "No encontramos este ramo." };
  }
  if (!Array.isArray(sessions) || sessions.some((session) => !validSession(session))) {
    return { success: false, error: "Las sesiones de clase no son válidas." };
  }

  for (const session of sessions) {
    let lookup = context.supabase
      .from("course_class_sessions")
      .select("id")
      .eq("course_id", courseId)
      .eq("session_date", session.date);

    lookup = session.start
      ? lookup.eq("start_time", session.start)
      : lookup.is("start_time", null);

    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) {
      console.error("No fue posible buscar la sesión de clase:", lookupError);
      return { success: false, error: "No fue posible sincronizar las sesiones." };
    }

    const values = {
      course_id: courseId,
      session_date: session.date,
      start_time: session.start ?? null,
      end_time: session.end ?? null,
      room: session.room?.trim() || null,
      topics: session.topics?.trim() || null,
      status: session.status,
      note: session.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const mutation = existing
      ? context.supabase
          .from("course_class_sessions")
          .update(values)
          .eq("id", existing.id)
          .eq("course_id", courseId)
      : context.supabase.from("course_class_sessions").insert(values);

    const { error: mutationError } = await mutation;
    if (mutationError) {
      console.error("No fue posible sincronizar la sesión de clase:", mutationError);
      return { success: false, error: "No fue posible sincronizar las sesiones." };
    }
  }

  return getCourseClassSessions(courseId);
}

export async function setSessionAttendance(input: {
  courseId: string;
  sessionId: string;
  status: SessionAttendanceStatus;
}): Promise<{ success: true } | ActionError> {
  const context = await authenticatedContext();
  if (!context) return { success: false, error: "Debes iniciar sesión." };
  if (
    !uuidPattern.test(input.courseId) ||
    !uuidPattern.test(input.sessionId) ||
    !(["attended", "absent", "justified"] as const).includes(input.status)
  ) {
    return { success: false, error: "La asistencia no es válida." };
  }
  if (!(await ownsCourse(context, input.courseId))) {
    return { success: false, error: "No encontramos este ramo." };
  }

  const { data: session, error: sessionError } = await context.supabase
    .from("course_class_sessions")
    .select("id, course_id, session_date, status")
    .eq("id", input.sessionId)
    .eq("course_id", input.courseId)
    .maybeSingle();

  if (sessionError || !session) {
    return { success: false, error: "No encontramos esta sesión de clase." };
  }
  if (session.status === "cancelled") {
    return { success: false, error: "No se registra asistencia en una clase cancelada." };
  }

  const { data: existing, error: lookupError } = await context.supabase
    .from("attendance_records")
    .select("id")
    .eq("user_id", context.userId)
    .eq("course_class_session_id", session.id)
    .maybeSingle();

  if (lookupError) {
    return { success: false, error: "No fue posible consultar la asistencia." };
  }

  const values = {
    course_id: input.courseId,
    user_id: context.userId,
    course_class_session_id: session.id,
    class_date: session.session_date,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  const mutation = existing
    ? context.supabase
        .from("attendance_records")
        .update(values)
        .eq("id", existing.id)
        .eq("user_id", context.userId)
    : context.supabase.from("attendance_records").insert(values);

  const { error } = await mutation;
  if (error) {
    console.error("No fue posible guardar la asistencia:", error);
    return { success: false, error: "No fue posible guardar la asistencia." };
  }

  return { success: true };
}

export async function clearSessionAttendance(input: {
  courseId: string;
  sessionId: string;
}): Promise<{ success: true } | ActionError> {
  const context = await authenticatedContext();
  if (!context) return { success: false, error: "Debes iniciar sesión." };
  if (!uuidPattern.test(input.courseId) || !uuidPattern.test(input.sessionId)) {
    return { success: false, error: "La sesión no es válida." };
  }
  if (!(await ownsCourse(context, input.courseId))) {
    return { success: false, error: "No encontramos este ramo." };
  }

  const { error } = await context.supabase
    .from("attendance_records")
    .delete()
    .eq("user_id", context.userId)
    .eq("course_id", input.courseId)
    .eq("course_class_session_id", input.sessionId);

  if (error) {
    console.error("No fue posible revertir la asistencia:", error);
    return { success: false, error: "No fue posible revertir la asistencia." };
  }

  return { success: true };
}
