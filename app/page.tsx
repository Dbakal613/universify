"use client";

import { useEffect, useMemo, useState } from "react";

type EvaluationKind = "control" | "prueba" | "entrega" | "examen" | "actividad";

type Evaluation = {
  name: string;
  date: string;
  detail?: string;
  kind: EvaluationKind;
};

type GradeComponent = {
  name: string;
  weight: number;
};

type ClassBlock = {
  day: number; // 1=Lunes ... 6=Sábado
  start: string;
  end: string;
  room?: string;
};

type Course = {
  id: string;
  name: string;
  professor: string;
  email: string;
  autonomousHours: number;
  attendanceRequired?: number;
  totalClasses: number;
  attendanceNote?: string;
  color: string;
  evaluations: Evaluation[];
  gradeComponents: GradeComponent[];
  classes: ClassBlock[];
};

type AttendanceRecord = {
  attended: number;
  total: number;
};

type SessionStatus = "pending" | "done-early" | "done-on-time" | "unfinished";

type ShabbatRange = {
  start: string;
  end: string;
};

type StudySession = {
  id: string;
  date: string;
  courseId: string;
  evaluationName: string;
  title: string;
  minutes: number;
  start?: string;
  end?: string;
  urgency: "green" | "yellow" | "red";
};

const courses: Course[] = [
  {
    id: "economia",
    name: "Economía II",
    professor: "Agustín Villaseca",
    email: "avillaseca@uandes.cl",
    autonomousHours: 4,
    totalClasses: 32,
    attendanceNote: "El syllabus no informa un mínimo de asistencia.",
    color: "bg-blue-100",
    classes: [
      { day: 3, start: "08:30", end: "10:20", room: "H-101 / HUM" },
      { day: 4, start: "10:30", end: "12:20", room: "H-101 / HUM" },
    ],
    evaluations: [
      { name: "Control 1", date: "2026-08-12", kind: "control", detail: "Cap. 2 pág. 27 y Cap. 23 págs. 483–488" },
      { name: "Control 2", date: "2026-08-19", kind: "control", detail: "Cap. 23 págs. 488–494" },
      { name: "Control 3", date: "2026-08-26", kind: "control", detail: "Cap. 23 págs. 494–501 y Cap. 24 págs. 505–509" },
      { name: "Control 4", date: "2026-09-02", kind: "control", detail: "Cap. 24 págs. 509–513" },
      { name: "Prueba 1", date: "2026-09-03", kind: "prueba" },
      { name: "Control 5", date: "2026-09-16", kind: "control", detail: "Cap. 24 págs. 513–518" },
      { name: "Control 6", date: "2026-09-23", kind: "control", detail: "Cap. 25 págs. 523–544" },
      { name: "Control 7", date: "2026-09-30", kind: "control", detail: "Cap. 26 págs. 547–556" },
      { name: "Control 8", date: "2026-10-07", kind: "control", detail: "Cap. 26 págs. 556–566" },
      { name: "Control 9", date: "2026-10-14", kind: "control", detail: "Cap. 29 págs. 609–622" },
      { name: "Control 10", date: "2026-10-21", kind: "control", detail: "Cap. 29 págs. 622–629 y Cap. 30 págs. 633–639" },
      { name: "Control 11", date: "2026-10-28", kind: "control", detail: "Cap. 30 págs. 639–654" },
      { name: "Control 12", date: "2026-11-04", kind: "control", detail: "Cap. 31 págs. 659–673" },
      { name: "Prueba 2", date: "2026-11-12", kind: "prueba" },
      { name: "Control 13", date: "2026-11-18", kind: "control", detail: "Cap. 31 págs. 673–679" },
      { name: "Examen final", date: "2026-12-03", kind: "examen" },
    ],
    gradeComponents: [
      { name: "Prueba 1", weight: 20 },
      { name: "Prueba 2", weight: 25 },
      { name: "Controles de lectura", weight: 25 },
      { name: "Examen final", weight: 30 },
    ],
  },
  {
    id: "estadistica",
    name: "Estadística II",
    professor: "Por confirmar",
    email: "",
    autonomousHours: 4,
    totalClasses: 32,
    attendanceNote: "A la espera del syllabus del curso.",
    color: "bg-slate-200",
    classes: [
      { day: 2, start: "08:30", end: "10:20", room: "C-117 / CIEN" },
      { day: 4, start: "08:30", end: "10:20", room: "C-117 / CIEN" },
    ],
    evaluations: [],
    gradeComponents: [],
  },
  {
    id: "operaciones",
    name: "Introducción a la Gestión de Operaciones",
    professor: "Franz Carrillo-Higueras",
    email: "fcarrillo@uandes.cl",
    autonomousHours: 5,
    totalClasses: 34,
    attendanceNote: "El syllabus no informa un mínimo de asistencia.",
    color: "bg-amber-100",
    classes: [
      { day: 2, start: "10:30", end: "12:20", room: "H-101 / HUM" },
      { day: 3, start: "15:30", end: "17:20", room: "H-101 / HUM" },
    ],
    evaluations: [
      { name: "Evaluación Casa de la Calidad", date: "2026-08-18", kind: "actividad", detail: "Casa de la Calidad" },
      { name: "Informe de avance y presentación", date: "2026-09-09", kind: "entrega", detail: "Trabajo semestral" },
      { name: "Prueba 1", date: "2026-09-23", kind: "prueba" },
      { name: "Actividad gráficos de proceso", date: "2026-09-29", kind: "actividad" },
      { name: "Prueba 2", date: "2026-11-04", kind: "prueba" },
      { name: "Presentación trabajo semestral", date: "2026-11-11", kind: "entrega" },
      { name: "Examen final", date: "2026-12-01", kind: "examen" },
    ],
    gradeComponents: [
      { name: "Prueba 1", weight: 20 },
      { name: "Prueba 2", weight: 20 },
      { name: "Controles y actividades", weight: 10 },
      { name: "Trabajo grupal", weight: 20 },
      { name: "Examen final", weight: 30 },
    ],
  },
  {
    id: "cambio",
    name: "Desarrollo Organizacional y Gestión del Cambio",
    professor: "Claudia San Martín Henríquez",
    email: "csanmartin1@miuandes.cl",
    autonomousHours: 5,
    attendanceRequired: 60,
    totalClasses: 34,
    color: "bg-rose-100",
    classes: [
      { day: 1, start: "13:30", end: "15:20", room: "R-10 / REL" },
      { day: 3, start: "13:30", end: "15:20", room: "R-10 / REL" },
    ],
    evaluations: [
      { name: "Control de lectura 1", date: "2026-08-10", kind: "control", detail: "Cap. 5 págs. 146–171" },
      { name: "Evaluación 1", date: "2026-09-02", kind: "prueba", detail: "Cambio planeado y modelos" },
      { name: "Control de lectura 2", date: "2026-09-21", kind: "control", detail: "Intervención de la cultura organizacional" },
      { name: "Prueba 2", date: "2026-10-05", kind: "prueba", detail: "Desarrollo Organizacional" },
      { name: "Control de lectura 3", date: "2026-10-26", kind: "control", detail: "Estrategias para optimizar el ciclo de vida del colaborador" },
      { name: "Prueba 3", date: "2026-11-04", kind: "prueba", detail: "Plan de Desarrollo de Personas" },
      { name: "Examen final", date: "2026-11-24", kind: "examen" },
    ],
    gradeComponents: [
      { name: "Prueba 1", weight: 15 },
      { name: "Prueba 2", weight: 15 },
      { name: "Prueba 3", weight: 20 },
      { name: "Promedio controles de lectura", weight: 10 },
      { name: "Trabajos y actividades", weight: 10 },
      { name: "Examen final", weight: 30 },
    ],
  },
  {
    id: "estrategia",
    name: "Administración Estratégica",
    professor: "Verónica Schröder M.",
    email: "vschroder@uandes.cl",
    autonomousHours: 5,
    totalClasses: 29,
    attendanceNote: "El syllabus no informa un mínimo de asistencia.",
    color: "bg-violet-100",
    classes: [
      { day: 1, start: "10:30", end: "12:20", room: "C-120 / CIEN" },
      { day: 4, start: "13:30", end: "15:20", room: "C-120 / CIEN" },
    ],
    evaluations: [
      { name: "Control de lectura 1", date: "2026-08-24", kind: "control", detail: "Contenido asignado por la profesora" },
      { name: "Prueba 1", date: "2026-09-07", kind: "prueba", detail: "Semanas 1 a 5" },
      { name: "Entrega I trabajo grupal", date: "2026-09-14", kind: "entrega" },
      { name: "Control de lectura 2", date: "2026-10-08", kind: "control" },
      { name: "Entrega II trabajo grupal", date: "2026-10-19", kind: "entrega" },
      { name: "Prueba 2", date: "2026-11-09", kind: "prueba", detail: "Semanas 7 a 13" },
      { name: "Entrega final y evaluación individual", date: "2026-11-16", kind: "entrega" },
      { name: "Examen final", date: "2026-12-04", kind: "examen" },
    ],
    gradeComponents: [
      { name: "Prueba 1", weight: 15 },
      { name: "Prueba 2", weight: 20 },
      { name: "Promedio controles de lectura", weight: 10 },
      { name: "Promedio actividades en clases", weight: 10 },
      { name: "Trabajo grupal", weight: 15 },
      { name: "Examen final", weight: 30 },
    ],
  },
  {
    id: "etica",
    name: "Seminario de Ética Profesional",
    professor: "Kênio Estrela",
    email: "kdantas@miuandes.cl",
    autonomousHours: 3,
    attendanceRequired: 70,
    totalClasses: 16,
    attendanceNote: "Se excluye la semana suspendida y no se cuenta el examen como clase.",
    color: "bg-emerald-100",
    classes: [{ day: 3, start: "10:30", end: "12:20", room: "I-014 / ING" }],
    evaluations: [
      { name: "Control 1", date: "2026-08-19", kind: "control", detail: "Principios y valores éticos; toma de decisiones éticas" },
      { name: "Prueba 1", date: "2026-09-02", kind: "prueba", detail: "Contenidos vistos hasta la fecha" },
      { name: "Control 2", date: "2026-10-21", kind: "control", detail: "Ética comercial" },
      { name: "Prueba 2", date: "2026-11-18", kind: "prueba", detail: "Contenidos desde la Prueba 1" },
      { name: "Examen final", date: "2026-12-02", kind: "examen" },
    ],
    gradeComponents: [
      { name: "Prueba 1", weight: 20 },
      { name: "Prueba 2", weight: 20 },
      { name: "Control de lectura 1", weight: 10 },
      { name: "Control de lectura 2", weight: 10 },
      { name: "Participación y asistencia", weight: 10 },
      { name: "Examen final", weight: 30 },
    ],
  },
  {
    id: "hospitalidad",
    name: "Gestión de Hospitalidad",
    professor: "Felipe Wilson",
    email: "fwilson@uandes.cl",
    autonomousHours: 2,
    attendanceRequired: 50,
    totalClasses: 13,
    attendanceNote: "El syllabus excluye feriados y sesiones de evaluación.",
    color: "bg-cyan-100",
    classes: [{ day: 1, start: "15:30", end: "17:20", room: "C-205 / CIEN" }],
    evaluations: [
      { name: "Reporte charla 1", date: "2026-08-14", kind: "entrega", detail: "Aprendizajes y relación con conceptos del ramo" },
      { name: "Reporte charla 2", date: "2026-08-21", kind: "entrega" },
      { name: "Entrega grupal 1", date: "2026-09-07", kind: "entrega", detail: "Investigación sobre hotelería en Chile" },
      { name: "Reporte charla 3", date: "2026-09-11", kind: "entrega" },
      { name: "Prueba de contenido 1", date: "2026-09-14", kind: "prueba", detail: "Unidad I: Hotelería" },
      { name: "Reporte charla 4", date: "2026-10-10", kind: "entrega" },
      { name: "Reporte charla 5", date: "2026-10-23", kind: "entrega" },
      { name: "Entrega grupal 2", date: "2026-10-26", kind: "entrega", detail: "Eventos o MICE en Chile" },
      { name: "Prueba de contenido 2", date: "2026-11-02", kind: "prueba", detail: "Eventos y Turismo" },
    ],
    gradeComponents: [
      { name: "Informe grupal 1", weight: 20 },
      { name: "Informe grupal 2", weight: 20 },
      { name: "Prueba 1", weight: 20 },
      { name: "Prueba 2", weight: 15 },
      { name: "Promedio informes de charlas", weight: 15 },
      { name: "Radar de Hospitality", weight: 10 },
    ],
  },
];

const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function daysUntil(date: string, base = new Date()) {
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

function urgencyFromDays(days: number): StudySession["urgency"] {
  if (days <= 2) return "red";
  if (days <= 4) return "yellow";
  return "green";
}

function sessionsFor(kind: EvaluationKind) {
  if (kind === "control") return 5;
  if (kind === "prueba") return 7;
  if (kind === "entrega") return 6;
  if (kind === "examen") return 10;
  return 4;
}

function minutesFor(course: Course, evaluation: Evaluation) {
  if (evaluation.kind === "control") return 40;
  if (evaluation.kind === "prueba") return Math.max(50, course.autonomousHours * 12);
  if (evaluation.kind === "entrega") return 45;
  if (evaluation.kind === "examen") return 70;
  return 35;
}

function taskTitle(evaluation: Evaluation, session: number, total: number) {
  if (evaluation.kind === "control" && evaluation.detail) {
    return `Lectura ${session}/${total}: ${evaluation.detail}`;
  }
  if (evaluation.kind === "entrega") {
    return `Avance ${session}/${total} de ${evaluation.name}`;
  }
  return `Preparación ${session}/${total} para ${evaluation.name}`;
}

function freeSlotsForDate(date: Date, shabbatRanges: ShabbatRange[]) {
  const day = date.getDay();
  const classBlocks = courses
    .flatMap((course) =>
      course.classes
        .filter((item) => item.day === day)
        .map((item) => ({
          start: timeToMinutes(item.start),
          end: timeToMinutes(item.end),
        }))
    )
    .sort((a, b) => a.start - b.start);

  const windows = [
    { start: 8 * 60, end: 12 * 60 + 30 },
    { start: 14 * 60, end: 18 * 60 },
    { start: 19 * 60 + 30, end: 22 * 60 },
  ];

  const dateKey = dateOnly(date);
  const activeShabbat = shabbatRanges.find(
    (range) =>
      dateKey >= range.start.slice(0, 10) &&
      dateKey <= range.end.slice(0, 10)
  );

  const blocked: { start: number; end: number }[] = [...classBlocks];

  if (activeShabbat) {
    const shabbatStart = new Date(activeShabbat.start);
    const shabbatEnd = new Date(activeShabbat.end);

    if (dateKey === activeShabbat.start.slice(0, 10)) {
      blocked.push({
        start: shabbatStart.getHours() * 60 + shabbatStart.getMinutes(),
        end: 24 * 60,
      });
    }

    if (dateKey === activeShabbat.end.slice(0, 10)) {
      blocked.push({
        start: 0,
        end: shabbatEnd.getHours() * 60 + shabbatEnd.getMinutes(),
      });
    }
  }

  blocked.sort((a, b) => a.start - b.start);

  const free: { start: number; end: number }[] = [];

  for (const window of windows) {
    let cursor = window.start;

    for (const block of blocked) {
      if (block.end <= window.start || block.start >= window.end) continue;

      if (block.start > cursor) {
        free.push({ start: cursor, end: block.start });
      }

      cursor = Math.max(cursor, block.end);
    }

    if (cursor < window.end) {
      free.push({ start: cursor, end: window.end });
    }
  }

  return free.filter((slot) => slot.end - slot.start >= 30);
}

function buildStudyPlan(baseDate: Date, shabbatRanges: ShabbatRange[]) {
  const sessions: StudySession[] = [];
  const upcoming = courses
    .flatMap((course) =>
      course.evaluations.map((evaluation) => ({ course, evaluation }))
    )
    .filter(({ evaluation }) => daysUntil(evaluation.date, baseDate) >= 0)
    .sort((a, b) => a.evaluation.date.localeCompare(b.evaluation.date))
    .slice(0, 12);

  for (const { course, evaluation } of upcoming) {
    const evaluationDate = new Date(`${evaluation.date}T12:00:00`);
    const availableDays = Math.max(1, daysUntil(evaluation.date, baseDate));
    const count = Math.min(sessionsFor(evaluation.kind), availableDays);
    const firstDate = new Date(evaluationDate);
    firstDate.setDate(evaluationDate.getDate() - count);

    for (let index = 0; index < count; index += 1) {
      const date = new Date(firstDate);
      date.setDate(firstDate.getDate() + index);
      if (date < new Date(baseDate.toDateString())) continue;

      sessions.push({
        id: `${course.id}-${evaluation.name}-${index}`,
        date: dateOnly(date),
        courseId: course.id,
        evaluationName: evaluation.name,
        title: taskTitle(evaluation, index + 1, count),
        minutes: minutesFor(course, evaluation),
        urgency: urgencyFromDays(daysUntil(evaluation.date, date)),
      });
    }
  }

  const byDate = new Map<string, StudySession[]>();

  for (const session of sessions) {
    const list = byDate.get(session.date) ?? [];
    list.push(session);
    byDate.set(session.date, list);
  }

  const scheduled: StudySession[] = [];

  for (const [dateKey, list] of byDate.entries()) {
    const date = new Date(`${dateKey}T12:00:00`);
    const slots = freeSlotsForDate(date, shabbatRanges);
    let slotIndex = 0;
    let cursor = slots[0]?.start ?? 19 * 60 + 30;

    const ordered = [...list].sort((a, b) => {
      const evalA = courses
        .find((course) => course.id === a.courseId)
        ?.evaluations.find((evaluation) => evaluation.name === a.evaluationName);
      const evalB = courses
        .find((course) => course.id === b.courseId)
        ?.evaluations.find((evaluation) => evaluation.name === b.evaluationName);

      return (evalA?.date ?? "").localeCompare(evalB?.date ?? "");
    });

    for (const session of ordered) {
      while (
        slotIndex < slots.length &&
        cursor + session.minutes > slots[slotIndex].end
      ) {
        slotIndex += 1;
        cursor = slots[slotIndex]?.start ?? cursor;
      }

      if (slotIndex < slots.length) {
        const start = cursor;
        const end = start + session.minutes;
        scheduled.push({
          ...session,
          start: minutesToTime(start),
          end: minutesToTime(end),
        });
        cursor = end + 15;
      } else {
        scheduled.push(session);
      }
    }
  }

  return scheduled.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (a.start ?? "99:99").localeCompare(b.start ?? "99:99");
  });
}


async function fetchShabbatRange(referenceDate: Date): Promise<ShabbatRange | null> {
  const gy = referenceDate.getFullYear();
  const gm = referenceDate.getMonth() + 1;
  const gd = referenceDate.getDate();

  const url =
    `https://www.hebcal.com/shabbat?cfg=json&geonameid=3871336&M=on&leyning=off` +
    `&gy=${gy}&gm=${gm}&gd=${gd}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const candle = data.items?.find(
    (item: { category?: string }) => item.category === "candles"
  );
  const havdalah = data.items?.find(
    (item: { category?: string }) => item.category === "havdalah"
  );

  if (!candle?.date || !havdalah?.date) return null;

  return {
    start: candle.date,
    end: havdalah.date,
  };
}


function startOfCalendarMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function calendarDays(date: Date) {
  const first = startOfCalendarMonth(date);
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function shabbatForDate(date: Date, ranges: ShabbatRange[]) {
  const key = dateOnly(date);
  return ranges.find(
    (range) =>
      key >= range.start.slice(0, 10) &&
      key <= range.end.slice(0, 10)
  );
}


const WEEK_START_MINUTES = 8 * 60 + 30;
const WEEK_END_MINUTES = 17 * 60 + 50;
const WEEK_TOTAL_MINUTES = WEEK_END_MINUTES - WEEK_START_MINUTES;
const WEEK_TIMELINE_HEIGHT = 700;

function timelineTop(time: string) {
  const minutes = Math.max(
    WEEK_START_MINUTES,
    Math.min(timeToMinutes(time), WEEK_END_MINUTES)
  );
  return ((minutes - WEEK_START_MINUTES) / WEEK_TOTAL_MINUTES) * WEEK_TIMELINE_HEIGHT;
}

function timelineHeight(start: string, end: string) {
  const startMinutes = Math.max(WEEK_START_MINUTES, timeToMinutes(start));
  const endMinutes = Math.min(WEEK_END_MINUTES, timeToMinutes(end));
  return Math.max(
    28,
    ((endMinutes - startMinutes) / WEEK_TOTAL_MINUTES) * WEEK_TIMELINE_HEIGHT
  );
}

function visibleTimelineHours() {
  return ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30", "17:30"];
}

function weeklyRows() {
  return Array.from({ length: 14 }, (_, index) => {
    const start = 8 * 60 + 30 + index * 60;
    return {
      start,
      end: start + 60,
      label: minutesToTime(start),
    };
  });
}

function weightedSummary(
  course: Course,
  courseGrades: Record<string, string>,
  target: number
) {
  let enteredWeight = 0;
  let contribution = 0;

  for (const component of course.gradeComponents) {
    const value = Number(courseGrades[component.name]);

    if (Number.isFinite(value) && value >= 1 && value <= 7) {
      enteredWeight += component.weight;
      contribution += value * (component.weight / 100);
    }
  }

  const remainingWeight = 100 - enteredWeight;
  const currentAverage =
    enteredWeight > 0 ? contribution / (enteredWeight / 100) : 0;
  const required =
    remainingWeight > 0
      ? (target - contribution) / (remainingWeight / 100)
      : null;

  return { enteredWeight, remainingWeight, currentAverage, required };
}

function urgencyClasses(urgency: StudySession["urgency"]) {
  if (urgency === "red") {
    return {
      badge: "bg-red-100 text-red-700",
      border: "border-red-300",
      label: "Urgente",
    };
  }

  if (urgency === "yellow") {
    return {
      badge: "bg-amber-100 text-amber-700",
      border: "border-amber-300",
      label: "Prioridad media",
    };
  }

  return {
    badge: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-300",
    label: "Con tiempo",
  };
}

export default function Home() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [grades, setGrades] = useState<Record<string, Record<string, string>>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [sessionStatus, setSessionStatus] = useState<Record<string, SessionStatus>>({});
  const [customActivities, setCustomActivities] = useState<Record<string, string[]>>({});
  const [shabbatRanges, setShabbatRanges] = useState<ShabbatRange[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(2026, new Date().getMonth(), 1)
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("universify-progress-v1");
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        setAttendance(saved.attendance ?? {});
        setGrades(saved.grades ?? {});
        setTargets(saved.targets ?? {});
        setSessionStatus(saved.sessionStatus ?? {});
        setCustomActivities(saved.customActivities ?? {});
      } catch {
        // Ignore malformed local data.
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    localStorage.setItem(
      "universify-progress-v1",
      JSON.stringify({
        attendance,
        grades,
        targets,
        sessionStatus,
        customActivities,
      })
    );
  }, [
    attendance,
    grades,
    targets,
    sessionStatus,
    customActivities,
    hydrated,
  ]);

  useEffect(() => {
    async function loadShabbatTimes() {
      const first = new Date();
      const second = new Date();
      second.setDate(first.getDate() + 7);

      const ranges = await Promise.all([
        fetchShabbatRange(first),
        fetchShabbatRange(second),
      ]);

      setShabbatRanges(
        ranges.filter((range): range is ShabbatRange => Boolean(range))
      );
    }

    loadShabbatTimes();
  }, []);

  const now = new Date();
  const today = dateOnly(now);
  const todayName = dayNames[now.getDay()];

  const studyPlan = useMemo(
    () => buildStudyPlan(now, shabbatRanges),
    [today, shabbatRanges]
  );

  const nextEvaluations = courses
    .flatMap((course) =>
      course.evaluations.map((evaluation) => ({ course, evaluation }))
    )
    .filter(({ evaluation }) => daysUntil(evaluation.date) >= 0)
    .sort((a, b) => a.evaluation.date.localeCompare(b.evaluation.date))
    .slice(0, 4);

  const todaySessions = nextEvaluations.map(({ course, evaluation }) => {
    const planned = studyPlan.find(
      (session) =>
        session.date === today &&
        session.courseId === course.id &&
        session.evaluationName === evaluation.name
    );

    return (
      planned ?? {
        id: `${course.id}-${evaluation.name}-today`,
        date: today,
        courseId: course.id,
        evaluationName: evaluation.name,
        title: evaluation.detail
          ? `Comenzar preparación: ${evaluation.detail}`
          : `Comenzar preparación para ${evaluation.name}`,
        minutes: minutesFor(course, evaluation),
        urgency: urgencyFromDays(daysUntil(evaluation.date)),
      }
    );
  });

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    return date;
  });

  const todayCourses = courses.filter((course) =>
    course.classes.some((item) => item.day === now.getDay())
  );

  if (selectedCourse) {
    const record = attendance[selectedCourse.id] ?? {
      attended: 0,
      total: 0,
    };
    const attendancePercentage =
      (record.attended / selectedCourse.totalClasses) * 100;
    const classValue = 100 / selectedCourse.totalClasses;
    const minimumClasses = selectedCourse.attendanceRequired
      ? Math.ceil(
          selectedCourse.totalClasses *
            (selectedCourse.attendanceRequired / 100)
        )
      : null;

    const target = targets[selectedCourse.id] ?? 5;
    const summary = weightedSummary(
      selectedCourse,
      grades[selectedCourse.id] ?? {},
      target
    );

    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => setSelectedCourse(null)}
            className="mb-6 rounded-xl border bg-white px-4 py-2"
          >
            ← Volver
          </button>

          <section className={`rounded-3xl p-8 ${selectedCourse.color}`}>
            <h1 className="text-3xl font-bold">{selectedCourse.name}</h1>
            <p className="mt-3">{selectedCourse.professor}</p>
            {selectedCourse.email && (
              <a href={`mailto:${selectedCourse.email}`} className="underline">
                {selectedCourse.email}
              </a>
            )}
            <div className="mt-3 space-y-1">
              {selectedCourse.classes.map((item, index) => (
                <p key={index}>
                  {dayNames[item.day]} {item.start}–{item.end}
                  {item.room ? ` · ${item.room}` : ""}
                </p>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Asistencia</h2>

            <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{ width: `${Math.min(attendancePercentage, 100)}%` }}
              />
            </div>

            <p className="mt-3 text-3xl font-bold">
              {attendancePercentage.toFixed(1)}%
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {record.attended} asistidas de {selectedCourse.totalClasses} clases
              · cada clase vale {classValue.toFixed(1)}%
            </p>

            {selectedCourse.attendanceRequired ? (
              <p className="mt-1 text-sm text-slate-500">
                Mínimo: {selectedCourse.attendanceRequired}% · debes asistir a{" "}
                {minimumClasses} clases
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                {selectedCourse.attendanceNote}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() =>
                  setAttendance((previous) => ({
                    ...previous,
                    [selectedCourse.id]: {
                      attended: Math.min(
                        record.attended + 1,
                        selectedCourse.totalClasses
                      ),
                      total: Math.min(
                        record.total + 1,
                        selectedCourse.totalClasses
                      ),
                    },
                  }))
                }
                className="rounded-xl bg-black px-4 py-2 text-white"
              >
                Asistí
              </button>

              <button
                onClick={() =>
                  setAttendance((previous) => ({
                    ...previous,
                    [selectedCourse.id]: {
                      attended: record.attended,
                      total: Math.min(
                        record.total + 1,
                        selectedCourse.totalClasses
                      ),
                    },
                  }))
                }
                className="rounded-xl border px-4 py-2"
              >
                Falté
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Notas y simulador</h2>

            <div className="mt-4 space-y-3">
              {selectedCourse.gradeComponents.map((component) => {
                const isEconomiaControls =
                  selectedCourse.id === "economia" &&
                  component.name === "Controles de lectura";

                if (isEconomiaControls) {
                  const controlNames = Array.from(
                    { length: 13 },
                    (_, index) => `Control ${index + 1}`
                  );

                  const enteredControls = controlNames
                    .map((name) =>
                      Number(grades[selectedCourse.id]?.[name] ?? "")
                    )
                    .filter(
                      (value) =>
                        Number.isFinite(value) && value >= 1 && value <= 7
                    );

                  const controlsAverage =
                    enteredControls.length > 0
                      ? enteredControls.reduce((sum, value) => sum + value, 0) /
                        enteredControls.length
                      : null;

                  const groupKey = `${selectedCourse.id}-controles`;
                  const isExpanded = expandedGroups[groupKey] ?? false;

                  return (
                    <div key={component.name} className="rounded-2xl border">
                      <button
                        onClick={() =>
                          setExpandedGroups((previous) => ({
                            ...previous,
                            [groupKey]: !isExpanded,
                          }))
                        }
                        className="flex w-full items-center justify-between gap-4 p-4 text-left"
                      >
                        <div>
                          <p className="font-medium">Controles de lectura</p>
                          <p className="text-sm text-slate-500">
                            Ponderación total: {component.weight}%
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold">
                            {controlsAverage === null
                              ? "Sin notas"
                              : `Promedio ${controlsAverage.toFixed(2)}`}
                          </p>
                          <p className="text-sm text-slate-500">
                            {isExpanded ? "Ocultar" : "Ver controles"}
                          </p>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            {controlNames.map((controlName) => (
                              <div
                                key={controlName}
                                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                              >
                                <label className="text-sm font-medium">
                                  {controlName}
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="7"
                                  step="0.1"
                                  value={
                                    grades[selectedCourse.id]?.[controlName] ??
                                    ""
                                  }
                                  onChange={(event) => {
                                    const nextValue = event.target.value;

                                    setGrades((previous) => {
                                      const nextCourseGrades = {
                                        ...(previous[selectedCourse.id] ?? {}),
                                        [controlName]: nextValue,
                                      };

                                      const nextEntered = controlNames
                                        .map((name) =>
                                          Number(nextCourseGrades[name] ?? "")
                                        )
                                        .filter(
                                          (value) =>
                                            Number.isFinite(value) &&
                                            value >= 1 &&
                                            value <= 7
                                        );

                                      const nextAverage =
                                        nextEntered.length > 0
                                          ? nextEntered.reduce(
                                              (sum, value) => sum + value,
                                              0
                                            ) / nextEntered.length
                                          : "";

                                      return {
                                        ...previous,
                                        [selectedCourse.id]: {
                                          ...nextCourseGrades,
                                          [component.name]:
                                            nextAverage === ""
                                              ? ""
                                              : String(nextAverage),
                                        },
                                      };
                                    });
                                  }}
                                  placeholder="Nota"
                                  className="w-24 rounded-xl border bg-white px-3 py-2"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                const isActivityGroup =
                  component.name.toLowerCase().includes("actividades");

                if (isActivityGroup) {
                  const groupKey = `${selectedCourse.id}-${component.name}`;
                  const activityNames = customActivities[groupKey] ?? [];
                  const enteredActivities = activityNames
                    .map((name) =>
                      Number(grades[selectedCourse.id]?.[name] ?? "")
                    )
                    .filter(
                      (value) =>
                        Number.isFinite(value) && value >= 1 && value <= 7
                    );

                  const activityAverage =
                    enteredActivities.length > 0
                      ? enteredActivities.reduce(
                          (sum, value) => sum + value,
                          0
                        ) / enteredActivities.length
                      : null;

                  const isExpanded = expandedGroups[groupKey] ?? false;

                  return (
                    <div key={component.name} className="rounded-2xl border">
                      <button
                        onClick={() =>
                          setExpandedGroups((previous) => ({
                            ...previous,
                            [groupKey]: !isExpanded,
                          }))
                        }
                        className="flex w-full items-center justify-between gap-4 p-4 text-left"
                      >
                        <div>
                          <p className="font-medium">{component.name}</p>
                          <p className="text-sm text-slate-500">
                            Ponderación total: {component.weight}%
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold">
                            {activityAverage === null
                              ? "Sin notas"
                              : `Promedio ${activityAverage.toFixed(2)}`}
                          </p>
                          <p className="text-sm text-slate-500">
                            {isExpanded ? "Ocultar" : "Ver actividades"}
                          </p>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t p-4">
                          <button
                            onClick={() => {
                              const nextNumber = activityNames.length + 1;
                              const nextName = `Actividad ${nextNumber}`;

                              setCustomActivities((previous) => ({
                                ...previous,
                                [groupKey]: [
                                  ...(previous[groupKey] ?? []),
                                  nextName,
                                ],
                              }));
                            }}
                            className="mb-4 rounded-xl bg-black px-4 py-2 text-sm text-white"
                          >
                            + Agregar actividad
                          </button>

                          {activityNames.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              Agrega cada actividad espontánea cuando el profesor la anuncie.
                            </p>
                          ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                              {activityNames.map((activityName) => (
                                <div
                                  key={activityName}
                                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                                >
                                  <label className="text-sm font-medium">
                                    {activityName}
                                  </label>

                                  <input
                                    type="number"
                                    min="1"
                                    max="7"
                                    step="0.1"
                                    value={
                                      grades[selectedCourse.id]?.[
                                        activityName
                                      ] ?? ""
                                    }
                                    onChange={(event) => {
                                      const nextValue = event.target.value;

                                      setGrades((previous) => {
                                        const nextCourseGrades = {
                                          ...(previous[selectedCourse.id] ?? {}),
                                          [activityName]: nextValue,
                                        };

                                        const nextEntered = activityNames
                                          .map((name) =>
                                            Number(nextCourseGrades[name] ?? "")
                                          )
                                          .filter(
                                            (value) =>
                                              Number.isFinite(value) &&
                                              value >= 1 &&
                                              value <= 7
                                          );

                                        const nextAverage =
                                          nextEntered.length > 0
                                            ? nextEntered.reduce(
                                                (sum, value) => sum + value,
                                                0
                                              ) / nextEntered.length
                                            : "";

                                        return {
                                          ...previous,
                                          [selectedCourse.id]: {
                                            ...nextCourseGrades,
                                            [component.name]:
                                              nextAverage === ""
                                                ? ""
                                                : String(nextAverage),
                                          },
                                        };
                                      });
                                    }}
                                    placeholder="Nota"
                                    className="w-24 rounded-xl border bg-white px-3 py-2"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <article
                    key={component.name}
                    className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_110px]"
                  >
                    <div>
                      <p className="font-medium">{component.name}</p>
                      <p className="text-sm text-slate-500">
                        Ponderación: {component.weight}%
                      </p>
                    </div>

                    <input
                      type="number"
                      min="1"
                      max="7"
                      step="0.1"
                      value={
                        grades[selectedCourse.id]?.[component.name] ?? ""
                      }
                      onChange={(event) =>
                        setGrades((previous) => ({
                          ...previous,
                          [selectedCourse.id]: {
                            ...(previous[selectedCourse.id] ?? {}),
                            [component.name]: event.target.value,
                          },
                        }))
                      }
                      placeholder="Nota"
                      className="rounded-xl border px-3 py-2"
                    />
                  </article>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 md:grid-cols-3">
              <div>
                <p className="text-sm text-slate-500">
                  Promedio de notas ingresadas
                </p>
                <p className="mt-1 text-3xl font-bold">
                  {summary.enteredWeight > 0
                    ? summary.currentAverage.toFixed(2)
                    : "—"}
                </p>
                <p className="text-xs text-slate-400">
                  {summary.enteredWeight}% del ramo registrado
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-500">
                  Promedio final objetivo
                </label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  step="0.1"
                  value={target}
                  onChange={(event) =>
                    setTargets((previous) => ({
                      ...previous,
                      [selectedCourse.id]: Number(event.target.value),
                    }))
                  }
                  className="mt-2 w-full rounded-xl border bg-white px-3 py-2"
                />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Promedio necesario en lo pendiente
                </p>
                <p className="mt-1 text-3xl font-bold">
                  {summary.required === null
                    ? "Completo"
                    : summary.required > 7
                    ? "Sobre 7,0"
                    : summary.required < 1
                    ? "Ya alcanzado"
                    : summary.required.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">
                  Queda {summary.remainingWeight}% por evaluar
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Universify
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            Tu plan académico de hoy
          </h1>
          <p className="mt-2 text-slate-600">
            Clases y estudio organizados según tu horario real.
          </p>
        </header>

        <section className="rounded-3xl bg-slate-950 p-6 text-white md:p-8">
          <h2 className="text-xl font-semibold">Qué estudiar hoy</h2>
          <p className="mt-1 text-sm text-white/60">
            Siempre aparecen las cuatro evaluaciones futuras más próximas.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {todaySessions.map((session, index) => {
              const course = courses.find(
                (item) => item.id === session.courseId
              )!;
              const evaluation = course.evaluations.find(
                (item) => item.name === session.evaluationName
              )!;
              const remaining = daysUntil(evaluation.date);
              const style = urgencyClasses(session.urgency);
              const status = sessionStatus[session.id] ?? "pending";

              return (
                <article
                  key={session.id}
                  className={`rounded-2xl border bg-white/10 p-5 ${style.border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-white/60">
                      Prioridad {index + 1}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${style.badge}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg font-semibold">{course.name}</h3>
                  <p className="mt-2 font-medium">{evaluation.name}</p>
                  <p className="mt-1 text-sm text-white/70">
                    {remaining === 0
                      ? "Es hoy"
                      : remaining === 1
                      ? "Queda 1 día"
                      : `Quedan ${remaining} días`}
                  </p>

                  <p className="mt-4">{session.title}</p>
                  <p className="mt-2 text-sm text-white/70">
                    {session.start && session.end
                      ? `${session.start}–${session.end}`
                      : "Horario flexible"}
                    {" · "}
                    {session.minutes} min
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        setSessionStatus((previous) => ({
                          ...previous,
                          [session.id]: "done-early",
                        }))
                      }
                      className={`rounded-xl px-3 py-2 text-sm ${
                        status === "done-early"
                          ? "bg-emerald-400 text-slate-950"
                          : "bg-white/10"
                      }`}
                    >
                      Terminé antes
                    </button>
                    <button
                      onClick={() =>
                        setSessionStatus((previous) => ({
                          ...previous,
                          [session.id]: "done-on-time",
                        }))
                      }
                      className={`rounded-xl px-3 py-2 text-sm ${
                        status === "done-on-time"
                          ? "bg-blue-300 text-slate-950"
                          : "bg-white/10"
                      }`}
                    >
                      Terminé justo
                    </button>
                    <button
                      onClick={() =>
                        setSessionStatus((previous) => ({
                          ...previous,
                          [session.id]: "unfinished",
                        }))
                      }
                      className={`rounded-xl px-3 py-2 text-sm ${
                        status === "unfinished"
                          ? "bg-red-300 text-slate-950"
                          : "bg-white/10"
                      }`}
                    >
                      No alcancé
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Horario semanal</h2>
          <p className="mt-1 text-sm text-slate-500">
            Las actividades ocupan visualmente todo su horario real. La vista termina a las 17:50.
          </p>

          {shabbatRanges[0] && (
            <div className="mt-4 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-900">
              <p className="font-semibold">Horarios de Shabat</p>
              <p className="mt-1">
                Encendido de velas:{" "}
                {new Intl.DateTimeFormat("es-CL", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(shabbatRanges[0].start))}
              </p>
              <p>
                Havdalá:{" "}
                {new Intl.DateTimeFormat("es-CL", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(shabbatRanges[0].end))}
              </p>
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[1120px]">
              <div className="grid grid-cols-[70px_repeat(7,minmax(140px,1fr))] gap-3">
                <div />
                {weekDays.map((date) => (
                  <div key={dateOnly(date)} className="px-2 pb-2">
                    <p className="text-sm font-semibold capitalize">
                      {new Intl.DateTimeFormat("es-CL", {
                        weekday: "long",
                      }).format(date)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat("es-CL", {
                        day: "numeric",
                        month: "short",
                      }).format(date)}
                    </p>
                  </div>
                ))}

                <div
                  className="relative"
                  style={{ height: `${WEEK_TIMELINE_HEIGHT}px` }}
                >
                  {visibleTimelineHours().map((hour) => (
                    <div
                      key={hour}
                      className="absolute right-2 text-xs text-slate-400"
                      style={{
                        top: `${timelineTop(hour) - 7}px`,
                      }}
                    >
                      {hour}
                    </div>
                  ))}
                </div>

                {weekDays.map((date) => {
                  const key = dateOnly(date);
                  const dayClasses = courses.flatMap((course) =>
                    course.classes
                      .filter((item) => item.day === date.getDay())
                      .map((item) => ({ course, item }))
                  );
                  const daySessions = studyPlan.filter(
                    (session) => session.date === key && session.start && session.end
                  );
                  const shabbat = shabbatForDate(date, shabbatRanges);

                  return (
                    <div
                      key={key}
                      className="relative rounded-2xl bg-slate-50"
                      style={{ height: `${WEEK_TIMELINE_HEIGHT}px` }}
                    >
                      {visibleTimelineHours().map((hour) => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 border-t border-slate-200/70"
                          style={{ top: `${timelineTop(hour)}px` }}
                        />
                      ))}

                      {shabbat && (() => {
                        const shabbatStart = new Date(shabbat.start);
                        const shabbatEnd = new Date(shabbat.end);
                        const sameStartDay = key === shabbat.start.slice(0, 10);
                        const sameEndDay = key === shabbat.end.slice(0, 10);

                        const startTime = sameStartDay
                          ? `${String(shabbatStart.getHours()).padStart(2, "0")}:${String(
                              shabbatStart.getMinutes()
                            ).padStart(2, "0")}`
                          : "08:30";

                        const endTime = sameEndDay
                          ? `${String(shabbatEnd.getHours()).padStart(2, "0")}:${String(
                              shabbatEnd.getMinutes()
                            ).padStart(2, "0")}`
                          : "17:50";

                        const startsBeforeEnd = timeToMinutes(startTime) < WEEK_END_MINUTES;
                        const endsAfterStart = timeToMinutes(endTime) > WEEK_START_MINUTES;

                        if (!startsBeforeEnd || !endsAfterStart) return null;

                        return (
                          <div
                            className="absolute left-2 right-2 rounded-xl bg-indigo-100/90 p-2 text-xs text-indigo-900"
                            style={{
                              top: `${timelineTop(startTime)}px`,
                              height: `${timelineHeight(startTime, endTime)}px`,
                            }}
                          >
                            <p className="font-semibold">Shabat</p>
                          </div>
                        );
                      })()}

                      {dayClasses.map(({ course, item }, index) => (
                        <div
                          key={`${course.id}-${index}`}
                          className={`absolute left-2 right-2 overflow-hidden rounded-xl p-2 shadow-sm ${course.color}`}
                          style={{
                            top: `${timelineTop(item.start)}px`,
                            height: `${timelineHeight(item.start, item.end)}px`,
                          }}
                        >
                          <p className="text-xs font-semibold">
                            {item.start}–{item.end}
                          </p>
                          <p className="mt-1 text-xs">{course.name}</p>
                          {item.room && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              {item.room}
                            </p>
                          )}
                        </div>
                      ))}

                      {daySessions.map((session) => {
                        const course = courses.find(
                          (item) => item.id === session.courseId
                        )!;

                        return (
                          <div
                            key={session.id}
                            className="absolute left-2 right-2 overflow-hidden rounded-xl border border-dashed border-slate-400 bg-white p-2 shadow-sm"
                            style={{
                              top: `${timelineTop(session.start!)}px`,
                              height: `${timelineHeight(
                                session.start!,
                                session.end!
                              )}px`,
                            }}
                          >
                            <p className="text-xs font-semibold">
                              {session.start}–{session.end}
                            </p>
                            <p className="mt-1 text-xs">{course.name}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Estudio · {session.minutes} min
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Calendario mensual</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ábrelo cuando quieras revisar las evaluaciones por mes.
              </p>
            </div>

            <button
              onClick={() => setCalendarOpen((current) => !current)}
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              {calendarOpen ? "Ocultar calendario" : "Ver calendario"}
            </button>
          </div>

          {calendarOpen && (
            <>
              <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() - 1,
                      1
                    )
                  )
                }
                className="rounded-xl border px-3 py-2"
              >
                ←
              </button>
              <p className="min-w-40 text-center font-semibold capitalize">
                {new Intl.DateTimeFormat("es-CL", {
                  month: "long",
                  year: "numeric",
                }).format(calendarMonth)}
              </p>
              <button
                onClick={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() + 1,
                      1
                    )
                  )
                }
                className="rounded-xl border px-3 py-2"
              >
                →
              </button>
            </div>

          <div className="mt-5 grid grid-cols-7 border-l border-t">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <div
                key={day}
                className="border-b border-r bg-slate-100 p-3 text-center text-sm font-semibold"
              >
                {day}
              </div>
            ))}

            {calendarDays(calendarMonth).map((date) => {
              const key = dateOnly(date);
              const evaluations = courses.flatMap((course) =>
                course.evaluations
                  .filter((evaluation) => evaluation.date === key)
                  .map((evaluation) => ({ course, evaluation }))
              );
              const belongsToMonth =
                date.getMonth() === calendarMonth.getMonth();

              return (
                <div
                  key={key}
                  className={`min-h-32 border-b border-r p-2 ${
                    belongsToMonth ? "bg-white" : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <p className="text-sm font-medium">{date.getDate()}</p>

                  <div className="mt-2 space-y-2">
                    {evaluations.map(({ course, evaluation }) => (
                      <button
                        key={`${course.id}-${evaluation.name}`}
                        onClick={() => setSelectedCourse(course)}
                        className={`w-full rounded-lg p-2 text-left ${course.color}`}
                      >
                        <p className="text-xs font-semibold">
                          {evaluation.name}
                        </p>
                        <p className="mt-1 text-[11px]">{course.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
            </>
          )}
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Clases de hoy y asistencia</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {todayCourses.length === 0 ? (
              <p className="text-slate-500">
                No tienes clases registradas hoy.
              </p>
            ) : (
              todayCourses.map((course) => {
                const record = attendance[course.id] ?? {
                  attended: 0,
                  total: 0,
                };
                const percentage =
                  (record.attended / course.totalClasses) * 100;
                const classToday = course.classes.find(
                  (item) => item.day === now.getDay()
                );

                return (
                  <article
                    key={course.id}
                    className={`rounded-2xl p-4 ${course.color}`}
                  >
                    <p className="font-semibold">{course.name}</p>
                    <p className="mt-1 text-sm">
                      {classToday?.start}–{classToday?.end}
                      {classToday?.room ? ` · ${classToday.room}` : ""}
                    </p>

                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>

                    <p className="mt-2 text-sm">
                      {record.attended}/{course.totalClasses} clases ·{" "}
                      {percentage.toFixed(1)}%
                    </p>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() =>
                          setAttendance((previous) => ({
                            ...previous,
                            [course.id]: {
                              attended: Math.min(
                                record.attended + 1,
                                course.totalClasses
                              ),
                              total: Math.min(
                                record.total + 1,
                                course.totalClasses
                              ),
                            },
                          }))
                        }
                        className="rounded-xl bg-black px-3 py-2 text-sm text-white"
                      >
                        Asistí
                      </button>
                      <button
                        onClick={() =>
                          setAttendance((previous) => ({
                            ...previous,
                            [course.id]: {
                              attended: record.attended,
                              total: Math.min(
                                record.total + 1,
                                course.totalClasses
                              ),
                            },
                          }))
                        }
                        className="rounded-xl border border-black/20 px-3 py-2 text-sm"
                      >
                        Falté
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-2xl font-semibold">Mis ramos</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const nextEvaluation = course.evaluations
                .filter((evaluation) => daysUntil(evaluation.date) >= 0)
                .sort((a, b) => a.date.localeCompare(b.date))[0];

              return (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  className={`rounded-3xl p-6 text-left transition hover:-translate-y-1 ${course.color}`}
                >
                  <h3 className="text-lg font-semibold">{course.name}</h3>
                  <p className="mt-2 text-sm">{course.professor}</p>
                  <p className="mt-5 text-sm font-medium">Próximo</p>
                  <p className="mt-1">
                    {nextEvaluation
                      ? `${nextEvaluation.name} · ${formatDate(
                          nextEvaluation.date
                        )}`
                      : "Sin evaluaciones registradas"}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}