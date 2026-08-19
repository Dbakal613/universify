import "server-only";

import type { SemesterSettings } from "@/lib/types";
import { createClient } from "@/supabase/server";

export type SemesterRecord = {
  id: string;
  user_id: string;
  year: number;
  term: string;
  is_active: boolean;
};

export type UpsertActiveSemesterResult =
  | { success: true; semester: SemesterRecord }
  | { success: false; error: string };

function isValidSemester(settings: SemesterSettings) {
  return (
    typeof settings === "object" &&
    settings !== null &&
    typeof settings.name === "string" &&
    settings.name.trim().length > 0 &&
    typeof settings.year === "number" &&
    Number.isInteger(settings.year) &&
    settings.year > 0 &&
    typeof settings.term === "string" &&
    settings.term.trim().length > 0 &&
    typeof settings.startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(settings.startDate) &&
    typeof settings.endDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(settings.endDate) &&
    settings.startDate <= settings.endDate &&
    typeof settings.timezone === "string" &&
    settings.timezone.trim().length > 0 &&
    typeof settings.locationName === "string" &&
    settings.locationName.trim().length > 0
  );
}

export async function upsertAuthenticatedSemester(
  settings: SemesterSettings
): Promise<UpsertActiveSemesterResult> {
  if (!isValidSemester(settings)) {
    return {
      success: false,
      error: "Revisa los datos y las fechas del semestre antes de continuar.",
    };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (claimsError || !userId) {
    return {
      success: false,
      error: "Debes iniciar sesión para guardar tu semestre.",
    };
  }

  const { data: previousActive, error: previousActiveError } = await supabase
    .from("semesters")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (previousActiveError) {
    console.error(
      "No fue posible consultar el semestre activo:",
      previousActiveError
    );
    return {
      success: false,
      error: "No fue posible guardar el semestre. Inténtalo nuevamente.",
    };
  }

  async function restorePreviousActiveSemester() {
    if (!previousActive?.id) return;

    const { error: restoreError } = await supabase
      .from("semesters")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", previousActive.id)
      .eq("user_id", userId);

    if (restoreError) {
      console.error(
        "No fue posible restaurar el semestre anterior:",
        restoreError
      );
    }
  }

  const now = new Date().toISOString();
  const { data: stagedSemester, error: upsertError } = await supabase
    .from("semesters")
    .upsert(
      {
        user_id: userId,
        name: settings.name.trim(),
        year: settings.year,
        term: settings.term.trim(),
        start_date: settings.startDate,
        end_date: settings.endDate,
        timezone: settings.timezone.trim(),
        location_name: settings.locationName.trim(),
        is_active: false,
        updated_at: now,
      },
      { onConflict: "user_id,year,term" }
    )
    .select("id, user_id, year, term, is_active")
    .single();

  if (upsertError || !stagedSemester) {
    console.error("No fue posible preparar el semestre:", upsertError);
    return {
      success: false,
      error: "No fue posible guardar el semestre. Inténtalo nuevamente.",
    };
  }

  const { error: deactivateError } = await supabase
    .from("semesters")
    .update({ is_active: false, updated_at: now })
    .eq("user_id", userId)
    .eq("is_active", true)
    .neq("id", stagedSemester.id);

  if (deactivateError) {
    await restorePreviousActiveSemester();
    console.error(
      "No fue posible desactivar el semestre anterior:",
      deactivateError
    );
    return {
      success: false,
      error: "No fue posible activar el semestre. Inténtalo nuevamente.",
    };
  }

  const { data: activeSemester, error: activateError } = await supabase
    .from("semesters")
    .update({ is_active: true, updated_at: now })
    .eq("id", stagedSemester.id)
    .eq("user_id", userId)
    .select("id, user_id, year, term, is_active")
    .single();

  if (activateError || !activeSemester) {
    await restorePreviousActiveSemester();
    console.error("No fue posible activar el semestre:", activateError);
    return {
      success: false,
      error: "No fue posible activar el semestre. Inténtalo nuevamente.",
    };
  }

  return { success: true, semester: activeSemester };
}
