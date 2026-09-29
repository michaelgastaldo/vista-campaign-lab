import { createServerFn } from "@tanstack/react-start";
import { ensureDemoSession } from "@/lib/demo-seed.server";

/**
 * Public (no auth middleware): starts the shared demo experience.
 *
 * Returns the demo account email plus a one-time magic-link token that the
 * caller exchanges via supabase.auth.verifyOtp() to get a real session. The
 * token only ever grants the demo account — it carries no other privileges.
 */
export const startDemo = createServerFn({ method: "POST" }).handler(async () => {
  return ensureDemoSession();
});
