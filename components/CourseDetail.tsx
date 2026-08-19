"use client";

import Link from "next/link";

import AttendanceCard from "./AttendanceCard";
import CourseDocumentUpdater from "./CourseDocumentUpdater";
import GradeBook from "./GradeBook";
import PageShell from "./PageShell";
import { useProgress } from "./ProgressProvider";
import { calculateAttendanceSummary } from "../lib/attendance";
import {
  courseScheduleSummary,
  nextCourseEvaluation,
  splitEvaluations,
} from "../lib/course-display";
import { DAY_NAMES, formatDate } from "../lib/date";
import type { Course, Evaluation } from "../lib/types";
import { useSavedCourses } from "../lib/use-saved-courses";

const tabs = [
  { id: "resumen", label: "Resumen" },
  { id: "evaluaciones", label: "Evaluaciones" },
  { id: "notas", label: "Notas" },
  { id: "asistencia", label: "Asistencia" },
] as const;

type CourseTab = (typeof tabs)[number]["id"];

function isCourseTab(value: string): value is CourseTab {
  return tabs.some((tab) => tab.id === value);
}

function evaluationKindLabel(kind: Evaluation["kind"]) {
  const labels: Record<Evaluation["kind"], string> = {
    control: "Control",
    prueba: "Prueba",
    examen: "Examen",
    entrega: "Entrega",
    presentacion: "Presentación",
    actividad: "Actividad",
  };
  return labels[kind];
}

function currentGradeAverage(course: Course, grades: ReturnType<typeof useProgress>["grades"]) {
  let enteredWeight = 0;
  let contribution = 0;

  course.gradeComponents.forEach((component) => {
    const value = Number(grades[course.id]?.[component.name] ?? "");
    if (Number.isFinite(value) && value >= 1 && value <= 7) {
      enteredWeight += component.weight;
      contribution += value * (component.weight / 100);
    }
  });

  return enteredWeight > 0 ? contribution / (enteredWeight / 100) : null;
}

export default function CourseDetail({
  courseId,
  requestedTab,
}: {
  courseId: string;
  requestedTab: string;
}) {
  const { courses, isLoading, error, replaceCourse } = useSavedCourses();
  const { attendance, grades } = useProgress();
  const course = courses.find((item) => item.id === courseId);
  const activeTab: CourseTab = isCourseTab(requestedTab)
    ? requestedTab
    : "resumen";

  if (isLoading) {
    return (
      <PageShell title="Ramo">
        <p className="text-slate-500">Cargando ramo...</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Ramo">
        <p role="alert" className="text-slate-600">{error}</p>
      </PageShell>
    );
  }

  if (!course) {
    return (
      <PageShell title="No encontramos este ramo">
        <p className="text-slate-600">
          El ramo no existe o ya no está disponible en tus datos guardados.
        </p>
        <Link
          href="/ramos"
          className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
        >
          Volver a Mis ramos
        </Link>
      </PageShell>
    );
  }

  const nextEvaluation = nextCourseEvaluation(course);
  const schedule = courseScheduleSummary(course);
  const attendanceValue = calculateAttendanceSummary(
    course,
    attendance[course.id]
  ).percentage;
  const gradeAverage = currentGradeAverage(course, grades);
  const evaluations = splitEvaluations(course.evaluations);

  return (
    <main className="min-h-screen pb-24 md:ml-64 md:pb-8">
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <Link
          href="/ramos"
          className="inline-flex rounded-lg py-2 text-sm font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
        >
          ← Mis ramos
        </Link>

        <header className="mt-3 overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className={`h-2 ${course.color}`} />
          <div className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {course.name}
              </h1>
              <details className="relative">
                <summary
                  aria-label={`Opciones de ${course.name}`}
                  className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 [&::-webkit-details-marker]:hidden"
                >
                  ⋯
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <Link
                    href={`/ramos/${encodeURIComponent(course.id)}/editar`}
                    className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    style={{ color: "#334155" }}
                  >
                    Editar ramo
                  </Link>
                </div>
              </details>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>{course.professor ? `Prof. ${course.professor}` : "Profesor no informado"}</p>
              {schedule && <p>{schedule}</p>}
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Próxima evaluación
                </p>
                <p className="mt-1 font-semibold">
                  {nextEvaluation
                    ? `${nextEvaluation.name} · ${formatDate(nextEvaluation.date)}`
                    : "Sin evaluaciones pendientes"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Asistencia
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {attendanceValue === null ? "—" : `${attendanceValue.toFixed(1)}%`}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Promedio
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {gradeAverage === null ? "—" : gradeAverage.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <nav
          className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 shadow-sm sm:grid-cols-4"
          role="tablist"
          aria-label={`Secciones de ${course.name}`}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                href={`/ramos/${encodeURIComponent(course.id)}?tab=${tab.id}`}
                role="tab"
                aria-selected={isActive}
                style={{ color: isActive ? "#ffffff" : "#475569" }}
                className={`rounded-xl border px-3 py-2.5 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${
                  isActive
                    ? "border-slate-950 bg-slate-950 font-bold shadow-sm"
                    : "border-transparent bg-transparent font-semibold hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-5" role="tabpanel">
          {activeTab === "resumen" && (
            <CourseSummary course={course} onUpdated={replaceCourse} />
          )}
          {activeTab === "evaluaciones" && (
            <EvaluationsTab upcoming={evaluations.upcoming} past={evaluations.past} />
          )}
          {activeTab === "notas" && (
            <div>
              {Object.keys(grades[course.id] ?? {}).length === 0 && (
                <p className="mb-4 rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
                  Todavía no has registrado notas.
                </p>
              )}
              <GradeBook course={course} />
            </div>
          )}
          {activeTab === "asistencia" && (
            <div className="max-w-2xl">
              {!attendance[course.id] && (
                <p className="mb-4 rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
                  Todavía no hay asistencia registrada.
                </p>
              )}
              <AttendanceCard course={course} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function CourseSummary({
  course,
  onUpdated,
}: {
  course: Course;
  onUpdated: (
    course: Course
  ) => Promise<{ success: boolean; error?: string }>;
}) {
  const nextEvaluation = nextCourseEvaluation(course);
  const cancelledClasses = course.classSessions.filter(
    (session) => session.status === "cancelled"
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Qué está pasando</h2>
        <dl className="mt-5 space-y-5">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Próxima evaluación
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {nextEvaluation
                ? `${nextEvaluation.name} · ${formatDate(nextEvaluation.date)}${
                    nextEvaluation.time ? ` · ${nextEvaluation.time}` : ""
                  }`
                : "No hay evaluaciones próximas."}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Horario
            </dt>
            <dd className="mt-2 space-y-1 text-sm text-slate-700">
              {course.classes.length === 0
                ? "Horario no informado"
                : course.classes.map((block, index) => (
                    <p key={`${block.day}-${block.start}-${index}`}>
                      {DAY_NAMES[block.day]} · {block.start}–{block.end}
                      {block.room ? ` · ${block.room}` : ""}
                    </p>
                  ))}
            </dd>
          </div>
          {course.attendanceNote && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Regla de asistencia
              </dt>
              <dd className="mt-1 text-sm leading-6 text-slate-700">
                {course.attendanceNote}
              </dd>
            </div>
          )}
          {cancelledClasses.length > 0 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Clases canceladas
              </dt>
              <dd className="mt-2 space-y-1 text-sm text-amber-800">
                {cancelledClasses.map((session) => (
                  <p key={`${session.date}-${session.start ?? ""}`}>
                    {formatDate(session.date)}
                    {session.start ? ` · ${session.start}` : ""}
                    {session.note ? ` · ${session.note}` : ""}
                  </p>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <div>
        <section className={`rounded-3xl p-6 ${course.color}`}>
          <h2 className="text-xl font-semibold">Información del ramo</h2>
          <p className="mt-4 text-sm">
            {course.professor ? `Prof. ${course.professor}` : "Profesor no informado"}
          </p>
          {course.email && <p className="mt-1 text-sm">{course.email}</p>}
          <p className="mt-3 text-sm">
            Trabajo autónomo: {course.autonomousHours} h semanales
          </p>
          {course.attendanceRequired !== undefined && (
            <p className="mt-1 text-sm">
              Asistencia mínima: {course.attendanceRequired}%
            </p>
          )}
        </section>

        <CourseDocumentUpdater course={course} onUpdated={onUpdated} />
      </div>
    </div>
  );
}

function EvaluationsTab({
  upcoming,
  past,
}: {
  upcoming: Evaluation[];
  past: Evaluation[];
}) {
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Evaluaciones</h2>
        <p className="mt-2 text-slate-500">
          No hay evaluaciones registradas para este ramo.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Evaluaciones</h2>
      <EvaluationGroup title="Próximas" evaluations={upcoming} />
      <EvaluationGroup title="Anteriores" evaluations={past} past />
    </section>
  );
}

function EvaluationGroup({
  title,
  evaluations,
  past = false,
}: {
  title: string;
  evaluations: Evaluation[];
  past?: boolean;
}) {
  if (evaluations.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="mt-3 divide-y divide-slate-100">
        {evaluations.map((evaluation) => (
          <article
            key={`${evaluation.name}-${evaluation.date}-${evaluation.time ?? ""}`}
            className={`py-4 first:pt-0 ${past ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{evaluation.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDate(evaluation.date)}
                  {evaluation.time ? ` · ${evaluation.time}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {evaluationKindLabel(evaluation.kind)}
              </span>
            </div>
            {evaluation.detail && (
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {evaluation.detail}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
