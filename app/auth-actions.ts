"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/supabase/server";

export type AuthActionState = {
  error?: string;
  success?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function friendlyAuthError(message: string, code?: string) {
  if (code === "invalid_credentials") {
    return "El correo o la contraseña no son correctos.";
  }

  if (code === "email_not_confirmed") {
    return "Debes confirmar tu correo antes de iniciar sesión.";
  }

  if (code === "user_already_exists" || message.includes("already registered")) {
    return "Ya existe una cuenta asociada a este correo.";
  }

  if (code === "weak_password") {
    return "La contraseña no cumple los requisitos de seguridad.";
  }

  if (message.includes("rate limit")) {
    return "Has realizado demasiados intentos. Espera un momento y vuelve a intentar.";
  }

  return "No fue posible completar la solicitud. Revisa tus datos e inténtalo nuevamente.";
}

export async function login(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = fieldValue(formData, "email").trim().toLowerCase();
  const password = fieldValue(formData, "password");

  if (!emailPattern.test(email)) {
    return { error: "Ingresa un correo electrónico válido." };
  }

  if (!password) {
    return { error: "Ingresa tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: friendlyAuthError(error.message, error.code) };
  }

  redirect("/");
}

export async function signup(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = fieldValue(formData, "email").trim().toLowerCase();
  const password = fieldValue(formData, "password");
  const passwordConfirmation = fieldValue(formData, "passwordConfirmation");

  if (!emailPattern.test(email)) {
    return { error: "Ingresa un correo electrónico válido." };
  }

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  if (password !== passwordConfirmation) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: friendlyAuthError(error.message, error.code) };
  }

  if (!data.session) {
    return {
      success:
        "Cuenta creada. Revisa tu correo y confirma tu dirección antes de iniciar sesión.",
    };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
