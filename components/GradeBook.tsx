"use client";

import { useState } from "react";

import { deleteGradeItem, saveGradeItem } from "@/app/grade-actions";
import {
  calculateCourseGradeSummary,
  componentGrade,
  gradeComponentKey,
  gradeComponentKind,
  isValidGrade,
} from "@/lib/grades";
import type { Course, GradeComponent, GradeItem } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

function nextItemName(component: GradeComponent, count: number) {
  const singular = component.name
    .replace(/es$/i, "")
    .replace(/s$/i, "")
    .trim();
  return `${singular || "Evaluación"} ${count + 1}`;
}

function formatWeight(weight: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 2,
  }).format(weight);
}

export default function GradeBook({ course }: { course: Course }) {
  const {
    gradeItems,
    setGradeItems,
    gradesStatus,
    gradesError,
    targets,
    setTargets,
  } = useProgress();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const courseItems = gradeItems[course.id] ?? {};
  const target = targets[course.id] ?? 5;
  const summary = calculateCourseGradeSummary(course, courseItems);
  const required = summary.remainingWeight > 0
    ? (target - summary.contribution) / (summary.remainingWeight / 100)
    : null;

  function replaceItems(componentKey: string, items: GradeItem[]) {
    setGradeItems((previous) => ({
      ...previous,
      [course.id]: {
        ...(previous[course.id] ?? {}),
        [componentKey]: items,
      },
    }));
  }

  async function persistItem(
    component: GradeComponent,
    item: GradeItem,
    position: number,
    previousItems: GradeItem[]
  ) {
    if (!course.remoteId || !component.id) {
      setError("Este ramo todavía no terminó de sincronizarse. Recarga e inténtalo nuevamente.");
      return;
    }
    if (!item.name.trim()) {
      setError("El nombre de la evaluación no puede estar vacío.");
      return;
    }
    const key = gradeComponentKey(component);
    const items = courseItems[key] ?? [];
    if (items.some((candidate) => candidate.id !== item.id && candidate.name.trim().toLocaleLowerCase("es-CL") === item.name.trim().toLocaleLowerCase("es-CL"))) {
      setError("Ya existe una evaluación con ese nombre en la categoría.");
      replaceItems(key, previousItems);
      return;
    }

    setPendingId(item.id);
    setError("");
    const result = await saveGradeItem({
      courseId: course.remoteId,
      componentId: component.id,
      clientId: item.id,
      name: item.name,
      grade: item.grade,
      date: item.date,
      position,
    });
    if (!result.success) {
      replaceItems(key, previousItems);
      setError(result.error);
    } else {
      setGradeItems((previous) => ({
        ...previous,
        [course.id]: {
          ...(previous[course.id] ?? {}),
          [key]: (previous[course.id]?.[key] ?? []).map((candidate) =>
            candidate.id === item.id ? { ...candidate, remoteId: result.id } : candidate
          ),
        },
      }));
    }
    setPendingId(null);
  }

  function updateItem(component: GradeComponent, itemId: string, changes: Partial<GradeItem>) {
    const key = gradeComponentKey(component);
    const previousItems = courseItems[key] ?? [];
    if (
      changes.name !== undefined &&
      changes.name.trim() &&
      previousItems.some(
        (item) => item.id !== itemId &&
          item.name.trim().toLocaleLowerCase("es-CL") === changes.name!.trim().toLocaleLowerCase("es-CL")
      )
    ) {
      setError("Ya existe una evaluación con ese nombre en la categoría.");
      return;
    }
    const items = previousItems.map((item) => item.id === itemId ? { ...item, ...changes } : item);
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    replaceItems(key, items);
  }

  function commitItem(component: GradeComponent, item: GradeItem) {
    const key = gradeComponentKey(component);
    const items = courseItems[key] ?? [];
    void persistItem(component, item, items.indexOf(item), items);
  }

  function addItem(component: GradeComponent) {
    const key = gradeComponentKey(component);
    const previousItems = courseItems[key] ?? [];
    const item: GradeItem = {
      id: crypto.randomUUID(),
      name: nextItemName(component, previousItems.length),
    };
    const items = [...previousItems, item];
    replaceItems(key, items);
    void persistItem(component, item, items.length - 1, previousItems);
  }

  async function removeItem(component: GradeComponent, item: GradeItem) {
    if (!course.remoteId || !component.id) return;
    const key = gradeComponentKey(component);
    const previousItems = courseItems[key] ?? [];
    replaceItems(key, previousItems.filter((candidate) => candidate.id !== item.id));
    setPendingId(item.id);
    const result = await deleteGradeItem({
      courseId: course.remoteId,
      componentId: component.id,
      clientId: item.id,
    });
    if (!result.success) {
      replaceItems(key, previousItems);
      setError(result.error);
    }
    setPendingId(null);
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Notas y simulador</h2>
      {gradesStatus === "loading" ? (
        <p className="mt-3 text-sm text-slate-500">Cargando tus notas...</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {course.gradeComponents.map((component) => {
          const key = gradeComponentKey(component);
          const grouped = gradeComponentKind(component) === "grouped";
          const items = courseItems[key] ?? [];
          const average = componentGrade(items);
          const registered = items.filter((item) => isValidGrade(item.grade)).length;

          if (!grouped) {
            const item = items[0];
            return (
              <div key={key} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_110px] md:items-center">
                <div>
                  <p className="font-medium">{component.name}</p>
                  <p className="text-sm text-slate-500">Ponderación: {component.weight}%</p>
                </div>
                <input
                  aria-label={`Nota de ${component.name}`}
                  type="number"
                  min="1"
                  max="7"
                  step="0.1"
                  disabled={pendingId === item?.id || gradesStatus === "loading"}
                  value={item?.grade ?? ""}
                  onChange={(event) => {
                    const value = event.target.value === "" ? undefined : Number(event.target.value);
                    if (value !== undefined && !isValidGrade(value)) return;
                    if (item) updateItem(component, item.id, { grade: value });
                    else {
                      const created: GradeItem = { id: crypto.randomUUID(), name: component.name, grade: value };
                      replaceItems(key, [created]);
                    }
                  }}
                  onBlur={() => {
                    const current = (courseItems[key] ?? [])[0];
                    if (current) commitItem(component, current);
                  }}
                  className="rounded-xl border px-3 py-2 disabled:opacity-60"
                  placeholder="Nota"
                />
              </div>
            );
          }

          return (
            <div key={key} className="rounded-2xl border">
              <button
                type="button"
                aria-expanded={Boolean(expanded[key])}
                onClick={() => setExpanded((previous) => ({ ...previous, [key]: !previous[key] }))}
                className="flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <div>
                  <p className="font-medium">{component.name} · {component.weight}%</p>
                  <p className="text-sm text-slate-500">{registered} de {items.length} registradas</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{average === null ? "Sin notas" : `Promedio ${average.toFixed(2)}`}</p>
                  <p className="text-sm text-slate-500">{expanded[key] ? "Ocultar" : "Ver detalle"}</p>
                </div>
              </button>

              {expanded[key] ? (
                <div className="border-t p-4">
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_110px_auto] sm:items-center">
                        <div>
                          <input
                            aria-label="Nombre de evaluación"
                            value={item.name}
                            disabled={pendingId === item.id}
                            onChange={(event) => updateItem(component, item.id, { name: event.target.value })}
                            onBlur={() => commitItem(component, item)}
                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Ponderación: {formatWeight(component.weight / items.length)}%
                          </p>
                        </div>
                        <input
                          aria-label={`Nota de ${item.name}`}
                          type="number"
                          min="1"
                          max="7"
                          step="0.1"
                          value={item.grade ?? ""}
                          disabled={pendingId === item.id}
                          onChange={(event) => {
                            const value = event.target.value === "" ? undefined : Number(event.target.value);
                            if (value !== undefined && !isValidGrade(value)) return;
                            updateItem(component, item.id, { grade: value });
                          }}
                          onBlur={() => commitItem(component, item)}
                          className="rounded-lg border bg-white px-3 py-2 text-sm"
                          placeholder="Sin nota"
                        />
                        <button
                          type="button"
                          disabled={pendingId === item.id}
                          onClick={() => void removeItem(component, item)}
                          className="rounded-lg px-2 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addItem(component)}
                    disabled={pendingId !== null || !component.id || !course.remoteId}
                    className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ color: "#ffffff" }}
                  >
                    + Agregar {nextItemName(component, 0).replace(/ 1$/, "").toLocaleLowerCase("es-CL")}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {(error || gradesError) ? <p role="alert" className="mt-4 text-sm text-red-700">{error || gradesError}</p> : null}

      <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 md:grid-cols-3">
        <div>
          <p className="text-sm text-slate-500">Promedio actual</p>
          <p className="mt-1 text-3xl font-bold">{summary.currentAverage === null ? "—" : summary.currentAverage.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{summary.enteredWeight}% con notas · {summary.pendingItems} pendientes</p>
        </div>
        <div>
          <label className="text-sm text-slate-500">Promedio final objetivo</label>
          <input type="number" min="1" max="7" step="0.1" value={target} onChange={(event) => setTargets((previous) => ({ ...previous, [course.id]: Number(event.target.value) }))} className="mt-2 w-full rounded-xl border bg-white px-3 py-2" />
        </div>
        <div>
          <p className="text-sm text-slate-500">Necesario en lo pendiente</p>
          <p className="mt-1 text-3xl font-bold">{required === null ? "Completo" : required > 7 ? "Sobre 7,0" : required < 1 ? "Ya alcanzado" : required.toFixed(2)}</p>
          <p className="text-xs text-slate-400">Queda {summary.remainingWeight}% por evaluar</p>
        </div>
      </div>
    </section>
  );
}
