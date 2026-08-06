import PageShell from "../../components/PageShell";
import { courses } from "../../lib/data";
import { mondayOfCurrentWeek } from "../../lib/date";

export default function AutonomousWorkPage() {
  const weekStart = mondayOfCurrentWeek();

  return (
    <PageShell
      title="Repaso recomendado diario"
      description="Trabajo autónomo indicado en los syllabus para esta semana. Estas tareas son complementarias a las prioridades de evaluaciones."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((course) => {
          const exact = course.autonomousTasks.find(
            (task) => task.weekStart === weekStart
          );

          const lastAvailable = course.autonomousTasks
            .filter((task) => task.weekStart <= weekStart)
            .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];

          const task = exact ?? lastAvailable;

          return (
            <article
              key={course.id}
              className={`rounded-3xl p-6 ${course.color}`}
            >
              <h2 className="text-xl font-semibold">{course.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {course.autonomousHours} horas autónomas semanales
              </p>

              {task ? (
                <>
                  <p className="mt-4 font-medium">{task.title}</p>
                  <p className="mt-2 text-sm">
                    Tiempo semanal sugerido: {task.minutes} min
                  </p>

                  {task.evaluation && (
                    <p className="mt-1 text-sm text-slate-600">
                      Relacionado con: {task.evaluation}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  No hay una actividad autónoma específica registrada.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </PageShell>
  );
}
