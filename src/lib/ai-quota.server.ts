/**
 * Per-user daily quota for AI gateway calls.
 *
 * Every AI-backed server function records its call through the
 * `record_ai_call` SECURITY DEFINER function, which throws once the caller
 * has exceeded the limit inside a rolling 24h window.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Calls per user per rolling 24 hours. */
export const AI_DAILY_LIMIT = 100;

export async function assertAiQuota(
  sb: SupabaseClient,
  fn: string,
  limit: number = AI_DAILY_LIMIT,
): Promise<void> {
  const { error } = await sb.rpc("record_ai_call", { _fn: fn, _limit: limit });
  if (error) {
    throw new Error(
      error.message.includes("daily limit")
        ? error.message
        : `Could not verify AI usage quota: ${error.message}`,
    );
  }
}
