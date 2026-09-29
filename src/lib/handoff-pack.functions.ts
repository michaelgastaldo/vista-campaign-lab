import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import JSZip from "jszip";

function csv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export const buildHandoffPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: ws } = await sb.from("workspaces").select("*").eq("id", data.workspaceId).single();
    if (!ws) throw new Error("Workspace not found");

    const [checklist, variants, utm, audience, assets, kpis, budget] = await Promise.all([
      sb.from("checklist_items").select("title,done,due_at,owner_id,position").eq("workspace_id", data.workspaceId).order("position"),
      sb.from("campaign_variants").select("channel,label,subject,copy,utm_tail,is_winner,results").eq("workspace_id", data.workspaceId),
      sb.from("utm_links").select("label,base_url,utm_source,utm_medium,utm_campaign,utm_term,utm_content,final_url").eq("workspace_id", data.workspaceId),
      sb.from("audiences").select("name,prompt,parsed_criteria,estimated_count").eq("workspace_id", data.workspaceId),
      sb.from("workspace_assets").select("label,kind,url,storage_path,version,mime_type").eq("workspace_id", data.workspaceId),
      sb.from("workspace_kpis").select("channel,sent,opens,clicks,conversions,spend_cents,revenue_cents,notes").eq("workspace_id", data.workspaceId),
      sb.from("workspace_budget_lines").select("label,channel,vendor,planned_cents,actual_cents").eq("workspace_id", data.workspaceId),
    ]);

    const zip = new JSZip();

    const brief = `# ${ws.name}

**Status:** ${ws.status}
**Type:** ${ws.campaign_type}
**Dates:** ${ws.start_date ?? "—"} → ${ws.end_date ?? "—"}
**Channel:** ${ws.channel ?? "—"}
**KPI:** ${ws.kpi_label ?? "—"} — actual ${ws.kpi_actual ?? "—"} / target ${ws.kpi_target ?? "—"}

## Goal
${ws.goal ?? "(no goal set)"}
`;
    zip.file("brief.md", brief);
    zip.file("checklist.csv", csv((checklist.data ?? []) as Array<Record<string, unknown>>));
    zip.file("variants.csv", csv((variants.data ?? []) as Array<Record<string, unknown>>));
    zip.file("utm_links.csv", csv((utm.data ?? []) as Array<Record<string, unknown>>));
    zip.file("audience.json", JSON.stringify(audience.data ?? [], null, 2));
    zip.file("assets.csv", csv((assets.data ?? []) as Array<Record<string, unknown>>));
    zip.file("kpis.csv", csv((kpis.data ?? []) as Array<Record<string, unknown>>));
    zip.file("budget.csv", csv((budget.data ?? []) as Array<Record<string, unknown>>));
    zip.file(
      "post-launch.md",
      `# Post-launch checklist

- [ ] Capture results (sent/open/click/convert) per channel
- [ ] Tag winning variant in /variants
- [ ] Run 3-question retro
- [ ] File assets in shared drive
- [ ] Notify stakeholders of outcome
`,
    );

    const buf = await zip.generateAsync({ type: "uint8array" });
    const b64 = Buffer.from(buf).toString("base64");
    return { filename: `${ws.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}-handoff.zip`, base64: b64 };
  });
