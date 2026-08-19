"use server";

import { createClient } from "@/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function verifyLegacySemesterOwnership(semesterId: string) {
  if (!uuidPattern.test(semesterId)) return false;

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (claimsError || !userId) return false;

  const { data, error } = await supabase
    .from("semesters")
    .select("id")
    .eq("id", semesterId)
    .eq("user_id", userId)
    .maybeSingle();

  return !error && Boolean(data);
}
