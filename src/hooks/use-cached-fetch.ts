import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Tiny SWR-style cache for component-level Supabase fetches.
 *
 * - Returns cached data immediately on remount (so navigating away and back
 *   shows the previous result with no skeleton).
 * - Re-runs the fetcher in the background to revalidate.
 * - Keyed by a stable string; pass null to skip the fetch.
 *
 * This intentionally avoids React Query so it slots into the existing
 * useEffect+supabase pages without restructuring them.
 */
type Entry<T> = { data: T; at: number };
const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function getCachedFetch<T>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined;
}

export function setCachedFetch<T>(key: string, data: T) {
  store.set(key, { data, at: Date.now() });
}

export function invalidateCachedFetch(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function useCachedFetch<T>(
  key: string | null,
  fetcher: () => Promise<T>,
): { data: T | undefined; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | undefined>(() =>
    key ? (store.get(key)?.data as T | undefined) : undefined,
  );
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!key) {
      setData(undefined);
      setError(null);
      return;
    }
    let cancelled = false;
    const cached = store.get(key)?.data as T | undefined;
    if (cached !== undefined) setData(cached);

    const run = async () => {
      try {
        const existing = inflight.get(key) as Promise<T> | undefined;
        const p = existing ?? fetcherRef.current();
        if (!existing) inflight.set(key, p);
        const result = await p;
        if (!cancelled) {
          store.set(key, { data: result, at: Date.now() });
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inflight.delete(key);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  // Fragile: callers put `refetch` in effect dependencies for realtime
  // subscriptions. Memoize the returned object/callback so those effects do
  // not resubscribe or re-fetch on every render.
  return useMemo(
    () => ({
      data,
      loading: data === undefined && !error,
      error,
      refetch,
    }),
    [data, error, refetch],
  );
}
