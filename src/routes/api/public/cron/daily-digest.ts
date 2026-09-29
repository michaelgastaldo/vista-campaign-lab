// Auth: pg_cron sends `Authorization: Bearer <CRON_SECRET>`, where CRON_SECRET
// is the value stored in Vault (see the migration adding `private.get_cron_secret`).
// Remixers only need to override the `CRON_TARGET_URL` Vault secret to point
// pg_cron at their own deployment — the shared bearer secret is generated on
// migration apply and read from Vault at request time, never from env.
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

async function loadCronSecret(sb: SupabaseClient): Promise<string | null> {
  const { data, error } = await sb.rpc("get_cron_secret");
  if (error || typeof data !== "string" || data.length === 0) return null;
  return data;
}

async function authorized(request: Request, sb: SupabaseClient): Promise<Response | null> {
  const expected = await loadCronSecret(sb);
  if (!expected) {
    return new Response("CRON_SECRET could not be loaded from Vault", { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/cron/daily-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sb = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const denied = await authorized(request, sb);
        if (denied) return denied;




        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const today = new Date().toISOString().slice(0, 10);

        const { data: orgs } = await sb.from("organizations").select("id,name");
        if (!orgs?.length) return Response.json({ ok: true, processed: 0 });

        let written = 0;
        for (const org of orgs) {
          const [activity, workspaces, blocked, retros] = await Promise.all([
            sb.from("workspace_activity").select("kind,workspace_id,created_at").eq("org_id", org.id).gte("created_at", since),
            sb.from("workspaces").select("id,name,status,kpi_actual,kpi_target").eq("org_id", org.id),
            sb.from("checklist_items").select("id,title,workspace_id").eq("org_id", org.id).eq("done", false).not("blocked_reason", "is", null),
            sb.from("workspace_retros").select("id").eq("org_id", org.id).gte("created_at", since),
          ]);

          const events = activity.data ?? [];
          if (events.length === 0 && (retros.data ?? []).length === 0) continue;

          const byKind: Record<string, number> = {};
          for (const e of events) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

          const summary = {
            event_count: events.length,
            by_kind: byKind,
            active_workspaces: (workspaces.data ?? []).filter((w) => w.status === "planning" || w.status === "live").length,
            total_workspaces: (workspaces.data ?? []).length,
            blocked_items: (blocked.data ?? []).length,
            retros_added: (retros.data ?? []).length,
            generated_at: new Date().toISOString(),
          };

          await sb
            .from("org_digests")
            .upsert({ org_id: org.id, for_date: today, summary }, { onConflict: "org_id,for_date" });
          written++;
        }

        return Response.json({ ok: true, processed: orgs.length, written });
      },
    },
  },
});
