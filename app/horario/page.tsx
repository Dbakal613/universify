"use client";

import PageShell from "../../components/PageShell";
import { DAY_NAMES, minutesToTime, toMinutes } from "../../lib/date";
import { useSavedCourses } from "../../lib/use-saved-courses";

const START = 8 * 60 + 20;
const END = 18 * 60;
const HEIGHT = 700;

const DAYS = [1, 2, 3, 4, 5];

function top(time: string) {
  return (
    ((Math.max(toMinutes(time), START) - START) / (END - START)) *
    HEIGHT
  );
}

function blockHeight(
  start: string,
  end: string
) {
  return Math.max(
    28,
    ((Math.min(toMinutes(end), END) - Math.max(toMinutes(start), START)) /
      (END - START)) *
      HEIGHT
  );
}

export default function SchedulePage() {
  const { courses, isLoading, error } = useSavedCourses();

  const hours = Array.from(
    { length: 11 },
    (_, index) => minutesToTime(Math.min(START + index * 60, END))
  );

  if (hours.at(-1) !== "18:00") hours.push("18:00");

  const visibleClasses = courses.flatMap((course) =>
    course.classes
      .filter(
        (block) =>
          DAYS.includes(block.day) &&
          toMinutes(block.start) < END &&
          toMinutes(block.end) > START
      )
      .map((block) => ({ course, block }))
  );

  const scheduledCourseIds = new Set(
    visibleClasses.map(({ course }) => course.id)
  );

  if (isLoading) {
    return (
      <PageShell
        title="Horario semanal"
        description="Tus clases organizadas por día y hora."
      >
        <p className="text-slate-500">
          Cargando horario...
        </p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Horario semanal" description="Tus clases organizadas por día y hora.">
        <p role="alert" className="text-slate-600">{error}</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Horario semanal"
      description="Tus clases organizadas por día y hora."
    >
      {visibleClasses.length === 0 ? (
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">
            Aún no hay clases registradas
          </h2>

          <p className="mt-2 text-slate-500">
            No hay bloques de lunes a viernes entre 08:20 y 18:00.
          </p>
        </section>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[850px]">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns:
                  "70px repeat(5, minmax(150px, 1fr))",
              }}
            >
              <div />

              {DAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 pb-2 text-center font-semibold"
                >
                  {DAY_NAMES[day]}
                </div>
              ))}

              <div
                className="relative"
                style={{ height: HEIGHT }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute right-2 text-xs text-slate-400"
                    style={{
                      top: top(hour) - 7,
                    }}
                  >
                    {hour}
                  </div>
                ))}
              </div>

              {DAYS.map((day) => (
                <div
                  key={day}
                  className="relative rounded-2xl bg-white shadow-sm"
                  style={{
                    height: HEIGHT,
                  }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-slate-200/70"
                      style={{
                        top: top(hour),
                      }}
                    />
                  ))}

                  {visibleClasses
                    .filter(({ block }) => block.day === day)
                    .map(({ course, block }, index) => (
                        <div
                          key={`${course.id}-${day}-${index}`}
                          className={`absolute left-2 right-2 overflow-hidden rounded-xl p-2 shadow-sm ${course.color}`}
                          style={{
                            top: top(
                              block.start
                            ),
                            height:
                              blockHeight(
                                block.start,
                                block.end
                              ),
                          }}
                        >
                          <p className="text-xs font-semibold">
                            {block.start}–
                            {block.end}
                          </p>

                          <p className="mt-1 text-xs font-medium">
                            {course.name}
                          </p>

                          {block.room && (
                            <p className="mt-1 text-[11px] text-slate-600">
                              {block.room}
                            </p>
                          )}
                        </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Todos los ramos inscritos</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {courses.map((course) => (
            <span
              key={course.id}
              className={`rounded-full px-3 py-2 text-sm ${course.color}`}
            >
              {course.name}
              {!scheduledCourseIds.has(course.id) && " · Sin horario L–V detectado"}
            </span>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
