"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type SaveResult =
  | { success: true; profile: { fullName: string | null } }
  | { success: false; error: string };

export default function ProfileNamePrompt({
  shouldPrompt,
  onSave,
}: {
  shouldPrompt: boolean;
  onSave: (fullName: string) => Promise<SaveResult>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !shouldPrompt || dismissed || dialog.open) return;

    dialog.showModal();
    inputRef.current?.focus();
  }, [dismissed, shouldPrompt]);

  function dismiss() {
    setDismissed(true);
    dialogRef.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const result = await onSave(name);

    if (result.success) {
      dialogRef.current?.close();
    } else {
      setError(result.error);
    }

    setIsSaving(false);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="profile-name-title"
      aria-describedby="profile-name-description"
      onCancel={dismiss}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
      className="fixed inset-0 z-[90] m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate-950 shadow-xl backdrop:bg-slate-950/35"
    >
      <form onSubmit={submit} className="p-6">
        <h2 id="profile-name-title" className="text-xl font-semibold">
          Antes de seguir, ¿cómo te llamamos?
        </h2>
        <p id="profile-name-description" className="mt-2 text-sm text-slate-600">
          Usaremos tu nombre para hacer Universify un poco más personal.
        </p>

        <label className="mt-5 block">
          <span className="text-sm font-medium text-slate-700">Tu nombre</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
            maxLength={100}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-slate-400"
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={dismiss}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ahora no
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
