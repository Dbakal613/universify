"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ExtractedCourse } from "@/lib/ai/course-schema";
import { extractedCourseToCourse } from "@/lib/course-mapper";
import { useSavedCourses } from "@/lib/use-saved-courses";
import { useAuthUser } from "@/components/AuthUserProvider";
import { getUserStorageKey, USER_STORAGE_KEYS } from "@/lib/user-storage";

type EditableCourseFields = Pick<
  ExtractedCourse,
  "name" | "code" | "totalHours" | "autonomousHours"
>;

export default function ReviewPage() {
  const router = useRouter();
  const { userId, isAuthLoading } = useAuthUser();
  const { courses: savedCourses, saveCourses } = useSavedCourses();

  const [courses, setCourses] = useState<ExtractedCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isAuthLoading) return;

    if (!userId) {
      const timeoutId = window.setTimeout(() => {
        setCourses([]);
        setIsLoading(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(
          getUserStorageKey(userId, USER_STORAGE_KEYS.extractedCourses)
        );

        if (!saved) {
          setIsLoading(false);
          return;
        }

        const parsed = JSON.parse(saved) as ExtractedCourse[];
        setCourses(parsed);
      } catch {
        setCourses([]);
      } finally {
        setIsLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthLoading, userId]);

  function updateCourse<K extends keyof EditableCourseFields>(
    courseIndex: number,
    field: K,
    value: EditableCourseFields[K]
  ) {
    setCourses((current) =>
      current.map((course, index) =>
        index === courseIndex
          ? {
              ...course,
              [field]: value,
            }
          : course
      )
    );
  }

  function updateProfessor(
    courseIndex: number,
    field: "name" | "email",
    value: string
  ) {
    setCourses((current) =>
      current.map((course, index) =>
        index === courseIndex
          ? {
              ...course,
              professor: {
                ...course.professor,
                [field]: value || null,
              },
            }
          : course
      )
    );
  }

  function updateEvaluation(
    courseIndex: number,
    evaluationIndex: number,
    field: "name" | "date" | "time" | "topics",
    value: string
  ) {
    setCourses((current) =>
      current.map((course, index) => {
        if (index !== courseIndex) {
          return course;
        }

        return {
          ...course,
          evaluations: course.evaluations.map(
            (evaluation, currentEvaluationIndex) =>
              currentEvaluationIndex === evaluationIndex
                ? {
                    ...evaluation,
                    [field]:
                      field === "name"
                        ? value
                        : value || null,
                  }
                : evaluation
          ),
        };
      })
    );
  }

  function removeEvaluation(
    courseIndex: number,
    evaluationIndex: number
  ) {
    setCourses((current) =>
      current.map((course, index) =>
        index === courseIndex
          ? {
              ...course,
              evaluations: course.evaluations.filter(
                (_, currentEvaluationIndex) =>
                  currentEvaluationIndex !== evaluationIndex
              ),
            }
          : course
      )
    );
  }

  function saveChanges() {
    setSaveError("");

    startTransition(async () => {
      try {
        if (!userId) {
          setSaveError("Debes iniciar sesión para guardar tus ramos.");
          return;
        }

        const newCourses = courses.map((course, index) =>
          extractedCourseToCourse(
            course,
            savedCourses.length + index
          )
        );

        const remoteResult = await saveCourses(newCourses);

        if (!remoteResult.success) {
          setSaveError(remoteResult.error ?? "No fue posible guardar los ramos.");
          return;
        }

        sessionStorage.removeItem(
          getUserStorageKey(userId, USER_STORAGE_KEYS.extractedCourses)
        );

        router.push("/");
      } catch (error) {
        console.error(
          "No fue posible guardar los cursos:",
          error
        );
        setSaveError(
          "No fue posible guardar los ramos. Inténtalo nuevamente."
        );
      }
    });
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 pb-24 md:ml-64 md:pb-8">
        <p>Preparando la revisión...</p>
      </main>
    );
  }

  if (courses.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10 pb-24 md:ml-64 md:pb-10">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">
            No hay cursos para revisar
          </h1>

          <p className="mt-3 text-slate-600">
            Primero debes subir y procesar tus documentos.
          </p>

          <button
            onClick={() =>
              router.push("/onboarding/upload")
            }
            className="mt-6 rounded-xl bg-black px-5 py-3 text-white"
          >
            Volver a subir documentos
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 pb-24 text-slate-900 md:ml-64 md:pb-10">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Universify
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Revisa la información detectada
          </h1>

          <p className="mt-3 text-slate-600">
            Corrige cualquier dato antes de guardar tus ramos.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          {courses.map((course, courseIndex) => (
            <section
              key={`${course.name}-${courseIndex}`}
              className="rounded-3xl bg-white p-6 shadow-sm"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Nombre del ramo"
                  value={course.name}
                  onChange={(value) =>
                    updateCourse(
                      courseIndex,
                      "name",
                      value
                    )
                  }
                />

                <Field
                  label="Código"
                  value={course.code ?? ""}
                  onChange={(value) =>
                    updateCourse(
                      courseIndex,
                      "code",
                      value || null
                    )
                  }
                />

                <Field
                  label="Profesor"
                  value={course.professor.name ?? ""}
                  onChange={(value) =>
                    updateProfessor(
                      courseIndex,
                      "name",
                      value
                    )
                  }
                />

                <Field
                  label="Correo"
                  value={course.professor.email ?? ""}
                  onChange={(value) =>
                    updateProfessor(
                      courseIndex,
                      "email",
                      value
                    )
                  }
                />

                <NumberField
                  label="Horas totales"
                  value={course.totalHours}
                  onChange={(value) =>
                    updateCourse(
                      courseIndex,
                      "totalHours",
                      value
                    )
                  }
                />

                <NumberField
                  label="Horas autónomas semanales"
                  value={course.autonomousHours}
                  onChange={(value) =>
                    updateCourse(
                      courseIndex,
                      "autonomousHours",
                      value
                    )
                  }
                />
              </div>

              <div className="mt-8">
                <h2 className="text-xl font-semibold">
                  Horario de clases
                </h2>

                {course.classes.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    No se detectaron horarios de clases.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {course.classes.map(
                      (classBlock, index) => (
                        <article
                          key={index}
                          className="rounded-2xl border p-4"
                        >
                          <p className="font-medium">
                            Día {classBlock.day}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {classBlock.start}–
                            {classBlock.end}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {classBlock.room ??
                              "Sala no informada"}
                          </p>
                        </article>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8">
                <h2 className="text-xl font-semibold">
                  Evaluaciones
                </h2>

                {course.evaluations.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    No se detectaron evaluaciones.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {course.evaluations.map(
                      (
                        evaluation,
                        evaluationIndex
                      ) => (
                        <article
                          key={`${evaluation.name}-${evaluationIndex}`}
                          className="rounded-2xl border p-4"
                        >
                          <div className="grid gap-3 md:grid-cols-[1fr_180px_130px_auto]">
                            <input
                              value={evaluation.name}
                              onChange={(event) =>
                                updateEvaluation(
                                  courseIndex,
                                  evaluationIndex,
                                  "name",
                                  event.target.value
                                )
                              }
                              className="rounded-xl border px-3 py-2"
                            />

                            <input
                              type="date"
                              value={
                                evaluation.date ?? ""
                              }
                              onChange={(event) =>
                                updateEvaluation(
                                  courseIndex,
                                  evaluationIndex,
                                  "date",
                                  event.target.value
                                )
                              }
                              className="rounded-xl border px-3 py-2"
                            />

                            <input
                              type="time"
                              value={evaluation.time ?? ""}
                              onChange={(event) =>
                                updateEvaluation(
                                  courseIndex,
                                  evaluationIndex,
                                  "time",
                                  event.target.value
                                )
                              }
                              aria-label={`Hora de ${evaluation.name}`}
                              className="rounded-xl border px-3 py-2"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                removeEvaluation(
                                  courseIndex,
                                  evaluationIndex
                                )
                              }
                              className="rounded-xl border px-4 py-2 text-sm text-red-600"
                            >
                              Eliminar
                            </button>
                          </div>

                          <textarea
                            value={
                              evaluation.topics ?? ""
                            }
                            onChange={(event) =>
                              updateEvaluation(
                                courseIndex,
                                evaluationIndex,
                                "topics",
                                event.target.value
                              )
                            }
                            placeholder="Contenidos o materia"
                            className="mt-3 min-h-20 w-full rounded-xl border px-3 py-2"
                          />
                        </article>
                      )
                    )}
                  </div>
                )}
              </div>

              {course.missingInformation.length >
                0 && (
                <div className="mt-8 rounded-2xl bg-amber-50 p-5">
                  <h2 className="font-semibold text-amber-900">
                    Información que debes revisar
                  </h2>

                  <ul className="mt-3 space-y-2 text-sm text-amber-800">
                    {course.missingInformation.map(
                      (information, index) => (
                        <li key={index}>
                          • {information}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>

        {saveError && (
          <p
            role="alert"
            className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {saveError}
          </p>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={saveChanges}
            disabled={isPending}
            className="rounded-xl bg-black px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Guardar y continuar"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-600">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-xl border bg-white px-3 py-2"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-600">
        {label}
      </span>

      <input
        type="number"
        min="0"
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value
              ? Number(event.target.value)
              : null
          )
        }
        className="mt-2 w-full rounded-xl border bg-white px-3 py-2"
      />
    </label>
  );
}
