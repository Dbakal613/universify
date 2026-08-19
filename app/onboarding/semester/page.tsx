"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { SemesterSettings } from "@/lib/types";
import { upsertActiveSemester } from "./actions";
import { useAuthUser } from "@/components/AuthUserProvider";
import { getUserStorageKey, USER_STORAGE_KEYS } from "@/lib/user-storage";
import { useProfile } from "@/components/ProfileProvider";

export default function SemesterPage() {
  const router = useRouter();
  const { userId } = useAuthUser();
  const { fullName, saveFullName } = useProfile();

  const [profileName, setProfileName] = useState("");
  const [semesterName, setSemesterName] = useState("Segundo semestre");
  const [year, setYear] = useState(2026);
  const [term, setTerm] = useState("2");
  const [startDate, setStartDate] = useState("2026-08-03");
  const [endDate, setEndDate] = useState("2026-12-04");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!fullName) return;
    const timeoutId = window.setTimeout(() => setProfileName(fullName), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fullName]);

  function continueSetup() {
    setError("");

    const settings: SemesterSettings = {
      name: semesterName,
      year,
      term,
      startDate,
      endDate,
      timezone: "America/Santiago",
      locationName: "Santiago, Chile",
    };

    startTransition(async () => {
      try {
        if (!userId) {
          setError("Debes iniciar sesión para configurar tu semestre.");
          return;
        }

        const profileResult = await saveFullName(profileName);

        if (!profileResult.success) {
          setError(profileResult.error);
          return;
        }

        const result = await upsertActiveSemester(settings);

        if (!result.success) {
          setError(result.error);
          return;
        }

        const semester = JSON.stringify(settings);

        const semesterKey = getUserStorageKey(userId, USER_STORAGE_KEYS.semester);
        const semesterIdKey = getUserStorageKey(
          userId,
          USER_STORAGE_KEYS.semesterId
        );

        sessionStorage.setItem(semesterKey, semester);
        localStorage.setItem(semesterKey, semester);
        sessionStorage.setItem(semesterIdKey, result.semester.id);
        localStorage.setItem(semesterIdKey, result.semester.id);

        router.push("/onboarding/upload");
      } catch (caughtError) {
        console.error("No fue posible guardar el semestre:", caughtError);
        setError("No fue posible guardar el semestre. Inténtalo nuevamente.");
      }
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 pb-24 text-slate-900 md:ml-64 md:pb-10">
      <div className="mx-auto max-w-3xl">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Universify
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Configura tu semestre
          </h1>

          <p className="mt-3 text-slate-600">
            Revisa las fechas generales antes de guardar tus cursos.
          </p>
        </header>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="¿Cómo te llamamos?"
              value={profileName}
              onChange={setProfileName}
              placeholder="Tu nombre"
              autoComplete="name"
              className="md:col-span-2"
            />

            <Field
              label="Nombre del semestre"
              value={semesterName}
              onChange={setSemesterName}
            />

            <NumberField
              label="Año"
              value={year}
              onChange={setYear}
            />

            <label>
              <span className="text-sm font-medium text-slate-600">
                Período
              </span>

              <select
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="mt-2 w-full rounded-xl border bg-white px-3 py-2"
              >
                <option value="1">Primer semestre</option>
                <option value="2">Segundo semestre</option>
                <option value="verano">Verano</option>
                <option value="otro">Otro</option>
              </select>
            </label>

            <div />

            <label>
              <span className="text-sm font-medium text-slate-600">
                Inicio del semestre
              </span>

              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full rounded-xl border bg-white px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-600">
                Fin del semestre
              </span>

              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 w-full rounded-xl border bg-white px-3 py-2"
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <div className="mt-8 flex justify-between gap-3">
            <button
              onClick={() => router.push("/onboarding/review")}
              disabled={isPending}
              className="rounded-xl border px-5 py-3"
            >
              Volver
            </button>

            <button
              onClick={continueSetup}
              disabled={isPending}
              className="rounded-xl bg-black px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Continuar"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-sm font-medium text-slate-600">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={label === "¿Cómo te llamamos?" ? 100 : undefined}
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
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-600">
        {label}
      </span>

      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border bg-white px-3 py-2"
      />
    </label>
  );
}
