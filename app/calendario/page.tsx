"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import PageShell from "../../components/PageShell";
import {
  dateOnly,
  daysUntil,
  formatDate,
} from "../../lib/date";
import type {
  Course,
  Evaluation,
  SemesterSettings,
} from "../../lib/types";
import { useSavedCourses } from "../../lib/use-saved-courses";
import { useAuthUser } from "../../components/AuthUserProvider";
import { getUserStorageKey, USER_STORAGE_KEYS } from "../../lib/user-storage";

type SelectedEvaluation = {
  course: Course;
  evaluation: Evaluation;
};

function calendarWeeks(date: Date) {
  const first = new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );

  const last = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );

  const daysBefore =
    (first.getDay() + 6) % 7;

  const start = new Date(first);

  start.setDate(
    first.getDate() - daysBefore
  );

  const lastWeekMonday = new Date(last);
  lastWeekMonday.setDate(last.getDate() - ((last.getDay() + 6) % 7));

  const weekCount =
    Math.round(
      (lastWeekMonday.getTime() - start.getTime()) / (7 * 86_400_000)
    ) + 1;

  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const monday = new Date(start);
    monday.setDate(start.getDate() + weekIndex * 7);

    return Array.from({ length: 7 }, (_, dayIndex) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + dayIndex);
      return day;
    });
  });
}

function evaluationStyle(
  kind: Evaluation["kind"]
) {
  if (kind === "examen") {
    return {
      label: "Examen",
      className:
        "bg-red-100 text-red-800 border-red-200",
    };
  }

  if (kind === "prueba") {
    return {
      label: "Prueba",
      className:
        "bg-orange-100 text-orange-800 border-orange-200",
    };
  }

  if (kind === "control") {
    return {
      label: "Control",
      className:
        "bg-amber-100 text-amber-800 border-amber-200",
    };
  }

  if (kind === "entrega") {
    return {
      label: "Entrega",
      className:
        "bg-blue-100 text-blue-800 border-blue-200",
    };
  }

  if (kind === "presentacion") {
    return {
      label: "Presentación",
      className:
        "bg-violet-100 text-violet-800 border-violet-200",
    };
  }

  return {
    label: "Actividad",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
}

function dailyLoad(
  date: string,
  evaluations: SelectedEvaluation[]
): {
  label: string;
  className: string;
} | null {
  const events = evaluations.filter(
    ({ evaluation }) =>
      evaluation.date === date
  );

  if (events.length === 0) {
    return null;
  }

  const score = events.reduce(
    (total, { evaluation }) => {
      if (evaluation.kind === "examen") {
        return total + 5;
      }

      if (evaluation.kind === "prueba") {
        return total + 4;
      }

      if (
        evaluation.kind === "entrega" ||
        evaluation.kind === "presentacion"
      ) {
        return total + 3;
      }

      if (evaluation.kind === "control") {
        return total + 2;
      }

      return total + 1;
    },
    0
  );

  if (score >= 6) {
    return {
      label: "Carga crítica",
      className:
        "ring-2 ring-inset ring-red-400",
    };
  }

  if (score >= 4) {
    return {
      label: "Carga alta",
      className:
        "ring-2 ring-inset ring-orange-300",
    };
  }

  if (score >= 2) {
    return {
      label: "Carga media",
      className:
        "ring-2 ring-inset ring-amber-300",
    };
  }

  return {
    label: "Carga baja",
    className:
      "ring-2 ring-inset ring-emerald-300",
  };
}

function semesterProgress(
  semester: SemesterSettings | null
) {
  if (!semester) {
    return null;
  }

  const semesterStart = new Date(
    `${semester.startDate}T12:00:00`
  );

  const semesterEnd = new Date(
    `${semester.endDate}T12:00:00`
  );

  const today = new Date();

  if (today <= semesterStart) {
    return 0;
  }

  if (today >= semesterEnd) {
    return 100;
  }

  const completed =
    today.getTime() -
    semesterStart.getTime();

  const total =
    semesterEnd.getTime() -
    semesterStart.getTime();

  return Math.round(
    (completed / total) * 100
  );
}

export default function CalendarPage() {
  const { userId, isAuthLoading } = useAuthUser();
  const {
    courses,
    isLoading: coursesLoading,
    error: coursesError,
  } = useSavedCourses();

  const [semester, setSemester] =
    useState<SemesterSettings | null>(
      null
    );

  const [semesterLoading, setSemesterLoading] = useState(true);

  const [month, setMonth] =
    useState(
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
    );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    dateOnly(new Date())
  );

  const [
    selectedOpen,
    setSelectedOpen,
  ] = useState(false);

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isAuthLoading || !userId) return;

    const timeoutId = window.setTimeout(() => {
    try {
      const savedSemester =
        sessionStorage.getItem(
          getUserStorageKey(userId, USER_STORAGE_KEYS.semester)
        );

      if (savedSemester) {
        const parsedSemester =
          JSON.parse(
            savedSemester
          ) as SemesterSettings;

        setSemester(parsedSemester);

        const semesterStart =
          new Date(
            `${parsedSemester.startDate}T12:00:00`
          );

        const today = new Date();

        const initialDate =
          today >= semesterStart
            ? today
            : semesterStart;

        setMonth(
          new Date(
            initialDate.getFullYear(),
            initialDate.getMonth(),
            1
          )
        );
      }
    } catch (error) {
      console.error(
        "No fue posible cargar el calendario:",
        error
      );
    } finally {
      setSemesterLoading(false);
    }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthLoading, userId]);

  const allEvaluations =
    useMemo(
      () =>
        courses.flatMap(
          (course) =>
            course.evaluations.map(
              (evaluation) => ({
                course,
                evaluation,
              })
            )
        ),
      [courses]
    );

  const selectedEvaluations =
    allEvaluations.filter(
      ({ evaluation }) =>
        evaluation.date ===
        selectedDate
    );

  const selectedStudy = courses
    .map((course) => {
      const upcoming =
        course.evaluations
          .filter(
            (evaluation) => {
              const difference =
                daysUntil(
                  evaluation.date,
                  new Date(
                    `${selectedDate}T12:00:00`
                  )
                );

              return (
                evaluation.date >=
                  selectedDate &&
                difference >= 0 &&
                difference <= 14
              );
            }
          )
          .sort((a, b) =>
            a.date.localeCompare(
              b.date
            )
          )[0];

      return upcoming
        ? {
            course,
            evaluation:
              upcoming,
          }
        : null;
    })
    .filter(
      (
        item
      ): item is {
        course: Course;
        evaluation: Evaluation;
      } => Boolean(item)
    )
    .slice(0, 3);

  const progress =
    semesterProgress(semester);

  const todayKey =
    dateOnly(new Date());

  const visibleWeeks =
    useMemo(
      () => calendarWeeks(month),
      [month]
    );

  const mobileAgendaDays = useMemo(
    () =>
      visibleWeeks
        .flat()
        .filter((date) => {
          const key = dateOnly(date);
          return (
            key === todayKey ||
            allEvaluations.some(({ evaluation }) => evaluation.date === key)
          );
        }),
    [allEvaluations, todayKey, visibleWeeks]
  );

  if (coursesLoading || semesterLoading) {
    return (
      <PageShell
        title="Calendario mensual"
        description="Tus evaluaciones y carga académica organizadas por fecha."
      >
        <p className="text-slate-500">
          Cargando calendario...
        </p>
      </PageShell>
    );
  }

  if (coursesError) {
    return (
      <PageShell
        title="Calendario mensual"
        description="Tus evaluaciones y carga académica organizadas por fecha."
      >
        <p role="alert" className="text-slate-600">{coursesError}</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Calendario mensual"
      description="Revisa tus evaluaciones y carga académica del mes."
    >
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-60 flex-1">
            {semester &&
            progress !== null ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold">
                    Avance del semestre
                  </p>

                  <p className="text-sm text-slate-500">
                    {progress}%
                  </p>
                </div>

                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-950 transition-all"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  {semester.name}:{" "}
                  {formatDate(
                    semester.startDate
                  )}{" "}
                  –{" "}
                  {formatDate(
                    semester.endDate
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  Calendario académico
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Las evaluaciones de
                  tus ramos aparecerán
                  automáticamente aquí.
                </p>
              </>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              onClick={() =>
                setMonth(
                  new Date(
                    month.getFullYear(),
                    month.getMonth() -
                      1,
                    1
                  )
                )
              }
              aria-label="Mes anterior"
              className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
            >
              ←
            </button>

            <p className="min-w-40 flex-1 text-center font-semibold capitalize sm:min-w-44 sm:flex-none">
              {new Intl.DateTimeFormat(
                "es-CL",
                {
                  month: "long",
                  year: "numeric",
                }
              ).format(month)}
            </p>

            <button
              type="button"
              onClick={() =>
                setMonth(
                  new Date(
                    month.getFullYear(),
                    month.getMonth() +
                      1,
                    1
                  )
                )
              }
              aria-label="Mes siguiente"
              className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
            >
              →
            </button>

            <button
              type="button"
              onClick={() => {
                const today =
                  new Date();

                setMonth(
                  new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    1
                  )
                );

                setSelectedDate(
                  dateOnly(today)
                );
              }}
              className="h-10 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              Hoy
            </button>
          </div>
        </div>

      </section>

      {courses.length === 0 ? (
        <section className="mt-4 rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">
            Aún no hay evaluaciones
          </h2>

          <p className="mt-2 text-slate-500">
            Cuando agregues tus ramos,
            las evaluaciones detectadas
            aparecerán automáticamente
            en este calendario.
          </p>
        </section>
      ) : (
        <>
          <div className="mt-4">
            <section className="hidden overflow-hidden rounded-3xl bg-white shadow-sm md:block">
              <div className="grid grid-cols-5 border-l border-t border-slate-200/80">
                {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map(
                  (day) => (
                    <div
                      key={day}
                      className="border-b border-r border-slate-200/80 bg-slate-50 px-3 py-2.5 text-center text-sm font-semibold text-slate-700"
                    >
                      {day}
                    </div>
                  )
                )}

                {visibleWeeks.map((week) => (
                  <Fragment key={dateOnly(week[0])}>
                      {week.slice(0, 5).map((date) => {
                        const key = dateOnly(date);
                        const evaluations = allEvaluations.filter(
                          ({ evaluation }) => evaluation.date === key
                        );
                        const sameMonth = date.getMonth() === month.getMonth();
                        const isToday = key === todayKey;
                        const isPast = key < todayKey;
                        const isSelected = key === selectedDate;
                        const load = dailyLoad(key, allEvaluations);
                        const isExpanded = Boolean(expandedDays[key]);
                        const shownEvaluations = isExpanded
                          ? evaluations
                          : evaluations.slice(0, 2);
                        const remaining = evaluations.length - 2;

                        return (
                          <div
                            key={key}
                            className={`relative min-h-28 min-w-0 border-b border-r border-slate-200/80 p-2 pt-10 ${
                              !sameMonth
                                ? "bg-slate-50 text-slate-400"
                                : isPast
                                  ? "bg-slate-50/70 text-slate-500"
                                  : "bg-white"
                            } ${isSelected ? "shadow-[inset_0_0_0_2px_#0f172a]" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(key);
                                setSelectedOpen(true);
                              }}
                              className={`absolute left-2 top-2 flex min-h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${
                                isToday
                                  ? "bg-blue-600 text-white ring-2 ring-blue-200"
                                  : !sameMonth
                                    ? "text-slate-400"
                                    : isPast
                                      ? "text-slate-500"
                                      : "text-slate-800"
                              }`}
                              aria-label={`Abrir ${key}${load ? `, ${load.label}` : ""}`}
                            >
                              {date.getDate()}
                            </button>

                            {isToday && (
                              <span className="absolute right-2 top-2 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                Hoy
                              </span>
                            )}

                            <div className={`space-y-1.5 ${isPast ? "opacity-70" : ""}`}>
                              {shownEvaluations.map(({ course, evaluation }) => {
                                const style = evaluationStyle(evaluation.kind);

                                return (
                                  <button
                                    key={`${course.id}-${evaluation.name}-${evaluation.date}`}
                                    type="button"
                                    onClick={() => {
                                      setSelectedDate(key);
                                      setSelectedOpen(true);
                                    }}
                                    className={`block w-full min-w-0 rounded-lg border px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${style.className}`}
                                  >
                                    <p className="truncate text-xs font-semibold">
                                      <span aria-hidden="true">● </span>
                                      {style.label}: {evaluation.name}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs opacity-80">
                                      {course.name}
                                      {evaluation.time ? ` · ${evaluation.time}` : ""}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>

                            {remaining > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedDays((current) => ({
                                    ...current,
                                    [key]: !isExpanded,
                                  }))
                                }
                                className="mt-1.5 rounded-md px-1 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                              >
                                {isExpanded ? "Ver menos" : `+${remaining} más`}
                              </button>
                            )}
                          </div>
                        );
                      })}

                  </Fragment>
                ))}
              </div>
            </section>

            <section className="space-y-3 md:hidden" aria-label="Agenda del mes">
              {mobileAgendaDays.length === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
                  No hay eventos registrados este mes.
                </div>
              ) : (
                mobileAgendaDays.map((date) => {
                  const key = dateOnly(date);
                  const evaluations = allEvaluations.filter(
                    ({ evaluation }) => evaluation.date === key
                  );
                  const isToday = key === todayKey;
                  const isPast = key < todayKey;
                  const sameMonth = date.getMonth() === month.getMonth();
                  const isExpanded = Boolean(expandedDays[key]);
                  const shownEvaluations = isExpanded
                    ? evaluations
                    : evaluations.slice(0, 2);
                  const remaining = evaluations.length - 2;

                  return (
                    <article
                      key={key}
                      className={`rounded-2xl border bg-white p-4 shadow-sm ${
                        isToday
                          ? "border-blue-400 ring-2 ring-blue-100"
                          : isPast || !sameMonth
                            ? "border-slate-200 opacity-65"
                            : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="font-semibold capitalize text-slate-900">
                          {new Intl.DateTimeFormat("es-CL", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          }).format(date)}
                        </h2>
                        {isToday && (
                          <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                            Hoy
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {shownEvaluations.map(({ course, evaluation }) => {
                          const style = evaluationStyle(evaluation.kind);
                          return (
                            <button
                              key={`${course.id}-${evaluation.name}-${key}`}
                              type="button"
                              onClick={() => {
                                setSelectedDate(key);
                                setSelectedOpen(true);
                              }}
                              className={`block w-full rounded-xl border px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${style.className}`}
                            >
                              <p className="text-sm font-semibold">
                                <span aria-hidden="true">● </span>
                                {style.label}: {evaluation.name}
                              </p>
                              <p className="mt-1 text-xs">
                                {course.name}
                                {evaluation.time ? ` · ${evaluation.time}` : ""}
                              </p>
                            </button>
                          );
                        })}

                        {remaining > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDays((current) => ({
                                ...current,
                                [key]: !isExpanded,
                              }))
                            }
                            className="rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                          >
                            {isExpanded ? "Ver menos" : `+${remaining} más`}
                          </button>
                        )}

                        {evaluations.length === 0 && (
                          <p className="text-sm text-slate-500">Sin evaluaciones</p>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </section>

            <section className="mt-4 hidden rounded-3xl bg-white p-4 shadow-sm md:block">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-slate-700">Leyenda:</span>
                {["examen", "prueba", "control", "entrega", "presentacion", "actividad"].map(
                  (kind) => {
                    const style = evaluationStyle(kind as Evaluation["kind"]);
                    return (
                      <div
                        key={kind}
                        className={`rounded-xl border px-3 py-2 ${style.className}`}
                      >
                        <span aria-hidden="true">● </span>
                        {style.label}
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          </div>

          {selectedOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() =>
                setSelectedOpen(false)
              }
            >
              <div
                className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">
                      Día seleccionado
                    </p>

                    <h2 className="mt-1 text-2xl font-bold capitalize">
                      {new Intl.DateTimeFormat(
                        "es-CL",
                        {
                          weekday:
                            "long",
                          day: "numeric",
                          month:
                            "long",
                        }
                      ).format(
                        new Date(
                          `${selectedDate}T12:00:00`
                        )
                      )}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedOpen(
                        false
                      )
                    }
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    Cerrar
                  </button>
                </div>

                <section className="mt-6">
                  <h3 className="text-lg font-semibold">
                    Evaluaciones
                    del día
                  </h3>

                  <div className="mt-3 space-y-3">
                    {selectedEvaluations.length ===
                    0 ? (
                      <p className="text-sm text-slate-500">
                        No hay
                        evaluaciones
                        registradas este
                        día.
                      </p>
                    ) : (
                      selectedEvaluations.map(
                        ({
                          course,
                          evaluation,
                        }) => {
                          const style =
                            evaluationStyle(
                              evaluation.kind
                            );

                          return (
                            <article
                              key={`${course.id}-${evaluation.name}-${evaluation.date}`}
                              className={`rounded-2xl border p-4 ${style.className}`}
                            >
                              <p className="text-xs font-semibold uppercase">
                                {
                                  style.label
                                }
                              </p>

                              <p className="mt-1 font-semibold">
                                {
                                  evaluation.name
                                }
                              </p>

                              <p className="mt-1 text-sm">
                                {
                                  course.name
                                }
                              </p>

                              {evaluation.time && (
                                <p className="mt-1 text-sm font-semibold">
                                  Hora: {evaluation.time}
                                </p>
                              )}

                              {evaluation.detail && (
                                <p className="mt-3 text-sm">
                                  {
                                    evaluation.detail
                                  }
                                </p>
                              )}
                            </article>
                          );
                        }
                      )
                    )}
                  </div>
                </section>

                <section className="mt-6">
                  <h3 className="text-lg font-semibold">
                    Preparación
                    recomendada
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Evaluaciones de
                    las próximas dos
                    semanas desde
                    este día.
                  </p>

                  <div className="mt-3 space-y-3">
                    {selectedStudy.length ===
                    0 ? (
                      <p className="text-sm text-slate-500">
                        No hay
                        preparación
                        urgente
                        asociada.
                      </p>
                    ) : (
                      selectedStudy.map(
                        ({
                          course,
                          evaluation,
                        }) => (
                          <article
                            key={`${course.id}-${evaluation.name}-${evaluation.date}`}
                            className={`rounded-2xl p-4 ${course.color}`}
                          >
                            <p className="font-semibold">
                              {
                                course.name
                              }
                            </p>

                            <p className="mt-1 text-sm">
                              {
                                evaluation.name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-600">
                              {formatDate(
                                evaluation.date
                              )}
                            </p>

                            <p className="mt-3 text-sm">
                              {evaluation.detail ??
                                "Revisar contenidos y avanzar la preparación."}
                            </p>
                          </article>
                        )
                      )
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
