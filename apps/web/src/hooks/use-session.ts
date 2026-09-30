"use client";

import { useSyncExternalStore } from "react";
import { getSession, subscribeSession, type StoredSession } from "@/lib/auth/session";

export function useSession(): StoredSession | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}

/** True after the first client render (avoids hydration mismatch for session-dependent UI). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useRole() {
  const session = useSession();
  const role = session?.user.role;
  return {
    role,
    canOperate: role === "OPERATOR" || role === "ADMIN",
    isAdmin: role === "ADMIN",
  };
}
