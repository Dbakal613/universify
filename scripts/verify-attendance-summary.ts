import { calculateAttendanceSummary } from "../lib/attendance";
import type { AttendanceRecord, Course } from "../lib/types";

function courseWithSessions(count: number, cancelledIndex?: number): Course {
  return {
    id: "test-course",
    name: "Test",
    professor: "",
    email: "",
    autonomousHours: 0,
    totalClasses: 36,
    color: "",
    classes: [],
    classSessions: Array.from({ length: count }, (_, index) => ({
      date: `2025-01-${String(index + 1).padStart(2, "0")}`,
      start: "10:00",
      status: index === cancelledIndex ? "cancelled" : "scheduled",
    })),
    evaluations: [],
    gradeComponents: [],
    autonomousTasks: [],
  };
}

function record(statuses: Array<"attended" | "absent" | "justified" | undefined>): AttendanceRecord {
  const sessions = statuses.flatMap((status, index) =>
    status
      ? [
          {
            date: `2025-01-${String(index + 1).padStart(2, "0")}`,
            start: "10:00",
            status,
          },
        ]
      : []
  );

  return {
    attended: sessions.filter((session) => session.status === "attended").length,
    total: sessions.length,
    sessions,
  };
}

function assertSummary(
  label: string,
  actual: ReturnType<typeof calculateAttendanceSummary>,
  expected: Partial<ReturnType<typeof calculateAttendanceSummary>>
) {
  Object.entries(expected).forEach(([key, value]) => {
    const actualValue = actual[key as keyof typeof actual];
    if (actualValue !== value) {
      throw new Error(`${label}: ${key} esperado ${value}, recibido ${actualValue}`);
    }
  });
}

assertSummary(
  "Caso A",
  calculateAttendanceSummary(
    courseWithSessions(3),
    record(["attended", "attended", "justified"]),
    "2025-12-31"
  ),
  { occurred: 3, total: 36, attended: 2, absent: 0, justified: 1, unregistered: 0, percentage: 100 }
);

assertSummary(
  "Caso B",
  calculateAttendanceSummary(
    courseWithSessions(10),
    record([
      "attended",
      "attended",
      "attended",
      "attended",
      "attended",
      "attended",
      "attended",
      "absent",
      "absent",
      "justified",
    ]),
    "2025-12-31"
  ),
  { occurred: 10, total: 36, attended: 7, absent: 2, justified: 1, unregistered: 0 }
);

const caseB = calculateAttendanceSummary(
  courseWithSessions(10),
  record([
    "attended",
    "attended",
    "attended",
    "attended",
    "attended",
    "attended",
    "attended",
    "absent",
    "absent",
    "justified",
  ]),
  "2025-12-31"
);
if (caseB.percentage === null || Math.abs(caseB.percentage - 77.7777777778) > 0.000001) {
  throw new Error(`Caso B: porcentaje inesperado ${caseB.percentage}`);
}

assertSummary(
  "Caso C",
  calculateAttendanceSummary(
    courseWithSessions(4),
    record(["attended", "absent", undefined, "justified"]),
    "2025-12-31"
  ),
  { occurred: 4, total: 36, attended: 1, absent: 1, justified: 1, unregistered: 1, percentage: 50 }
);

assertSummary(
  "Caso D",
  calculateAttendanceSummary(
    courseWithSessions(4, 3),
    record(["attended", "absent", "justified", undefined]),
    "2025-12-31"
  ),
  { occurred: 3, total: 36, attended: 1, absent: 1, justified: 1, unregistered: 0, percentage: 50 }
);

console.log("Casos A, B, C y D de asistencia: OK");
