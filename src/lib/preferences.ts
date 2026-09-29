import { supabase } from "@/integrations/supabase/client";

/**
 * Smart-defaults store. Backed by Supabase `user_preferences` for cross-device
 * persistence, mirrored in localStorage for instant first paint.
 *
 * Shape: { user_id, key, values: string[] }  (max 3 entries, most-recent first)
 */
const LS_PREFIX = "cmd:pref:";

export function readPrefLocal(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(values));
  } catch {
    /* quota */
  }
}

export async function pushPref(userId: string, key: string, value: string) {
  if (!value) return;
  const existing = readPrefLocal(key);
  const next = [value, ...existing.filter((v) => v !== value)].slice(0, 3);
  writeLocal(key, next);
  await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, key, values: next, updated_at: new Date().toISOString() });
}

export async function hydratePrefs(userId: string, keys: string[]) {
  const { data } = await supabase
    .from("user_preferences")
    .select("key,values")
    .eq("user_id", userId)
    .in("key", keys);
  if (data) {
    for (const row of data) writeLocal(row.key, (row.values as string[]) ?? []);
  }
}
