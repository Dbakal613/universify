"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getMyProfile,
  upsertMyProfile,
  type MyProfile,
} from "@/app/profile-actions";
import { getUserStorageKey, USER_STORAGE_KEYS } from "@/lib/user-storage";
import { useAuthUser } from "./AuthUserProvider";
import ProfileNamePrompt from "./ProfileNamePrompt";

type ProfileContextValue = {
  fullName: string | null;
  firstName: string | null;
  isProfileLoading: boolean;
  saveFullName: (fullName: string) => ReturnType<typeof upsertMyProfile>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function firstNameFrom(fullName: string | null) {
  return fullName?.trim().split(/\s+/)[0] || null;
}

export default function ProfileProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthLoading } = useAuthUser();
  const [profile, setProfile] = useState<MyProfile>({ fullName: null });
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    let active = true;

    if (!userId) {
      const timeoutId = window.setTimeout(() => {
        if (!active) return;
        setProfile({ fullName: null });
        setLoadedUserId(null);
      }, 0);

      return () => {
        active = false;
        window.clearTimeout(timeoutId);
      };
    }

    void getMyProfile().then((result) => {
      if (!active) return;
      setProfile(result.success ? result.profile : { fullName: null });
      setLoadedUserId(userId);
    });

    return () => {
      active = false;
    };
  }, [isAuthLoading, userId]);

  async function saveFullName(fullName: string) {
    const result = await upsertMyProfile(fullName);

    if (result.success) {
      setProfile(result.profile);
      setLoadedUserId(userId);
    }

    return result;
  }

  const currentProfile = loadedUserId === userId ? profile : { fullName: null };
  const onboardingCompleted = Boolean(
    userId &&
      typeof window !== "undefined" &&
      localStorage.getItem(
        getUserStorageKey(userId, USER_STORAGE_KEYS.onboardingCompleted)
      ) === "true"
  );

  return (
    <ProfileContext.Provider
      value={{
        fullName: currentProfile.fullName,
        firstName: firstNameFrom(currentProfile.fullName),
        isProfileLoading:
          isAuthLoading || (userId !== null && loadedUserId !== userId),
        saveFullName,
      }}
    >
      {children}
      <ProfileNamePrompt
        shouldPrompt={
          onboardingCompleted &&
          loadedUserId === userId &&
          !currentProfile.fullName
        }
        onSave={saveFullName}
      />
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile debe usarse dentro de ProfileProvider");
  }

  return context;
}
