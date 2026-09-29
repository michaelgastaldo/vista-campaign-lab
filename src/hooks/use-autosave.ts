// Debounced server-side autosave. Pairs with useDraft for local-first UX.
import { useEffect, useRef } from "react";
import { reportAutosave, clearAutosave } from "@/lib/autosave-store";

type Options<T> = {
  /** Stable identifier shown in the global status pill, e.g. `campaign:abc123:name` */
  scope: string;
  /** The value to persist. Save fires when it changes. */
  value: T;
  /** Persist function. Throw to mark error. */
  onSave: (value: T) => Promise<void> | void;
  /** Disable while record id is missing, while loading, etc. */
  enabled?: boolean;
  /** Debounce ms (default 800). */
  delay?: number;
  /** Optional equality check; defaults to JSON.stringify */
  equals?: (a: T, b: T) => boolean;
  /** Called after a successful save, e.g. to clearDraft(). */
  onSaved?: () => void;
};

const defaultEquals = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

export function useAutosave<T>({
  scope,
  value,
  onSave,
  enabled = true,
  delay = 800,
  equals = defaultEquals,
  onSaved,
}: Options<T>) {
  const initialRef = useRef<T | null>(null);
  const lastSavedRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const onSaveRef = useRef(onSave);
  const onSavedRef = useRef(onSaved);
  onSaveRef.current = onSave;
  onSavedRef.current = onSaved;

  // Capture baseline whenever the scope or enabled flips on with fresh data.
  useEffect(() => {
    if (!enabled) return;
    initialRef.current = value;
    lastSavedRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scope]);

  useEffect(() => {
    if (!enabled) return;
    if (lastSavedRef.current !== null && equals(value, lastSavedRef.current)) return;
    if (initialRef.current !== null && equals(value, initialRef.current) && lastSavedRef.current === initialRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    reportAutosave(scope, "local");
    timerRef.current = setTimeout(async () => {
      const snapshot = value;
      reportAutosave(scope, "saving");
      const p = (async () => {
        try {
          await onSaveRef.current(snapshot);
          lastSavedRef.current = snapshot;
          reportAutosave(scope, "saved");
          onSavedRef.current?.();
        } catch (e) {
          reportAutosave(scope, "error", e instanceof Error ? e.message : "Save failed");
        }
      })();
      inFlightRef.current = p;
      await p;
      if (inFlightRef.current === p) inFlightRef.current = null;
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, scope, delay]);

  // Flush on hide / unload so closing the tab still tries to save.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const snapshot = value;
      reportAutosave(scope, "saving");
      Promise.resolve(onSaveRef.current(snapshot))
        .then(() => {
          lastSavedRef.current = snapshot;
          reportAutosave(scope, "saved");
          onSavedRef.current?.();
        })
        .catch((e) =>
          reportAutosave(scope, "error", e instanceof Error ? e.message : "Save failed"),
        );
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scope, value]);

  // Cleanup status entry on unmount.
  useEffect(() => {
    return () => clearAutosave(scope);
  }, [scope]);
}
