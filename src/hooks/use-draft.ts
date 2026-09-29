// Local-first draft state. Survives refresh and tab switch.
// Key is namespaced per user to prevent leaking across accounts on shared browsers.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { reportAutosave } from "@/lib/autosave-store";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d
const PREFIX = "draft:v1";

type StoredDraft<T> = { v: T; t: number };

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || typeof parsed !== "object" || !("v" in parsed)) return fallback;
    if (Date.now() - (parsed.t ?? 0) > TTL_MS) {
      window.localStorage.removeItem(key);
      return fallback;
    }
    return parsed.v;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() } as StoredDraft<T>));
    return true;
  } catch {
    return false;
  }
}

/**
 * useDraft — drop-in replacement for useState that mirrors to localStorage.
 *
 *   const [name, setName, { clearDraft, hasDraft }] = useDraft("campaigns/$id:name", initialName);
 *
 * Scope automatically gets prefixed with the current user id, so the same browser
 * shared between accounts cannot leak drafts.
 */
export function useDraft<T>(
  scope: string,
  initial: T | (() => T),
): [T, (next: T | ((prev: T) => T)) => void, { clearDraft: () => void; hasDraft: boolean }] {
  const { user } = useAuth();
  const userKey = user?.id ?? "anon";
  const fullKey = `${PREFIX}:${userKey}:${scope}`;
  const keyRef = useRef(fullKey);
  keyRef.current = fullKey;

  const [value, setValueRaw] = useState<T>(() => {
    const stored = safeRead<T | undefined>(fullKey, undefined as T | undefined);
    if (stored !== undefined) return stored as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(fullKey) !== null;
  });

  // When the key changes (user signs in/out, or scope flips from 'new' to id) re-read.
  useEffect(() => {
    const stored = safeRead<T | undefined>(fullKey, undefined as T | undefined);
    if (stored !== undefined) {
      setValueRaw(stored as T);
      setHasDraft(true);
    } else {
      setHasDraft(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueRaw((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        const ok = safeWrite(keyRef.current, resolved);
        // Defer side-effects so we don't update other components during render.
        queueMicrotask(() => {
          setHasDraft(true);
          if (!ok) reportAutosave(keyRef.current, "error", "Local storage full");
          else reportAutosave(keyRef.current, "saved");
        });
        return resolved;
      });
    },
    [],
  );

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(keyRef.current);
    } catch {
      /* ignore */
    }
    setHasDraft(false);
  }, []);

  return [value, setValue, { clearDraft, hasDraft }];
}

// One-time cleanup of expired drafts on app load.
export function purgeExpiredDrafts() {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(PREFIX + ":")) continue;
      try {
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as StoredDraft<unknown>;
        if (now - (parsed.t ?? 0) > TTL_MS) toRemove.push(k);
      } catch {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
