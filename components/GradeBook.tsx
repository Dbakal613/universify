"use client";

import { useMemo, useState } from "react";
import type { Course, GradeComponent } from "../lib/types";
import { useProgress } from "./ProgressProvider";

function numberList(
  courseId: string,
  names: string[],
  grades: Record<string, Record<string, string>>
) {
  return names
    .map((name) => Number(grades[courseId]?.[name] ?? ""))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7);
}

export default function GradeBook({ course }: { course: Course }) {
  const {
    grades,
    setGrades,
    customActivities,
    setCustomActivities,
    targets,
    setTargets,
  } = useProgress();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const target = targets[course.id] ?? 5;

  const summary = useMemo(() => {
    let enteredWeight = 0;
    let contribution = 0;

    course.gradeComponents.forEach((component) => {
      const value = Number(grades[course.id]?.[component.name] ?? "");

      if (Number.isFinite(value) && value >= 1 && value <= 7) {
        enteredWeight += component.weight;
        contribution += value * (component.weight / 100);
      }
    });

    const remainingWeight = 100 - enteredWeight;
    const currentAverage =
      enteredWeight > 0 ? contribution / (enteredWeight / 100) : null;
    const required =
      remainingWeight > 0
        ? (target - contribution) / (remainingWeight / 100)
        : null;

    return { enteredWeight, remainingWeight, currentAverage, required };
  }, [course, grades, target]);

  function updateGroupAverage(
    component: GradeComponent,
    itemNames: string[],
    itemName: string,
    nextValue: string
  ) {
    setGrades((previous) => {
      const nextCourseGrades = {
        ...(previous[course.id] ?? {}),
        [itemName]: nextValue,
      };

      const values = itemNames
        .map((name) => Number(nextCourseGrades[name] ?? ""))
        .filter(
          (value) => Number.isFinite(value) && value >= 1 && value <= 7
        );

      const average =
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : "";

      return {
        ...previous,
        [course.id]: {
          ...nextCourseGrades,
          [component.name]: average === "" ? "" : String(average),
        },
      };
    });
  }

  function expandableNames(component: GradeComponent) {
    if (component.expandable === "economia-controls") {
      return Array.from({ length: 13 }, (_, index) => `Control ${index + 1}`);
    }

    if (component.expandable === "estadistica-pruebas") {
      return ["Prueba 1", "Prueba 2", "Prueba 3"];
    }

    if (component.expandable === "estadistica-controles") {
      return ["Control 1", "Control 2", "Control 3"];
    }

    const key = `${course.id}-${component.name}`;
    return customActivities[key] ?? [];
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Notas y simulador</h2>

      <div className="mt-4 space-y-3">
        {course.gradeComponents.map((component) => {
          if (!component.expandable) {
            return (
              <div
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
                  value={grades[course.id]?.[component.name] ?? ""}
                  onChange={(event) =>
                    setGrades((previous) => ({
                      ...previous,
                      [course.id]: {
                        ...(previous[course.id] ?? {}),
                        [component.name]: event.target.value,
                      },
                    }))
                  }
                  className="rounded-xl border px-3 py-2"
                  placeholder="Nota"
                />
              </div>
            );
          }

          const key = `${course.id}-${component.name}`;
          const names = expandableNames(component);
          const values = numberList(course.id, names, grades);
          const average =
            values.length > 0
              ? values.reduce((sum, value) => sum + value, 0) / values.length
              : null;

          return (
            <div key={component.name} className="rounded-2xl border">
              <button
                onClick={() =>
                  setExpanded((previous) => ({
                    ...previous,
                    [key]: !previous[key],
                  }))
                }
                className="flex w-full items-center justify-between gap-4 p-4 text-left"
              >
                <div>
                  <p className="font-medium">{component.name}</p>
                  <p className="text-sm text-slate-500">
                    Ponderación: {component.weight}%
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold">
                    {average === null
                      ? "Sin notas"
                      : `Promedio ${average.toFixed(2)}`}
                  </p>
                  <p className="text-sm text-slate-500">
                    {expanded[key] ? "Ocultar" : "Ver detalle"}
                  </p>
                </div>
              </button>

              {expanded[key] && (
                <div className="border-t p-4">
                  {component.expandable === "activities" && (
                    <button
                      onClick={() => {
                        const nextName = `Actividad ${names.length + 1}`;

                        setCustomActivities((previous) => ({
                          ...previous,
                          [key]: [...(previous[key] ?? []), nextName],
                        }));
                      }}
                      className="mb-4 rounded-xl bg-black px-4 py-2 text-sm text-white"
                    >
                      + Agregar actividad
                    </button>
                  )}

                  {names.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Todavía no hay actividades registradas.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {names.map((name) => (
                        <div
                          key={name}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                        >
                          <label className="text-sm font-medium">{name}</label>
                          <input
                            type="number"
                            min="1"
                            max="7"
                            step="0.1"
                            value={grades[course.id]?.[name] ?? ""}
                            onChange={(event) =>
                              updateGroupAverage(
                                component,
                                names,
                                name,
                                event.target.value
                              )
                            }
                            className="w-24 rounded-xl border bg-white px-3 py-2"
                            placeholder="Nota"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 md:grid-cols-3">
        <div>
          <p className="text-sm text-slate-500">Promedio actual</p>
          <p className="mt-1 text-3xl font-bold">
            {summary.currentAverage === null
              ? "—"
              : summary.currentAverage.toFixed(2)}
          </p>
          <p className="text-xs text-slate-400">
            {summary.enteredWeight}% registrado
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
                [course.id]: Number(event.target.value),
              }))
            }
            className="mt-2 w-full rounded-xl border bg-white px-3 py-2"
          />
        </div>

        <div>
          <p className="text-sm text-slate-500">
            Necesario en lo pendiente
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
  );
}
