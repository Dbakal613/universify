"use client";

import Link from "next/link";

import PageShell from "../../components/PageShell";
import { courseScheduleSummary, nextCourseEvaluation } from "../../lib/course-display";
import { formatDate } from "../../lib/date";
import { useSavedCourses } from "../../lib/use-saved-courses";

export default function CoursesPage() {
  const { courses, isLoading, error } = useSavedCourses();

  if (isLoading) {
    return (
      <PageShell title="Mis ramos" description="Tu biblioteca académica.">
        <div
          role="status"
          aria-label="Cargando tus ramos"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <span className="sr-only">Cargando tus ramos...</span>
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-3xl bg-white p-6 shadow-sm"
            >
              <div className="h-6 w-2/3 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
              <div className="mt-8 h-3 w-1/3 rounded bg-slate-100" />
              <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Mis ramos" description="Tu biblioteca académica.">
        <section role="alert" className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">No pudimos cargar tus ramos</h2>
          <p className="mt-2 text-slate-500">{error}</p>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell title="Mis ramos" description="Entra a cada ramo para revisar su información académica.">
      <div className="mb-6 flex items-center justify-end">
        <button
          type="button"
          disabled
          title="Disponible próximamente"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed"
        >
          + Agregar ramo
        </button>
      </div>

      {courses.length === 0 ? (
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">Aún no hay ramos guardados</h2>
          <p className="mt-2 text-slate-500">
            Cuando agregues tus ramos, aparecerán aquí como tu biblioteca académica.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const nextEvaluation = nextCourseEvaluation(course);
            const schedule = courseScheduleSummary(course);

            return (
              <Link
                key={course.id}
                href={`/ramos/${encodeURIComponent(course.id)}`}
                className={`group rounded-3xl p-6 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${course.color}`}
              >
                <h2 className="text-xl font-semibold text-slate-950 group-hover:underline">
                  {course.name}
                </h2>
                {course.professor && (
                  <p className="mt-2 text-sm text-slate-700">
                    Prof. {course.professor}
                  </p>
                )}

                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Próxima evaluación
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {nextEvaluation
                      ? `${nextEvaluation.name} · ${formatDate(nextEvaluation.date)}`
                      : "Sin evaluaciones pendientes"}
                  </p>
                </div>

                {schedule && (
                  <p className="mt-4 truncate text-sm text-slate-600">{schedule}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
