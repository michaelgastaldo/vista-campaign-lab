/**
 * Local persistence for user-driven Marketing Command Center hex overrides.
 *
 * Today we persist hidden hex ids and per-primary satellite ordering.
 * Per-hex rename overrides will live here next. Storage is localStorage-scoped
 * so it survives reloads without needing a round trip to the backend.
 *
 * Ids:
 *   • primary hex   →  the bare primary id ("utm", "campaign", ...)
 *   • satellite hex →  "sat:<primaryId>:<satelliteId>"  (e.g. "sat:utm:audit")
 *
 * Subscribers re-render via a tiny pub/sub so the toolbar's "Restore (n)"
 * counter and the grid stay in sync without prop-drilling.
 */
import { useEffect, useSyncExternalStore } from "react";

const HIDDEN_KEY = "mcc.hex.hidden.v1";
const ORDER_KEY = "mcc.hex.satelliteOrder.v1";

export type SatelliteOrderMap = Record<string, string[]>;

export function satKey(primaryId: string, satelliteId: string) {
  return `sat:${primaryId}:${satelliteId}`;
}

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

function write(next: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(next)));
  } catch {
    // quota / private mode — ignore, still emit so in-memory consumers update
  }
  emit();
}

export function hideHex(id: string) {
  const s = read();
  s.add(id);
  write(s);
}

export function showHex(id: string) {
  const s = read();
  s.delete(id);
  write(s);
}

export function restoreAllHexes() {
  write(new Set());
}

function readOrders(): SatelliteOrderMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: SatelliteOrderMap = {};
    for (const [primaryId, ids] of Object.entries(parsed)) {
      if (!Array.isArray(ids)) continue;
      const clean = ids.filter((id): id is string => typeof id === "string");
      if (clean.length) next[primaryId] = clean;
    }
    return next;
  } catch {
    return {};
  }
}

function writeOrders(next: SatelliteOrderMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — ignore, still emit so in-memory consumers update
  }
  emit();
}

export function reorderSatellite(
  primaryId: string,
  draggedId: string,
  targetId: string,
  defaultIds: string[],
) {
  if (draggedId === targetId) return;
  const orders = readOrders();
  const current = orders[primaryId]?.filter((id) => defaultIds.includes(id)) ?? defaultIds;
  const ordered = [
    ...current,
    ...defaultIds.filter((id) => !current.includes(id)),
  ].filter((id, index, arr) => arr.indexOf(id) === index);
  const from = ordered.indexOf(draggedId);
  const to = ordered.indexOf(targetId);
  if (from < 0 || to < 0) return;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  writeOrders({ ...orders, [primaryId]: ordered });
}

export function useSatelliteOrders(): SatelliteOrderMap {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => orderSnapshotRef.current ?? (orderSnapshotRef.current = readOrders()),
    () => ({}),
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ORDER_KEY) {
        orderSnapshotRef.current = readOrders();
        emit();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return snapshot;
}

/** React hook — re-renders when the hidden set changes. */
export function useHiddenHexes(): Set<string> {
  // Cache the snapshot so useSyncExternalStore sees a stable reference until
  // the set actually changes (it diffs by identity).
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshotRef.current ?? (snapshotRef.current = read()),
    () => new Set<string>(),
  );

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HIDDEN_KEY) {
        snapshotRef.current = read();
        emit();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return snapshot;
}

// Snapshot cache so getSnapshot returns a stable reference between writes.
const snapshotRef: { current: Set<string> | null } = { current: null };
const orderSnapshotRef: { current: SatelliteOrderMap | null } = { current: null };
// Invalidate the cache whenever we write.
listeners.add(() => {
  snapshotRef.current = read();
  orderSnapshotRef.current = readOrders();
});
