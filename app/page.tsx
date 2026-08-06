"use client";

import AttendanceCard from "../components/AttendanceCard";
import PageShell from "../components/PageShell";
import { courses } from "../lib/data";
import { daysUntil, formatDate } from "../lib/date";

function urgency(days: number) {
  if (days <= 2) {
    return { label: "Urgente", className: "bg-red-100 text-red-700" };
  }

  if (days <= 4) {
    return {
      label: "Prioridad media",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Puedes partir con tiempo",
    className: "bg-emerald-100 text-emerald-700",
  };
}

export default function DashboardPage() {
  const today = new Date();

  const nextEvaluations = courses
    .flatMap((course) =>
      course.evaluations.map((evaluation) => ({ course, evaluation }))
    )
    .filter(({ evaluation }) => daysUntil(evaluation.date) >= 0)
    .sort((a, b) => a.evaluation.date.localeCompare(b.evaluation.date))
    .slice(0, 4);

  const todayCourses = courses.filter((course) =>
    course.classes.some((block) => block.day === today.getDay())
  );

  return (
    <PageShell
      title="Qué estudiar hoy"
      description="Las cuatro evaluaciones futuras más próximas y la asistencia de tus clases de hoy."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {nextEvaluations.map(({ course, evaluation }, index) => {
          const remaining = daysUntil(evaluation.date);
          const state = urgency(remaining);

          return (
            <article
              key={`${course.id}-${evaluation.name}`}
              className="rounded-3xl bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-slate-500">
                  Prioridad {index + 1}
                </p>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${state.className}`}
                >
                  {state.label}
                </span>
              </div>

              <h2 className="mt-3 text-xl font-semibold">{course.name}</h2>
              <p className="mt-2 font-medium">{evaluation.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {remaining === 0
                  ? "Es hoy"
                  : remaining === 1
                  ? "Queda 1 día"
                  : `Quedan ${remaining} días`}
                {" · "}
                {formatDate(evaluation.date)}
              </p>

              <p className="mt-4 text-sm text-slate-700">
                {evaluation.detail ??
                  "Comenzar preparación y revisar los contenidos asociados."}
              </p>
            </article>
          );
        })}
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Clases de hoy</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {todayCourses.length === 0 ? (
            <p className="text-slate-500">
              No tienes clases registradas hoy.
            </p>
          ) : (
            todayCourses.map((course) => (
              <AttendanceCard key={course.id} course={course} />
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}
