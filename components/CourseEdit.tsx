"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { DAY_NAMES } from "@/lib/date";
import type { Course, Evaluation, EvaluationKind } from "@/lib/types";
import { useSavedCourses } from "@/lib/use-saved-courses";
import { useAuthUser } from "./AuthUserProvider";
import PageShell from "./PageShell";
import { useProgress } from "./ProgressProvider";

const evaluationKinds: { value: EvaluationKind; label: string }[] = [
  { value: "control", label: "Control" },
  { value: "prueba", label: "Prueba" },
  { value: "examen", label: "Examen" },
  { value: "entrega", label: "Entrega" },
  { value: "presentacion", label: "Presentación" },
  { value: "actividad", label: "Actividad" },
];

function cloneCourse(course: Course): Course {
  return JSON.parse(JSON.stringify(course)) as Course;
}

export default function CourseEdit({ courseId }: { courseId: string }) {
  const { courses, isLoading, error, replaceCourse } = useSavedCourses();
  const course = courses.find((item) => item.id === courseId);

  if (isLoading) {
    return (
      <PageShell title="Editar ramo">
        <p className="text-slate-500">Cargando información...</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Editar ramo">
        <p role="alert" className="text-slate-600">{error}</p>
      </PageShell>
    );
  }

  if (!course) {
    return (
      <PageShell title="No encontramos este ramo">
        <Link
          href="/ramos"
          className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          style={{ color: "#ffffff" }}
        >
          Volver a Mis ramos
        </Link>
      </PageShell>
    );
  }

  return (
    <CourseEditForm
      key={course.id}
      initialCourse={course}
      replaceCourse={replaceCourse}
    />
  );
}

function CourseEditForm({
  initialCourse,
  replaceCourse,
}: {
  initialCourse: Course;
  replaceCourse: (
    course: Course
  ) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const { userId } = useAuthUser();
  const { grades } = useProgress();
  const [draft, setDraft] = useState(() => cloneCourse(initialCourse));
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [deleteWarning, setDeleteWarning] = useState("");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const discardDialogRef = useRef<HTMLDialogElement>(null);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialCourse);

  useEffect(() => {
    if (!isDirty) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function interceptLink(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;

      event.preventDefault();
      setPendingHref(link.href);
      discardDialogRef.current?.showModal();
    }

    function confirmHistoryNavigation() {
      const shouldDiscard = window.confirm(
        "¿Descartar los cambios? Los cambios que hiciste no se guardarán."
      );

      if (!shouldDiscard) window.history.forward();
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", confirmHistoryNavigation);
    document.addEventListener("click", interceptLink, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", confirmHistoryNavigation);
      document.removeEventListener("click", interceptLink, true);
    };
  }, [isDirty]);

  function updateCourse<K extends keyof Course>(field: K, value: Course[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function requestCancel() {
    if (!isDirty) {
      router.push(`/ramos/${encodeURIComponent(initialCourse.id)}`);
      return;
    }

    setPendingHref(`/ramos/${encodeURIComponent(initialCourse.id)}`);
    discardDialogRef.current?.showModal();
  }

  function discardChanges() {
    const href = pendingHref;
    discardDialogRef.current?.close();
    if (href) {
      const destination = new URL(href, window.location.origin);
      if (destination.origin === window.location.origin) {
        router.push(`${destination.pathname}${destination.search}${destination.hash}`);
      } else {
        window.location.assign(destination.href);
      }
    } else {
      router.push(`/ramos/${encodeURIComponent(initialCourse.id)}`);
    }
  }

  function updateClass(index: number, field: keyof Course["classes"][number], value: string | number) {
    updateCourse(
      "classes",
      draft.classes.map((block, blockIndex) =>
        blockIndex === index ? { ...block, [field]: value } : block
      )
    );
  }

  function updateEvaluation<K extends keyof Evaluation>(
    index: number,
    field: K,
    value: Evaluation[K]
  ) {
    updateCourse(
      "evaluations",
      draft.evaluations.map((evaluation, evaluationIndex) =>
        evaluationIndex === index ? { ...evaluation, [field]: value } : evaluation
      )
    );
  }

  function requestDeleteEvaluation(index: number) {
    const evaluation = draft.evaluations[index];
    const associatedGrade = grades[initialCourse.id]?.[evaluation.name];

    if (associatedGrade?.trim()) {
      setDeleteWarning(
        `No puedes eliminar “${evaluation.name}” porque existe una nota registrada con ese nombre.`
      );
      return;
    }

    setDeleteWarning("");
    setDeleteIndex(index);
    deleteDialogRef.current?.showModal();
  }

  function confirmDeleteEvaluation() {
    if (deleteIndex === null) return;
    updateCourse(
      "evaluations",
      draft.evaluations.filter((_, index) => index !== deleteIndex)
    );
    setDeleteIndex(null);
    deleteDialogRef.current?.close();
  }

  function validate() {
    const normalizedName = draft.name.trim().replace(/\s+/g, " ");
    setNameError("");
    setError("");

    if (!normalizedName) {
      setNameError("El nombre del ramo es obligatorio.");
      return null;
    }

    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      setError("Revisa el email del profesor.");
      return null;
    }

    if (
      draft.classes.some(
        (block) =>
          !Number.isInteger(block.day) ||
          block.day < 0 ||
          block.day > 6 ||
          !block.start ||
          !block.end ||
          block.start >= block.end
      )
    ) {
      setError("Cada horario debe tener un día válido y una hora de término posterior al inicio.");
      return null;
    }

    if (
      draft.evaluations.some(
        (evaluation) => !evaluation.name.trim() || !evaluation.date
      )
    ) {
      setError("Cada evaluación debe tener nombre y fecha.");
      return null;
    }

    if (
      draft.autonomousHours < 0 ||
      !Number.isFinite(draft.autonomousHours) ||
      draft.totalClasses < 0 ||
      !Number.isInteger(draft.totalClasses) ||
      (draft.attendanceRequired !== undefined &&
        (draft.attendanceRequired < 0 || draft.attendanceRequired > 100))
    ) {
      setError("Revisa las horas, el total de clases y el porcentaje de asistencia.");
      return null;
    }

    return {
      ...draft,
      id: initialCourse.id,
      name: normalizedName,
      professor: draft.professor.trim().replace(/\s+/g, " "),
      email: draft.email.trim(),
      attendanceNote: draft.attendanceNote?.trim() || undefined,
      classes: draft.classes.map((block) => ({
        ...block,
        room: block.room?.trim() || undefined,
      })),
      evaluations: draft.evaluations
        .map((evaluation) => ({
          ...evaluation,
          name: evaluation.name.trim().replace(/\s+/g, " "),
          detail: evaluation.detail?.trim() || undefined,
          time: evaluation.time || undefined,
        }))
        .sort((a, b) =>
          `${a.date} ${a.time ?? "23:59"}`.localeCompare(
            `${b.date} ${b.time ?? "23:59"}`
          )
        ),
    } satisfies Course;
  }

  function save() {
    const updatedCourse = validate();
    if (!updatedCourse || !userId) return;

    startTransition(async () => {
      try {
        const remoteResult = await replaceCourse(updatedCourse);
        if (!remoteResult.success) {
          setError(remoteResult.error ?? "No fue posible guardar los cambios.");
          return;
        }
        router.push(`/ramos/${encodeURIComponent(initialCourse.id)}`);
      } catch (caughtError) {
        console.error("No fue posible actualizar el ramo:", caughtError);
        setError("No fue posible guardar los cambios. Inténtalo nuevamente.");
      }
    });
  }

  return (
    <main className="min-h-screen pb-24 md:ml-64 md:pb-8">
      <div className="mx-auto max-w-4xl p-5 md:p-8">
        <button
          type="button"
          onClick={requestCancel}
          className="rounded-lg py-2 text-sm font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
        >
          ← Volver al ramo
        </button>
        <header className="mt-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Mis ramos
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Editar ramo</h1>
          <p className="mt-2 text-slate-600">
            Corrige la información académica sin cambiar la identidad del ramo.
          </p>
        </header>

        <form
          className="mt-7 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <EditorSection title="Información">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Nombre del ramo"
                required
                value={draft.name}
                onChange={(value) => updateCourse("name", value)}
                error={nameError}
              />
              <TextField
                label="Profesor"
                value={draft.professor}
                onChange={(value) => updateCourse("professor", value)}
              />
              <TextField
                label="Email del profesor"
                type="email"
                value={draft.email}
                onChange={(value) => updateCourse("email", value)}
              />
              <NumberField
                label="Horas autónomas semanales"
                value={draft.autonomousHours}
                min={0}
                step={0.5}
                onChange={(value) => updateCourse("autonomousHours", value)}
              />
              <NumberField
                label="Total de clases"
                value={draft.totalClasses}
                min={0}
                step={1}
                onChange={(value) => updateCourse("totalClasses", value)}
              />
            </div>
          </EditorSection>

          <EditorSection title="Horario">
            <div className="space-y-4">
              {draft.classes.map((block, index) => (
                <div key={index} className="rounded-2xl bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm font-medium text-slate-700">
                      Día
                      <select
                        value={block.day}
                        onChange={(event) => updateClass(index, "day", Number(event.target.value))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                      >
                        {DAY_NAMES.map((day, dayIndex) => (
                          <option key={day} value={dayIndex}>{day}</option>
                        ))}
                      </select>
                    </label>
                    <TextField label="Hora inicio" type="time" value={block.start} onChange={(value) => updateClass(index, "start", value)} />
                    <TextField label="Hora término" type="time" value={block.end} onChange={(value) => updateClass(index, "end", value)} />
                    <TextField label="Sala" value={block.room ?? ""} onChange={(value) => updateClass(index, "room", value)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateCourse("classes", draft.classes.filter((_, blockIndex) => blockIndex !== index))}
                    className="mt-3 rounded-lg px-2 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                  >
                    Eliminar bloque
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateCourse("classes", [...draft.classes, { day: 1, start: "08:30", end: "09:50", room: "" }])}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                + Agregar horario
              </button>
            </div>
          </EditorSection>

          <EditorSection title="Evaluaciones">
            {deleteWarning && (
              <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                {deleteWarning}
              </p>
            )}
            <div className="space-y-4">
              {draft.evaluations.map((evaluation, index) => (
                <div key={index} className="rounded-2xl bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField label="Nombre" required value={evaluation.name} onChange={(value) => updateEvaluation(index, "name", value)} />
                    <label className="text-sm font-medium text-slate-700">
                      Tipo
                      <select
                        value={evaluation.kind}
                        onChange={(event) => updateEvaluation(index, "kind", event.target.value as EvaluationKind)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                      >
                        {evaluationKinds.map((kind) => (
                          <option key={kind.value} value={kind.value}>{kind.label}</option>
                        ))}
                      </select>
                    </label>
                    <TextField label="Fecha" required type="date" value={evaluation.date} onChange={(value) => updateEvaluation(index, "date", value)} />
                    <TextField label="Hora" type="time" value={evaluation.time ?? ""} onChange={(value) => updateEvaluation(index, "time", value || undefined)} />
                    <label className="text-sm font-medium text-slate-700 md:col-span-2">
                      Detalle
                      <textarea
                        value={evaluation.detail ?? ""}
                        onChange={(event) => updateEvaluation(index, "detail", event.target.value || undefined)}
                        rows={3}
                        className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestDeleteEvaluation(index)}
                    className="mt-3 rounded-lg px-2 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                  >
                    Eliminar evaluación {evaluation.name || index + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateCourse("evaluations", [...draft.evaluations, { name: "", kind: "actividad", date: "" }])}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                + Agregar evaluación
              </button>
            </div>
          </EditorSection>

          <EditorSection title="Asistencia">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Porcentaje mínimo requerido
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.attendanceRequired ?? ""}
                  onChange={(event) => updateCourse("attendanceRequired", event.target.value === "" ? undefined : Number(event.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Regla o nota de asistencia
                <textarea
                  value={draft.attendanceNote ?? ""}
                  onChange={(event) => updateCourse("attendanceNote", event.target.value || undefined)}
                  rows={4}
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                />
              </label>
            </div>
          </EditorSection>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={requestCancel} disabled={isPending} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold hover:bg-slate-50 disabled:opacity-60">
              Cancelar
            </button>
            <button type="submit" disabled={isPending || !isDirty} className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ color: "#ffffff" }}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>

      <dialog ref={deleteDialogRef} aria-labelledby="delete-evaluation-title" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 shadow-xl backdrop:bg-slate-950/35">
        <h2 id="delete-evaluation-title" className="text-xl font-semibold">¿Eliminar esta evaluación?</h2>
        <p className="mt-2 text-sm text-slate-600">Esta acción quitará la evaluación del calendario y del ramo.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" autoFocus onClick={() => deleteDialogRef.current?.close()} className="rounded-xl border px-4 py-2.5 font-semibold">Cancelar</button>
          <button type="button" onClick={confirmDeleteEvaluation} className="rounded-xl bg-red-700 px-4 py-2.5 font-semibold text-white" style={{ color: "#ffffff" }}>Eliminar</button>
        </div>
      </dialog>

      <dialog ref={discardDialogRef} aria-labelledby="discard-title" onClose={() => setPendingHref(null)} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 shadow-xl backdrop:bg-slate-950/35">
        <h2 id="discard-title" className="text-xl font-semibold">¿Descartar los cambios?</h2>
        <p className="mt-2 text-sm text-slate-600">Los cambios que hiciste no se guardarán.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" autoFocus onClick={() => discardDialogRef.current?.close()} className="rounded-xl border px-4 py-2.5 font-semibold">Seguir editando</button>
          <button type="button" onClick={discardChanges} className="rounded-xl bg-slate-950 px-4 py-2.5 font-semibold text-white" style={{ color: "#ffffff" }}>Descartar</button>
        </div>
      </dialog>
    </main>
  );
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TextField({ label, value, onChange, type = "text", required = false, error = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; error?: string }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}{required ? " *" : ""}
      <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

function NumberField({ label, value, onChange, min, step }: { label: string; value: number; onChange: (value: number) => void; min: number; step: number }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input type="number" value={value} min={min} step={step} onChange={(event) => onChange(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" />
    </label>
  );
}
