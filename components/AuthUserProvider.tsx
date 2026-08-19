"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import { createClient } from "@/supabase/client";
import { verifyLegacySemesterOwnership } from "@/app/storage-actions";
import { importLegacyStorageForAuthenticatedUser } from "@/lib/user-storage";

type AuthUserContextValue = {
  userId: string | null;
  isAuthLoading: boolean;
  authError: string | null;
};

const AuthUserContext = createContext<AuthUserContextValue | null>(null);

export default function AuthUserProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const recoveryStarted = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifiedScope, setVerifiedScope] = useState<
    "public" | "private" | null
  >(null);
  const authScope =
    pathname === "/login" || pathname === "/signup" ? "public" : "private";

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user.id ?? null);
      setAuthError(null);
      setIsAuthLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;

      if (!error) {
        setUserId(data.user?.id ?? null);
        setAuthError(null);
        setIsAuthLoading(false);
        setVerifiedScope(authScope);
        return;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (!active) return;

      if (sessionError) {
        setAuthError("No fue posible verificar tu sesión.");
      } else {
        setUserId(sessionData.session?.user.id ?? null);
        setAuthError(null);
      }

      setIsAuthLoading(false);
      setVerifiedScope(authScope);
    })();

    return () => {
      active = false;
    };
  }, [authScope, supabase]);

  useEffect(() => {
    if (isAuthLoading || !userId) return;

    const recoveryRequested =
      new URLSearchParams(window.location.search).get("recoverLegacy") === "1";

    if (recoveryRequested && !recoveryStarted.current) {
      recoveryStarted.current = true;

      void (async () => {
        const legacySemesterId =
          localStorage.getItem("universify-semester-id") ??
          sessionStorage.getItem("universify-semester-id");

        if (
          legacySemesterId &&
          (await verifyLegacySemesterOwnership(legacySemesterId))
        ) {
          await importLegacyStorageForAuthenticatedUser();
          window.location.replace(pathname);
          return;
        }

        window.location.replace(pathname);
      })();

      return;
    }

  }, [isAuthLoading, pathname, userId]);

  return (
    <AuthUserContext.Provider
      value={{
        userId,
        isAuthLoading: isAuthLoading || verifiedScope !== authScope,
        authError,
      }}
    >
      {children}
    </AuthUserContext.Provider>
  );
}

export function useAuthUser() {
  const context = useContext(AuthUserContext);

  if (!context) {
    throw new Error("useAuthUser debe usarse dentro de AuthUserProvider");
  }

  return context;
}
