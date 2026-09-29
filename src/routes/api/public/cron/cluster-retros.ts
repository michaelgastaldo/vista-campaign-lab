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

export const Route = createFileRoute("/api/public/cron/cluster-retros")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const denied = await authorized(request, sb);
        if (denied) return denied;


        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: retros } = await sb
          .from("workspace_retros")
          .select("campaign_type,what_worked,what_didnt,next_time,org_id")
          .gte("created_at", since);

        if (!retros || retros.length === 0) {
          return Response.json({ ok: true, processed: 0, message: "no retros in window" });
        }

        // Group by (org_id, campaign_type)
        const groups = new Map<string, typeof retros>();
        for (const r of retros) {
          const key = `${r.org_id}::${r.campaign_type}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(r);
        }

        const apiKeyAI = process.env.LOVABLE_API_KEY;
        if (!apiKeyAI) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        let updated = 0;
        for (const [key, retroSet] of groups) {
          if (retroSet.length < 2) continue; // need at least 2 to cluster
          const [orgId, campaignType] = key.split("::");

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKeyAI}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You synthesize repeated retrospective lessons into 3–5 concrete checklist additions. Each item ≤ 8 words, verb-led." },
                { role: "user", content: `Campaign type: ${campaignType}\n\nRetros:\n${JSON.stringify(retroSet, null, 2)}\n\nReturn checklist suggestions to add to this campaign type's playbook.` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "return_suggestions",
                  parameters: {
                    type: "object",
                    properties: { items: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } } },
                    required: ["items"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "return_suggestions" } },
            }),
          });
          if (!aiRes.ok) continue;
          const aiJson = await aiRes.json();
          const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (!args) continue;
          const { items } = JSON.parse(args) as { items: string[] };
          if (!items?.length) continue;

          // Find the org's template for this campaign_type and append
          const { data: template } = await sb
            .from("workspace_templates")
            .select("id,default_checklist")
            .eq("org_id", orgId)
            .eq("campaign_type", campaignType)
            .maybeSingle();

          if (!template) continue;
          const existing = (template.default_checklist as string[] | null) ?? [];
          const merged = Array.from(new Set([...existing, ...items]));
          if (merged.length === existing.length) continue;
          await sb.from("workspace_templates").update({ default_checklist: merged }).eq("id", template.id);
          updated++;
        }

        return Response.json({ ok: true, processed: groups.size, templatesUpdated: updated });
      },
    },
  },
});
