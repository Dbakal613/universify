"use client";

import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/PageShell";
import { courses } from "../../lib/data";
import { dateOnly, daysUntil, formatDate } from "../../lib/date";
import type { Evaluation, Course } from "../../lib/types";

type ShabbatRange = {
  start: string;
  end: string;
};

type SelectedEvaluation = {
  course: Course;
  evaluation: Evaluation;
};

function calendarDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  // Comienza el lunes de la semana que contiene el primer día del mes.
  const daysBefore = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - daysBefore);

  // Termina el domingo de la semana que contiene el último día del mes.
  const daysAfter = (7 - last.getDay()) % 7;
  const end = new Date(last);
  end.setDate(last.getDate() + daysAfter);

  const totalDays =
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  return Array.from({ length: totalDays }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function evaluationStyle(kind: Evaluation["kind"]) {
  if (kind === "examen") {
    return {
      label: "Examen",
      className: "bg-red-100 text-red-800 border-red-200",
    };
  }

  if (kind === "prueba") {
    return {
      label: "Prueba",
      className: "bg-orange-100 text-orange-800 border-orange-200",
    };
  }

  if (kind === "control") {
    return {
      label: "Control",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    };
  }

  if (kind === "entrega") {
    return {
      label: "Entrega",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }

  return {
    label: "Actividad",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
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
    ({ evaluation }) => evaluation.date === date
  );

  if (events.length === 0) return null;

  const score = events.reduce((total, { evaluation }) => {
    if (evaluation.kind === "examen") return total + 5;
    if (evaluation.kind === "prueba") return total + 4;
    if (evaluation.kind === "entrega") return total + 3;
    if (evaluation.kind === "control") return total + 2;
    return total + 1;
  }, 0);

  if (score >= 6) {
    return {
      label: "Carga crítica",
      className: "ring-2 ring-red-400",
    };
  }

  if (score >= 4) {
    return {
      label: "Carga alta",
      className: "ring-2 ring-orange-300",
    };
  }

  if (score >= 2) {
    return {
      label: "Carga media",
      className: "ring-2 ring-amber-300",
    };
  }

  return {
    label: "Carga baja",
    className: "ring-2 ring-emerald-300",
  };
}

function semesterProgress() {
  const semesterStart = new Date("2026-08-03T12:00:00");
  const semesterEnd = new Date("2026-12-04T12:00:00");
  const today = new Date();

  if (today <= semesterStart) return 0;
  if (today >= semesterEnd) return 100;

  const completed = today.getTime() - semesterStart.getTime();
  const total = semesterEnd.getTime() - semesterStart.getTime();

  return Math.round((completed / total) * 100);
}

async function fetchShabbatForMonth(
  month: Date
): Promise<ShabbatRange[]> {
  const year = month.getFullYear();
  const monthNumber = month.getMonth() + 1;

  const url =
    "https://www.hebcal.com/hebcal" +
    `?v=1&cfg=json&year=${year}&month=${monthNumber}` +
    "&c=on&geo=geoname&geonameid=3871336&M=on";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("No se pudieron cargar los horarios de Shabat.");
  }

  const data = await response.json();

  const candles = (data.items ?? []).filter(
    (item: { category?: string }) => item.category === "candles"
  );
  const havdalah = (data.items ?? []).filter(
    (item: { category?: string }) => item.category === "havdalah"
  );

  return candles
    .map((candle: { date: string }) => {
      const matchingEnd = havdalah.find(
        (item: { date: string }) =>
          new Date(item.date).getTime() > new Date(candle.date).getTime()
      );

      if (!matchingEnd) return null;

      return {
        start: candle.date,
        end: matchingEnd.date,
      };
    })
    .filter((range: ShabbatRange | null): range is ShabbatRange =>
      Boolean(range)
    );
}

export default function CalendarPage() {
  const [month, setMonth] = useState(
    new Date(2026, new Date().getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(dateOnly(new Date()));
  const [selectedOpen, setSelectedOpen] = useState(false);
  const [shabbatRanges, setShabbatRanges] = useState<ShabbatRange[]>([]);
  const [shabbatError, setShabbatError] = useState("");

  const allEvaluations = useMemo(
    () =>
      courses.flatMap((course) =>
        course.evaluations.map((evaluation) => ({
          course,
          evaluation,
        }))
      ),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setShabbatError("");

      try {
        const ranges = await fetchShabbatForMonth(month);

        if (!cancelled) {
          setShabbatRanges(ranges);
        }
      } catch {
        if (!cancelled) {
          setShabbatRanges([]);
          setShabbatError(
            "No se pudieron cargar los horarios de Shabat en este momento."
          );
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [month]);

  const selectedEvaluations = allEvaluations.filter(
    ({ evaluation }) => evaluation.date === selectedDate
  );

  const selectedStudy = courses
    .map((course) => {
      const upcoming = course.evaluations
        .filter(
          (evaluation) =>
            evaluation.date >= selectedDate &&
            daysUntil(evaluation.date, new Date(`${selectedDate}T12:00:00`)) <=
              14
        )
        .sort((a, b) => a.date.localeCompare(b.date))[0];

      return upcoming
        ? {
            course,
            evaluation: upcoming,
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

  const progress = semesterProgress();
  const todayKey = dateOnly(new Date());
  const visibleDays = useMemo(() => calendarDays(month), [month]);

  return (
    <PageShell
      title="Calendario mensual"
      description="Revisa evaluaciones, carga académica, el día actual y los horarios de Shabat en Santiago."
    >
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-60 flex-1">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold">Avance del semestre</p>
              <p className="text-sm text-slate-500">{progress}%</p>
            </div>

            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-950 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Del 3 de agosto al 4 de diciembre de 2026.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setMonth(
                  new Date(
                    month.getFullYear(),
                    month.getMonth() - 1,
                    1
                  )
                )
              }
              className="rounded-xl border bg-white px-3 py-2"
            >
              ←
            </button>

            <p className="min-w-44 text-center font-semibold capitalize">
              {new Intl.DateTimeFormat("es-CL", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </p>

            <button
              onClick={() =>
                setMonth(
                  new Date(
                    month.getFullYear(),
                    month.getMonth() + 1,
                    1
                  )
                )
              }
              className="rounded-xl border bg-white px-3 py-2"
            >
              →
            </button>

            <button
              onClick={() => {
                const today = new Date();
                setMonth(
                  new Date(today.getFullYear(), today.getMonth(), 1)
                );
                setSelectedDate(dateOnly(today));
              }}
              className="rounded-xl bg-black px-4 py-2 text-sm text-white"
            >
              Hoy
            </button>
          </div>
        </div>

        {shabbatError && (
          <p className="mt-4 text-sm text-amber-700">{shabbatError}</p>
        )}
      </section>

      <div className="mt-4">
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="grid grid-cols-7 border-l border-t">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
              (day) => (
                <div
                  key={day}
                  className="border-b border-r bg-slate-100 p-3 text-center text-sm font-semibold"
                >
                  {day}
                </div>
              )
            )}

            {visibleDays.map((date) => {
              const key = dateOnly(date);
              const evaluations = allEvaluations.filter(
                ({ evaluation }) => evaluation.date === key
              );
              const sameMonth = date.getMonth() === month.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              const load = dailyLoad(key, allEvaluations);
              const shabbat = shabbatRanges.find(
                (range) =>
                  key === range.start.slice(0, 10) ||
                  key === range.end.slice(0, 10)
              );

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDate(key);
                    setSelectedOpen(true);
                  }}
                  className={`relative min-w-0 border-b border-r bg-white p-2 pt-10 text-left align-top transition hover:bg-slate-50 ${
                    isSelected ? "shadow-[inset_0_0_0_2px_#0f172a]" : ""
                  }`}
                  aria-label={`${key}${load ? `, ${load.label}` : ""}`}
                >
                  <span
                    className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      isToday
                        ? "bg-blue-600 text-white"
                        : sameMonth
                        ? "text-slate-700"
                        : "text-slate-400"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {isToday && (
                    <span className="absolute right-3 top-3 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                      Hoy
                    </span>
                  )}

                  {shabbat && (
                    <div className="mb-1 shrink-0 rounded-md bg-indigo-50 px-1.5 py-1 text-[9px] leading-tight text-indigo-800">
                      {key === shabbat.start.slice(0, 10) ? (
                        <>
                          <p className="font-semibold">
                            Encendido de velas
                          </p>
                          <p>
                            {new Intl.DateTimeFormat("es-CL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(shabbat.start))}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">Havdalá</p>
                          <p>
                            {new Intl.DateTimeFormat("es-CL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(shabbat.end))}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    {evaluations.map(
                      ({ course, evaluation }) => {
                        const style = evaluationStyle(evaluation.kind);

                        return (
                          <div
                            key={`${course.id}-${evaluation.name}`}
                            className={`min-w-0 overflow-hidden rounded-md border px-1.5 py-1 ${style.className}`}
                          >
                            <p className="break-words text-[9px] font-semibold leading-tight">
                              {evaluation.name}
                            </p>
                            <p className="mt-0.5 break-words text-[8px] leading-tight">
                              {course.name}
                            </p>
                          </div>
                        );
                      }
                    )}

                  </div>
                </button>
              );
            })}
          </div>
        </section>


        <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-slate-700">Leyenda:</span>

            {[
              "examen",
              "prueba",
              "control",
              "entrega",
              "actividad",
            ].map((kind) => {
              const style = evaluationStyle(
                kind as Evaluation["kind"]
              );

              return (
                <div
                  key={kind}
                  className={`rounded-xl border px-3 py-2 ${style.className}`}
                >
                  {style.label}
                </div>
              );
            })}

            <div className="ml-auto flex flex-wrap items-center gap-4 text-slate-600">
              <p>
                <span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-600" />
                Día de hoy
              </p>
              <p>
                <span className="mr-2 inline-block h-3 w-3 rounded-full ring-2 ring-red-400" />
                Carga crítica
              </p>
              <p>
                <span className="mr-2 inline-block h-3 w-3 rounded-full ring-2 ring-amber-300" />
                Carga media
              </p>
            </div>
          </div>
        </section>

        {selectedOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setSelectedOpen(false)}
          >
            <div
              className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Día seleccionado</p>
                  <h2 className="mt-1 text-2xl font-bold capitalize">
                    {new Intl.DateTimeFormat("es-CL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(new Date(`${selectedDate}T12:00:00`))}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedOpen(false)}
                  className="rounded-xl border px-3 py-2 text-sm"
                >
                  Cerrar
                </button>
              </div>

              <section className="mt-6">
                <h3 className="text-lg font-semibold">Evaluaciones del día</h3>

                <div className="mt-3 space-y-3">
                  {selectedEvaluations.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No hay evaluaciones registradas este día.
                    </p>
                  ) : (
                    selectedEvaluations.map(({ course, evaluation }) => {
                      const style = evaluationStyle(evaluation.kind);

                      return (
                        <article
                          key={`${course.id}-${evaluation.name}`}
                          className={`rounded-2xl border p-4 ${style.className}`}
                        >
                          <p className="text-xs font-semibold uppercase">
                            {style.label}
                          </p>
                          <p className="mt-1 font-semibold">
                            {evaluation.name}
                          </p>
                          <p className="mt-1 text-sm">{course.name}</p>

                          {evaluation.detail && (
                            <p className="mt-3 text-sm">
                              {evaluation.detail}
                            </p>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="mt-6">
                <h3 className="text-lg font-semibold">
                  Preparación recomendada
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Evaluaciones de las próximas dos semanas desde este día.
                </p>

                <div className="mt-3 space-y-3">
                  {selectedStudy.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No hay preparación urgente asociada.
                    </p>
                  ) : (
                    selectedStudy.map(({ course, evaluation }) => (
                      <article
                        key={`${course.id}-${evaluation.name}`}
                        className={`rounded-2xl p-4 ${course.color}`}
                      >
                        <p className="font-semibold">{course.name}</p>
                        <p className="mt-1 text-sm">{evaluation.name}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {formatDate(evaluation.date)}
                        </p>
                        <p className="mt-3 text-sm">
                          {evaluation.detail ??
                            "Revisar contenidos y avanzar la preparación."}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}