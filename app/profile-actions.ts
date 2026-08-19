"use server";

import { createClient } from "@/supabase/server";

export type MyProfile = {
  fullName: string | null;
};

type ProfileResult =
  | { success: true; profile: MyProfile }
  | { success: false; error: string };

function normalizeFullName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

async function getAuthenticatedUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) return null;
  return { supabase, userId };
}

export async function getMyProfile(): Promise<ProfileResult> {
  const authenticated = await getAuthenticatedUserId();

  if (!authenticated) {
    return { success: false, error: "Debes iniciar sesión para ver tu perfil." };
  }

  const { data, error } = await authenticated.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", authenticated.userId)
    .maybeSingle();

  if (error) {
    console.error("No fue posible cargar el perfil:", error);
    return { success: false, error: "No fue posible cargar tu perfil." };
  }

  return {
    success: true,
    profile: { fullName: data?.full_name?.trim() || null },
  };
}

export async function upsertMyProfile(fullName: string): Promise<ProfileResult> {
  const normalizedName = normalizeFullName(fullName);

  if (!normalizedName || normalizedName.length > 100) {
    return {
      success: false,
      error: "Ingresa un nombre válido de hasta 100 caracteres.",
    };
  }

  const authenticated = await getAuthenticatedUserId();

  if (!authenticated) {
    return {
      success: false,
      error: "Debes iniciar sesión para guardar tu nombre.",
    };
  }

  const { data, error } = await authenticated.supabase
    .from("profiles")
    .upsert(
      {
        id: authenticated.userId,
        full_name: normalizedName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("full_name")
    .single();

  if (error || !data) {
    console.error("No fue posible guardar el perfil:", error);
    return {
      success: false,
      error: "No fue posible guardar tu nombre. Inténtalo nuevamente.",
    };
  }

  return {
    success: true,
    profile: { fullName: data.full_name },
  };
}
