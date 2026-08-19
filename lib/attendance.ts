import { dateOnly } from "./date";
import type {
  AttendanceRecord,
  AttendanceSession,
  ClassSession,
  Course,
} from "./types";

export type AttendanceSummary = {
  occurred: number;
  total: number | null;
  attended: number;
  absent: number;
  justified: number;
  unregistered: number;
  percentage: number | null;
};

export function attendanceRecordForClassSession(
  course: Course,
  record: AttendanceRecord | undefined,
  session: ClassSession
): AttendanceSession | undefined {
  const records = record?.sessions ?? [];
  const exact = records.find(
    (item) => item.date === session.date && item.start === session.start
  );
  if (exact) return exact;

  const sessionsOnDate = course.classSessions.filter(
    (item) => item.date === session.date && item.status !== "cancelled"
  );

  if (sessionsOnDate.length === 1) {
    return records.find((item) => item.date === session.date && !item.start);
  }

  return undefined;
}

export function calculateAttendanceSummary(
  course: Course,
  record: AttendanceRecord | undefined,
  today = dateOnly(new Date())
): AttendanceSummary {
  const occurredSessions = course.classSessions.filter(
    (session) => session.status !== "cancelled" && session.date <= today
  );

  let attended = 0;
  let absent = 0;
  let justified = 0;

  occurredSessions.forEach((session) => {
    const attendance = attendanceRecordForClassSession(course, record, session);
    if (attendance?.status === "attended") attended += 1;
    if (attendance?.status === "absent") absent += 1;
    if (attendance?.status === "justified") justified += 1;
  });

  const computable = attended + absent;
  const total =
    Number.isFinite(course.totalClasses) && course.totalClasses > 0
      ? course.totalClasses
      : course.classSessions.filter((session) => session.status !== "cancelled")
          .length || null;

  return {
    occurred: occurredSessions.length,
    total,
    attended,
    absent,
    justified,
    unregistered: occurredSessions.length - attended - absent - justified,
    percentage: computable > 0 ? (attended / computable) * 100 : null,
  };
}
