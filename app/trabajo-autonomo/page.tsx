"use client";

import PageShell from "../../components/PageShell";
import { dateOnly, formatDate, mondayOfCurrentWeek } from "../../lib/date";
import { useSavedCourses } from "../../lib/use-saved-courses";

export default function AutonomousWorkPage() {
  const { courses, isLoading, error } = useSavedCourses();
  const windowStart = mondayOfCurrentWeek();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  const windowEnd = dateOnly(endDate);

  const upcomingTasks = courses
    .flatMap((course) =>
      course.autonomousTasks
        .filter(
          (task) => task.weekStart >= windowStart && task.weekStart <= windowEnd
        )
        .map((task) => ({ course, task }))
    )
    .sort((a, b) => a.task.weekStart.localeCompare(b.task.weekStart));

  if (isLoading) {
    return (
      <PageShell title="Repaso recomendado diario" description="Trabajo autónomo indicado en tus syllabus para esta semana.">
        <p className="text-slate-500">Cargando trabajo autónomo...</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Repaso recomendado diario" description="Trabajo autónomo indicado en tus syllabus para esta semana.">
        <p role="alert" className="text-slate-600">{error}</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Repaso recomendado diario"
      description="Actividades autónomas de la semana actual y los próximos siete días, extraídas de los cronogramas de tus syllabus."
    >
      {upcomingTasks.length === 0 ? (
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">No hay trabajo autónomo para los próximos días</h2>
          <p className="mt-2 text-slate-500">
            Reprocesa el syllabus si su cronograma incluye actividades junto a cada clase.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {upcomingTasks.map(({ course, task }, index) => (
            <article
              key={`${course.id}-${task.weekStart}-${task.title}-${index}`}
              className={`rounded-3xl p-6 ${course.color}`}
            >
              <p className="text-sm font-semibold text-slate-600">
                Semana del {formatDate(task.weekStart)}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{course.name}</h2>

              {task.classTopics && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contenidos de la clase
                  </p>
                  <p className="mt-1 text-sm">{task.classTopics}</p>
                </div>
              )}

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Trabajo antes de la siguiente clase
                </p>
                <p className="mt-1 font-medium">{task.title}</p>
              </div>

              {task.minutes !== undefined && (
                <p className="mt-3 text-sm">Tiempo sugerido: {task.minutes} min</p>
              )}
              {task.evaluation && (
                <p className="mt-1 text-sm text-slate-600">
                  Relacionado con: {task.evaluation}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
