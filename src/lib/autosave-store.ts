// Tiny global store for autosave status. No deps — just a Set of subscribers.
import { useEffect, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error" | "local";

type Entry = { status: AutosaveStatus; at: number; message?: string };
const entries = new Map<string, Entry>();
const subs = new Set<() => void>();
const notify = () => subs.forEach((cb) => cb());

export function reportAutosave(scope: string, status: AutosaveStatus, message?: string) {
  entries.set(scope, { status, at: Date.now(), message });
  notify();
  // auto-clear "saved" after 4s so the pill returns to idle
  if (status === "saved") {
    const at = Date.now();
    setTimeout(() => {
      const cur = entries.get(scope);
      if (cur && cur.at === at) {
        entries.delete(scope);
        notify();
      }
    }, 4000);
  }
}

export function clearAutosave(scope: string) {
  entries.delete(scope);
  notify();
}

export function useAutosaveSummary() {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((n) => n + 1);
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  }, []);
  let status: AutosaveStatus = "idle";
  let message: string | undefined;
  for (const e of entries.values()) {
    if (e.status === "saving") {
      status = "saving";
      break;
    }
    if (e.status === "error") {
      status = "error";
      message = e.message;
      break;
    }
    if (e.status === "local") status = "local";
    else if (e.status === "saved" && status === "idle") status = "saved";
  }
  return { status, message, count: entries.size };
}
