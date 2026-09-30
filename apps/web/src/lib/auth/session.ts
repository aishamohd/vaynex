/**
 * JWT session handling. The token lives in localStorage so a judge can refresh
 * the page mid-demo. It is never logged and never sent anywhere except the API.
 */
import type { User } from "@/types";

const KEY = "vaynex.session.v1";

export interface StoredSession {
  token: string;
  expiresAt: number; // epoch ms
  user: User;
}

let memory: StoredSession | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function load(): StoredSession | null {
  if (loaded) return memory;
  loaded = true;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    memory = parsed;
  } catch {
    memory = null;
  }
  return memory;
}

export function getSession(): StoredSession | null {
  const s = load();
  if (s && s.expiresAt <= Date.now()) {
    clearSession();
    return null;
  }
  return s;
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function setSession(session: StoredSession): void {
  memory = session;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable: keep in memory */
  }
  listeners.forEach((l) => l());
}

export function updateUser(user: User): void {
  const s = getSession();
  if (s) setSession({ ...s, user });
}

export function clearSession(): void {
  memory = null;
  loaded = true;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called by the API client on any 401 outside the login form. */
export function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  clearSession();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login?expired=1");
  }
}
