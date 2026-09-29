import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const promoteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const ownerId = context.userId;
    const { data: req } = await sb.from("campaign_requests").select("*").eq("id", data.requestId).single();
    if (!req) throw new Error("Request not found");
    if (req.workspace_id) return { workspaceId: req.workspace_id };

    type TemplateRow = { name: string; default_checklist: unknown; suggested_channels: unknown; suggested_kpi_label: string | null; campaign_type: string };
    let template: TemplateRow | null = null;
    if (req.template_id) {
      const { data: t } = await sb.from("workspace_templates").select("name,default_checklist,suggested_channels,suggested_kpi_label,campaign_type").eq("id", req.template_id).single();
      template = t as TemplateRow | null;
    }

    const channels = (template?.suggested_channels as string[]) ?? [];
    // Derive a clean, one-line workspace name from the first non-empty line of
    // the brief (multi-line intake forms concat fields with newlines).
    const briefFirstLine =
      req.brief.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? req.brief;
    const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
    const wsName = template?.name
      ? truncate(`${template.name}: ${briefFirstLine}`, 60)
      : truncate(briefFirstLine, 60);
    const { data: ws, error } = await sb
      .from("workspaces")
      .insert({
        org_id: req.org_id,
        owner_id: ownerId,
        name: wsName,
        status: "draft",
        goal: req.brief,
        channel: channels[0] ?? null,
        end_date: req.desired_due_date,
        kpi_label: template?.suggested_kpi_label ?? null,
        campaign_type: (template?.campaign_type as "other") ?? "other",
      })
      .select("id,org_id")
      .single();
    if (error || !ws) throw new Error(error?.message ?? "Could not create workspace");

    const checklist = (template?.default_checklist as string[]) ?? [];
    if (checklist.length > 0) {
      await sb.from("checklist_items").insert(
        checklist.map((title, i) => ({
          workspace_id: ws.id,
          org_id: ws.org_id,
          title,
          position: i,
          created_by: ownerId,
        })),
      );
    }

    await sb.from("campaign_requests").update({ status: "converted", workspace_id: ws.id }).eq("id", req.id);
    await sb.from("workspace_activity").insert({
      workspace_id: ws.id,
      org_id: ws.org_id,
      actor_id: ownerId,
      kind: "workspace.promoted_from_request",
      payload: { request_id: req.id, requestor_email: req.requestor_email },
    });
    return { workspaceId: ws.id };
  });
