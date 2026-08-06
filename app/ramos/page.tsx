"use client";

import { useState } from "react";
import AttendanceCard from "../../components/AttendanceCard";
import GradeBook from "../../components/GradeBook";
import PageShell from "../../components/PageShell";
import { courses } from "../../lib/data";
import { DAY_NAMES, daysUntil, formatDate } from "../../lib/date";
import type { Course } from "../../lib/types";

export default function CoursesPage() {
  const [selected, setSelected] = useState<Course | null>(null);

  if (selected) {
    return (
      <PageShell
        title={selected.name}
        description={`${selected.professor} · ${selected.email}`}
      >
        <button
          onClick={() => setSelected(null)}
          className="mb-5 rounded-xl border bg-white px-4 py-2"
        >
          ← Volver a todos los ramos
        </button>

        <section className={`rounded-3xl p-6 ${selected.color}`}>
          <h2 className="text-xl font-semibold">Información del ramo</h2>

          <div className="mt-3 space-y-1 text-sm">
            {selected.classes.map((block, index) => (
              <p key={index}>
                {DAY_NAMES[block.day]} {block.start}–{block.end}
                {block.room ? ` · ${block.room}` : ""}
              </p>
            ))}
          </div>

          <p className="mt-3 text-sm">
            Trabajo autónomo: {selected.autonomousHours} h semanales
          </p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <AttendanceCard course={selected} />
          <GradeBook course={selected} />
        </div>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Evaluaciones</h2>

          <div className="mt-4 space-y-3">
            {selected.evaluations.map((evaluation) => (
              <article
                key={`${evaluation.name}-${evaluation.date}`}
                className="rounded-2xl border p-4"
              >
                <p className="font-medium">{evaluation.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDate(evaluation.date)}
                </p>

                {evaluation.detail && (
                  <p className="mt-2 text-sm text-slate-700">
                    {evaluation.detail}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Mis ramos"
      description="Entra a cada ramo para revisar horarios, asistencia, evaluaciones y notas."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const nextEvaluation = course.evaluations
            .filter((evaluation) => daysUntil(evaluation.date) >= 0)
            .sort((a, b) => a.date.localeCompare(b.date))[0];

          return (
            <button
              key={course.id}
              onClick={() => setSelected(course)}
              className={`rounded-3xl p-6 text-left transition hover:-translate-y-1 ${course.color}`}
            >
              <h2 className="text-xl font-semibold">{course.name}</h2>
              <p className="mt-2 text-sm">{course.professor}</p>

              <p className="mt-5 text-sm font-medium">Próximo</p>
              <p className="mt-1 text-sm">
                {nextEvaluation
                  ? `${nextEvaluation.name} · ${formatDate(
                      nextEvaluation.date
                    )}`
                  : "Sin evaluaciones pendientes"}
              </p>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}
