import { calculateCourseGradeSummary, componentGrade } from "../lib/grades";
import type { Course, GradeItem } from "../lib/types";

function assertClose(label: string, actual: number | null, expected: number) {
  if (actual === null || Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${label}: esperado ${expected}, recibido ${actual}`);
  }
}

const controls: GradeItem[] = [
  { id: "c1", name: "C1", grade: 5 },
  { id: "c2", name: "C2", grade: 6 },
  { id: "c3", name: "C3", grade: 4 },
];
assertClose("promedio C1-C3", componentGrade(controls), 5);
assertClose("promedio con C4", componentGrade([...controls, { id: "c4", name: "C4", grade: 7 }]), 5.5);
assertClose("pendiente no cuenta como cero", componentGrade([...controls, { id: "c5", name: "C5" }]), 5);
assertClose("eliminar C2 recalcula", componentGrade(controls.filter((item) => item.id !== "c2")), 4.5);

const course: Course = {
  id: "course",
  name: "Curso",
  professor: "",
  email: "",
  autonomousHours: 0,
  totalClasses: 0,
  color: "",
  classes: [],
  classSessions: [],
  evaluations: [],
  gradeComponents: [
    { key: "controles", name: "Controles", weight: 20, kind: "grouped" },
    { key: "trabajo", name: "Trabajo en clase", weight: 20, kind: "grouped" },
    { key: "parcial", name: "Parcial", weight: 25, kind: "individual" },
    { key: "examen", name: "Examen", weight: 35, kind: "individual" },
  ],
  autonomousTasks: [],
};

const summary = calculateCourseGradeSummary(course, {
  controles: [...controls, { id: "c4", name: "C4", grade: 7 }, { id: "c5", name: "C5" }],
  trabajo: [],
  parcial: [{ id: "p", name: "Parcial", grade: 6 }],
  examen: [],
});
assertClose("promedio ponderado solo con categorías conocidas", summary.currentAverage, (5.5 * 20 + 6 * 25) / 45);
if (summary.enteredWeight !== 45 || summary.pendingItems !== 1) {
  throw new Error("El peso conocido o las pendientes no coinciden.");
}

console.log("Casos críticos de notas: OK");
