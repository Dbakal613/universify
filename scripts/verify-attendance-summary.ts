import { calculateAttendanceSummary } from "../lib/attendance";
import type { AttendanceRecord, Course } from "../lib/types";

function isoDay(offset: number) {
  const date = new Date(Date.UTC(2026, 2, 2 + offset));
  return date.toISOString().slice(0, 10);
}

const course: Course = {
  id: "test-course",
  name: "Test",
  professor: "",
  email: "",
  autonomousHours: 0,
  totalClasses: 17,
  color: "",
  classes: [],
  classSessions: Array.from({ length: 38 }, (_, index) => ({
    id: `session-${index}`,
    date: isoDay(index),
    start: "10:00:00",
    status: index === 5 || index === 20 ? "cancelled" as const : "scheduled" as const,
  })),
  evaluations: [],
  gradeComponents: [],
  autonomousTasks: [],
};

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`${label}: esperado ${expected}, recibido ${actual}`);
}

const firstThree: AttendanceRecord = {
  attended: 1,
  total: 3,
  sessions: [
    { sessionId: "session-0", date: isoDay(0), start: "10:00:00", status: "attended" },
    { sessionId: "session-1", date: isoDay(1), start: "10:00:00", status: "absent" },
    { sessionId: "session-2", date: isoDay(2), start: "10:00:00", status: "justified" },
  ],
};

const early = calculateAttendanceSummary(course, firstThree, isoDay(2));
assertEqual("sesiones ocurridas", early.occurred, 3);
assertEqual("total canónico ignora totalClasses antiguo", early.total, 36);
assertEqual("asistidas", early.attended, 1);
assertEqual("faltas", early.absent, 1);
assertEqual("justificadas", early.justified, 1);
assertEqual("futuras no son faltas", early.unregistered, 0);
assertEqual("porcentaje excluye justificadas", early.percentage, 50);

const afterCancelled = calculateAttendanceSummary(course, firstThree, isoDay(5));
assertEqual("cancelada no cuenta como ocurrida", afterCancelled.occurred, 5);
assertEqual("cancelada no cambia total", afterCancelled.total, 36);

console.log("Casos críticos de asistencia: OK");
