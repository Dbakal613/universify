"use client";

import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import type { ExtractedCourse } from "@/lib/ai/course-schema";
import { useAuthUser } from "@/components/AuthUserProvider";
import { getUserStorageKey, USER_STORAGE_KEYS } from "@/lib/user-storage";

type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "error";

type UploadedDocument = {
  id: string;
  file: File;
};

export default function UploadPage() {
  const router = useRouter();
  const { userId } = useAuthUser();

  const inputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<
    UploadedDocument[]
  >([]);

  const [status, setStatus] =
    useState<ProcessingStatus>("pending");

  const [error, setError] = useState<string | null>(
    null
  );

  const [extractedCourses, setExtractedCourses] =
    useState<ExtractedCourse[]>([]);

  function addFiles(files: File[]) {
    const pdfFiles = files.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    );

    const newDocuments = pdfFiles.map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
    }));

    setDocuments((current) => [
      ...current,
      ...newDocuments,
    ]);

    setStatus("pending");
    setError(null);
    setExtractedCourses([]);
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    addFiles(files);

    event.target.value = "";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    const files = Array.from(
      event.dataTransfer.files
    );

    addFiles(files);
  }

  function removeDocument(id: string) {
    if (status === "processing") {
      return;
    }

    setDocuments((current) =>
      current.filter(
        (document) => document.id !== id
      )
    );

    setStatus("pending");
    setExtractedCourses([]);
    setError(null);
  }

  async function processDocuments() {
    if (
      documents.length === 0 ||
      status === "processing"
    ) {
      return;
    }

    try {
      setStatus("processing");
      setError(null);
      setExtractedCourses([]);

      const formData = new FormData();

      documents.forEach((document) => {
        formData.append(
          "files",
          document.file
        );
      });

      if (!userId) {
        throw new Error("Debes iniciar sesión para procesar tus documentos.");
      }

      const semester = sessionStorage.getItem(
        getUserStorageKey(userId, USER_STORAGE_KEYS.semester)
      );
      if (semester) formData.append("semester", semester);

      const response = await fetch(
        "/api/process-syllabus",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ??
            "No fue posible procesar los documentos."
        );
      }

      if (
        !Array.isArray(result.courses) ||
        result.courses.length === 0
      ) {
        throw new Error(
          "No se pudo identificar ningún ramo en los documentos."
        );
      }

      const courses =
        result.courses as ExtractedCourse[];

      setExtractedCourses(courses);

      sessionStorage.setItem(
        getUserStorageKey(userId, USER_STORAGE_KEYS.extractedCourses),
        JSON.stringify(courses)
      );

      setStatus("completed");
    } catch (error) {
      console.error(
        "Error procesando documentos:",
        error
      );

      setStatus("error");

      setError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado."
      );
    }
  }

  function continueToReview() {
    if (extractedCourses.length === 0) {
      return;
    }

    router.push("/onboarding/review");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Universify
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Agrega tu primer ramo
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Sube el syllabus, programa, cronograma u
            otros documentos del mismo ramo.
            Universify combinará la información antes
            de que la revises.
          </p>
        </header>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div
          onClick={() =>
            inputRef.current?.click()
          }
          onDragOver={(event) =>
            event.preventDefault()
          }
          onDrop={handleDrop}
          className="mt-8 cursor-pointer rounded-3xl border-2 border-dashed border-slate-300 bg-white px-8 py-14 text-center transition hover:border-slate-500"
        >
          <p className="text-xl font-semibold">
            Arrastra los documentos del ramo aquí
          </p>

          <p className="mt-2 text-slate-500">
            También puedes hacer clic para
            seleccionarlos
          </p>

          <p className="mt-4 text-sm text-slate-400">
            Puedes subir varios PDF del mismo ramo
          </p>
        </div>

        {documents.length > 0 && (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Documentos del ramo
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {documents.length === 1
                    ? "1 documento seleccionado"
                    : `${documents.length} documentos seleccionados`}
                </p>
              </div>

              <button
                type="button"
                onClick={processDocuments}
                disabled={
                  status === "processing"
                }
                className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "processing"
                  ? "Preparando ramo..."
                  : status === "completed"
                    ? "Procesar nuevamente"
                    : "Preparar ramo"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-2xl border p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {document.file.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {(
                          document.file.size /
                          1024 /
                          1024
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                    </div>

                    {status !== "processing" && (
                      <button
                        type="button"
                        onClick={() =>
                          removeDocument(
                            document.id
                          )
                        }
                        className="text-sm text-slate-400 hover:text-red-600"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {status === "processing" && (
              <div className="mt-6 rounded-2xl bg-blue-50 p-5">
                <p className="font-medium text-blue-900">
                  Preparando la información del ramo
                </p>

                <p className="mt-1 text-sm text-blue-700">
                  Estamos combinando la información
                  disponible en tus documentos.
                </p>
              </div>
            )}

            {status === "error" && error && (
              <div className="mt-6 rounded-2xl bg-red-50 p-5">
                <p className="font-medium text-red-800">
                  No fue posible preparar el ramo
                </p>

                <p className="mt-2 text-sm text-red-700">
                  {error}
                </p>
              </div>
            )}

            {status === "completed" && (
              <div className="mt-6 rounded-2xl bg-emerald-50 p-5">
                <p className="font-medium text-emerald-900">
                  Información preparada
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  Revisa ahora los datos detectados
                  antes de guardar el ramo.
                </p>
              </div>
            )}

            {status === "completed" &&
              extractedCourses.length > 0 && (
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={continueToReview}
                    className="rounded-xl bg-black px-6 py-3 font-medium text-white"
                  >
                    Revisar información
                  </button>
                </div>
              )}
          </section>
        )}
      </div>
    </main>
  );
}
