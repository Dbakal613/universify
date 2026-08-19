"use client";

import { useActionState } from "react";

import { signup, type AuthActionState } from "@/app/auth-actions";

const initialState: AuthActionState = {};

export default function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="mt-7 space-y-5">
      <label className="block" htmlFor="email">
        <span className="text-sm font-medium text-slate-700">Correo electrónico</span>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
          placeholder="tu@correo.com"
        />
      </label>

      <label className="block" htmlFor="password">
        <span className="text-sm font-medium text-slate-700">Contraseña</span>
        <input
          id="password"
          name="password"
          type="password"
          minLength={6}
          autoComplete="new-password"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
        />
        <span className="mt-2 block text-xs text-slate-500">Mínimo 6 caracteres.</span>
      </label>

      <label className="block" htmlFor="passwordConfirmation">
        <span className="text-sm font-medium text-slate-700">Confirmar contraseña</span>
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          minLength={6}
          autoComplete="new-password"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.success && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || Boolean(state.success)}
        className="w-full rounded-xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
}
