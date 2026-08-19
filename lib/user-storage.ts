import { createClient } from "@/supabase/client";

export const USER_STORAGE_PREFIX = "universify";

export const USER_STORAGE_KEYS = {
  courses: "courses",
  progress: "progress-v3",
  semester: "semester",
  semesterId: "semester-id",
  courseIdMap: "course-id-map",
  onboardingCompleted: "onboarding-completed",
  extractedCourses: "extracted-courses",
} as const;

export type UserStorageKey =
  (typeof USER_STORAGE_KEYS)[keyof typeof USER_STORAGE_KEYS];

export function getUserStorageKey(userId: string, key: UserStorageKey) {
  return `${USER_STORAGE_PREFIX}:${userId}:${key}`;
}

const LEGACY_CLAIM_KEY = "universify:legacy-storage-claimed-by";

function isKnownEmptyValue(key: UserStorageKey, value: string | null) {
  if (value === null || value.trim() === "") return true;

  if (key === USER_STORAGE_KEYS.onboardingCompleted) {
    return value !== "true";
  }

  if (key === USER_STORAGE_KEYS.semesterId) return false;

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      key === USER_STORAGE_KEYS.courses ||
      key === USER_STORAGE_KEYS.extractedCourses
    ) {
      return Array.isArray(parsed) && parsed.length === 0;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return false;
    }

    if (key === USER_STORAGE_KEYS.progress) {
      return Object.values(parsed).every(
        (category) =>
          category &&
          typeof category === "object" &&
          !Array.isArray(category) &&
          Object.keys(category).length === 0
      );
    }

    if (key === USER_STORAGE_KEYS.courseIdMap) {
      return Object.keys(parsed).length === 0;
    }

    return false;
  } catch {
    // Unknown or malformed scoped data is preserved rather than overwritten.
    return false;
  }
}

/**
 * Copies legacy browser data only after an explicit, authenticated-user action.
 * The browser-wide claim prevents another account from importing the same data.
 * This is intentionally not called automatically because legacy keys have no owner.
 */
export async function importLegacyStorageForAuthenticatedUser() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;

  if (!userId) {
    return { imported: false, reason: "not-authenticated" } as const;
  }

  const claimedBy = localStorage.getItem(LEGACY_CLAIM_KEY);

  if (claimedBy && claimedBy !== userId) {
    return { imported: false, reason: "claimed-by-another-user" } as const;
  }

  let copied = 0;

  for (const key of Object.values(USER_STORAGE_KEYS)) {
    const scopedKey = getUserStorageKey(userId, key);

    for (const [storageName, storage] of [
      ["local", localStorage],
      ["session", sessionStorage],
    ] as const) {
      const migrationMarker = `${USER_STORAGE_PREFIX}:${userId}:legacy-migrated:${storageName}:${key}`;

      if (localStorage.getItem(migrationMarker) === "true") continue;
      if (isKnownEmptyValue(key, storage.getItem(scopedKey))) {
        const legacyValue = storage.getItem(`${USER_STORAGE_PREFIX}-${key}`);
        if (legacyValue !== null) {
          storage.setItem(scopedKey, legacyValue);
          copied += 1;
        }
      }

      localStorage.setItem(migrationMarker, "true");
    }
  }

  localStorage.setItem(LEGACY_CLAIM_KEY, userId);
  return { imported: true, copied } as const;
}
