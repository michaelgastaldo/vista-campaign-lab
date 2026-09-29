import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconClose, IconSpark } from "@/components/ui-custom/CustomIcon";
import { useServerFn } from "@tanstack/react-start";
import { draftRetroSummary } from "@/lib/ai-suggest.functions";
import { toast } from "sonner";

export function RetroModal({
  workspaceId,
  orgId,
  campaignType,
  open,
  onClose,
}: {
  workspaceId: string;
  orgId: string;
  campaignType: string;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [worked, setWorked] = useState("");
  const [didnt, setDidnt] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const draft = useServerFn(draftRetroSummary);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("workspace_retros").select("*").eq("workspace_id", workspaceId).maybeSingle();
      if (data) {
        setWorked(data.what_worked ?? "");
        setDidnt(data.what_didnt ?? "");
        setNext(data.next_time ?? "");
      }
    })();
  }, [open, workspaceId]);

  if (!open) return null;

  const generate = async () => {
    setDrafting(true);
    try {
      const [{ data: ws }, { data: items }, { data: kpis }] = await Promise.all([
        supabase.from("workspaces").select("name,goal,kpi_label,kpi_target,kpi_actual").eq("id", workspaceId).single(),
        supabase.from("checklist_items").select("title,done").eq("workspace_id", workspaceId),
        supabase.from("workspace_kpis").select("channel,sent,clicks,conversions,spend_cents,revenue_cents").eq("workspace_id", workspaceId),
      ]);
      const result = await draft({
        data: {
          name: ws?.name ?? "Campaign",
          goal: ws?.goal ?? null,
          kpi: { label: ws?.kpi_label ?? null, target: ws?.kpi_target ?? null, actual: ws?.kpi_actual ?? null },
          checklist: (items ?? []) as Array<{ title: string; done: boolean }>,
          kpis: (kpis ?? []) as Array<{ channel: string; sent: number; clicks: number; conversions: number; spend_cents: number; revenue_cents: number }>,
        },
      });
      setWorked(result.what_worked);
      setDidnt(result.what_didnt);
      setNext(result.next_time);
      toast.success("Draft ready — edit before saving");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI draft failed");
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("workspace_retros").upsert(
      {
        workspace_id: workspaceId,
        org_id: orgId,
        campaign_type: campaignType as "other",
        what_worked: worked || null,
        what_didnt: didnt || null,
        next_time: next || null,
        created_by: user.id,
      },
      { onConflict: "workspace_id" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Retro saved");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <GlassPanel tier="strong" className="relative w-full max-w-lg p-6">
        <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <IconClose size={16} />
        </button>
        <h2 className="font-display text-xl">Campaign retro</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          3 questions. Each retro feeds the playbook for next time.
        </p>
        <div className="mt-3">
          <button
            onClick={generate}
            disabled={drafting}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
          >
            <IconSpark size={12} /> {drafting ? "Drafting…" : "Auto-draft from KPIs"}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {[
            { label: "What worked?", v: worked, set: setWorked },
            { label: "What didn't?", v: didnt, set: setDidnt },
            { label: "Next time, what changes?", v: next, set: setNext },
          ].map((q) => (
            <div key={q.label}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{q.label}</div>
              <textarea
                value={q.v}
                onChange={(e) => q.set(e.target.value)}
                rows={2}
                className="mt-1 w-full resize-none rounded-md border border-glass-border bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save retro"}
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
