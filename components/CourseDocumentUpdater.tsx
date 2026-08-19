"use client";

import { useRef, useState, type ChangeEvent } from "react";

import type { ExtractedCourse } from "../lib/ai/course-schema";
import {
  extractedCourseToCourse,
  mergeCourseSupplement,
} from "../lib/course-mapper";
import { DAY_NAMES, formatDate } from "../lib/date";
import type { Course } from "../lib/types";
import { useAuthUser } from "./AuthUserProvider";
import { getUserStorageKey, USER_STORAGE_KEYS } from "../lib/user-storage";

type Status = "idle" | "processing" | "ready" | "error";

const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isSupportedDocument(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    file.type === WORD_MIME ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx")
  );
}

function isWordDocument(file: File) {
  return file.type === WORD_MIME || file.name.toLowerCase().endsWith(".docx");
}

function detectedChanges(current: Course, candidate: Course) {
  const changes: string[] = [];
  const updatedRooms = candidate.classes.filter((block) => {
    const previous = current.classes.find(
      (item) =>
        item.day === block.day &&
        item.start === block.start &&
        item.end === block.end
    );

    return block.room && block.room !== previous?.room;
  }).length;
  const newClasses = Math.max(0, candidate.classes.length - current.classes.length);
  const newEvaluations = Math.max(
    0,
    candidate.evaluations.length - current.evaluations.length
  );
  const updatedEvaluations = candidate.evaluations.filter((evaluation) => {
    const previous = current.evaluations.find(
      (item) => item.name.trim().toLowerCase() === evaluation.name.trim().toLowerCase()
    );

    return previous && JSON.stringify(previous) !== JSON.stringify(evaluation);
  }).length;
  const newTasks = Math.max(
    0,
    candidate.autonomousTasks.length - current.autonomousTasks.length
  );

  if (updatedRooms > 0) changes.push(`${updatedRooms} sala(s) actualizada(s)`);
  if (newClasses > 0) changes.push(`${newClasses} bloque(s) de clase nuevo(s)`);
  if (newEvaluations > 0) changes.push(`${newEvaluations} evaluación(es) nueva(s)`);
  if (updatedEvaluations > 0) {
    changes.push(`${updatedEvaluations} evaluación(es) actualizada(s)`);
  }
  if (newTasks > 0) changes.push(`${newTasks} tarea(s) autónoma(s) nueva(s)`);
  if (candidate.totalClasses !== current.totalClasses) {
    changes.push(`Total de clases: ${candidate.totalClasses}`);
  }
  if (candidate.attendanceRequired !== current.attendanceRequired) {
    changes.push(
      `Asistencia mínima: ${candidate.attendanceRequired ?? "no informada"}%`
    );
  }
  if (candidate.attendanceNote !== current.attendanceNote) {
    changes.push("Reglas de asistencia actualizadas");
  }
  if (candidate.autonomousHours !== current.autonomousHours) {
    changes.push(`Trabajo autónomo: ${candidate.autonomousHours} h semanales`);
  }
  if (candidate.professor !== current.professor || candidate.email !== current.email) {
    changes.push("Información del profesor actualizada");
  }

  return changes;
}

export default function CourseDocumentUpdater({
  course,
  onUpdated,
}: {
  course: Course;
  onUpdated: (
    course: Course
  ) => Promise<{ success: boolean; error?: string }>;
}) {
  const { userId } = useAuthUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [candidate, setCandidate] = useState<Course | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []).filter(
      isSupportedDocument
    );

    setFiles(selectedFiles);
    setCandidate(null);
    setStatus("idle");
    setError("");
    setWarnings([]);
  }

  async function processFiles() {
    if (files.length === 0 || status === "processing") return;

    try {
      setStatus("processing");
      setCandidate(null);
      setError("");
      setWarnings([]);

      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("existingCourse", JSON.stringify(course));
      if (!userId) {
        throw new Error("Debes iniciar sesión para actualizar este ramo.");
      }

      const semester = sessionStorage.getItem(
        getUserStorageKey(userId, USER_STORAGE_KEYS.semester)
      );
      if (semester) formData.append("semester", semester);

      const containsWord = files.some(isWordDocument);
      const response = await fetch(
        containsWord
          ? "/api/process-syllabus-flex"
          : "/api/process-syllabus",
        {
          method: "POST",
          body: formData,
        }
      );
      const result = await response.json();

      if (!response.ok || !result.success || result.courses?.length !== 1) {
        throw new Error(
          result.error ?? "No fue posible actualizar este ramo."
        );
      }

      const mapped = extractedCourseToCourse(
        result.courses[0] as ExtractedCourse
      );

      setCandidate(mergeCourseSupplement(course, mapped));
      setWarnings(
        Array.isArray(result.courses[0].missingInformation)
          ? result.courses[0].missingInformation
          : []
      );
      setStatus("ready");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocurrió un error inesperado."
      );
      setStatus("error");
    }
  }

  async function confirmUpdate() {
    if (!candidate) return;

    setStatus("processing");
    const result = await onUpdated(candidate);

    if (!result.success) {
      setError(result.error ?? "No fue posible guardar la actualización.");
      setStatus("error");
      return;
    }

    setFiles([]);
    setCandidate(null);
    setStatus("idle");
    setError("");
    setWarnings([]);

    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Agregar información al ramo</h2>
      <p className="mt-2 text-sm text-slate-600">
        Sube uno o más documentos PDF o Word (.docx) para agregar salas,
        horarios, evaluaciones, asistencia u otras indicaciones a {course.name}.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={`.pdf,.docx,application/pdf,${WORD_MIME}`}
        multiple
        onChange={selectFiles}
        className="hidden"
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "processing"}
          className="rounded-xl border bg-white px-4 py-2 disabled:opacity-50"
        >
          Seleccionar documentos
        </button>

        {files.length > 0 && (
          <>
            <p className="text-sm text-slate-600">
              {files.length === 1 ? files[0].name : `${files.length} documentos`}
            </p>
            <button
              type="button"
              onClick={processFiles}
              disabled={status === "processing"}
              className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {status === "processing" ? "Procesando..." : "Procesar documento"}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {candidate && (
        <div className="mt-5 rounded-2xl border p-5">
          <h3 className="font-semibold">Información fusionada</h3>
          {detectedChanges(course, candidate).length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm font-medium text-emerald-700">
              {detectedChanges(course, candidate).map((change) => (
                <li key={change}>+ {change}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              No pudimos identificar automáticamente qué campos cambiaron.
              Revisa el resumen inferior; igualmente puedes guardar el resultado.
            </p>
          )}

          {warnings.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">Datos que requieren revisión</p>
              <ul className="mt-1 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            {candidate.classes.map((block, index) => (
              <p key={`${block.day}-${block.start}-${index}`}>
                {DAY_NAMES[block.day]} {block.start}–{block.end}
                {block.room ? ` · Sala: ${block.room}` : ""}
              </p>
            ))}
            <p>{candidate.evaluations.length} evaluaciones registradas</p>
            <p>{candidate.autonomousTasks.length} tareas autónomas registradas</p>
            <p>
              {candidate.classSessions.filter((session) => session.status === "scheduled").length} sesiones programadas
              {" · "}
              {candidate.classSessions.filter((session) => session.status === "cancelled").length} canceladas
            </p>
          </div>

          {candidate.evaluations.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold">Evaluaciones que quedarán guardadas</h4>
              <div className="mt-2 space-y-2">
                {candidate.evaluations.map((evaluation) => (
                  <article
                    key={`${evaluation.name}-${evaluation.date}`}
                    className="rounded-xl bg-slate-50 p-3 text-sm"
                  >
                    <p className="font-medium">
                      {evaluation.name} · {formatDate(evaluation.date)}
                      {evaluation.time ? ` · ${evaluation.time}` : ""}
                    </p>
                    {evaluation.detail && (
                      <p className="mt-1 text-slate-600">{evaluation.detail}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmUpdate}
              className="rounded-xl bg-black px-5 py-2 text-white"
            >
              Guardar actualización
            </button>
            <button
              type="button"
              onClick={() => {
                setCandidate(null);
                setStatus("idle");
                setWarnings([]);
              }}
              className="rounded-xl border px-5 py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
