import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconPlus, IconClose, IconSpark, IconCheck } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { summarizeWinner } from "@/lib/ai-suggest.functions";

type Variant = {
  id: string;
  workspace_id: string;
  org_id: string;
  channel: string;
  label: string;
  subject: string | null;
  copy: string | null;
  utm_tail: string | null;
  is_winner: boolean;
  results: Record<string, number>;
  ai_summary: string | null;
  position: number;
};

const RESULT_FIELDS = ["sent", "opens", "clicks", "conversions"] as const;

export function VariantsSection({ workspaceId, orgId }: { workspaceId: string; orgId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Variant[]>([]);
  const summarize = useServerFn(summarizeWinner);
  const [pickingFor, setPickingFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("campaign_variants")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true });
      if (!cancelled) setItems((data as Variant[]) ?? []);
    };
    load();
    const ch = supabase
      .channel(`variants-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_variants", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [workspaceId]);

  const add = async () => {
    if (!user) return;
    const label = String.fromCharCode(65 + items.length);
    const { error } = await supabase.from("campaign_variants").insert({
      workspace_id: workspaceId,
      org_id: orgId,
      label: `Variant ${label}`,
      channel: "email",
      position: items.length,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
  };

  const update = async (id: string, patch: Partial<Variant>) => {
    setItems((cur) => cur.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    const { error } = await supabase.from("campaign_variants").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const updateResult = async (id: string, field: string, value: number) => {
    const v = items.find((x) => x.id === id);
    if (!v) return;
    const results = { ...v.results, [field]: value };
    await update(id, { results });
  };

  const remove = async (id: string) => {
    setItems((cur) => cur.filter((v) => v.id !== id));
    await supabase.from("campaign_variants").delete().eq("id", id);
  };

  const pickWinner = async (winner: Variant) => {
    setPickingFor(winner.id);
    try {
      // mark winner exclusively
      await Promise.all(
        items.map((v) =>
          supabase.from("campaign_variants").update({ is_winner: v.id === winner.id }).eq("id", v.id),
        ),
      );
      const { summary } = await summarize({
        data: {
          variants: items.map((v) => ({ label: v.label, subject: v.subject, copy: v.copy, results: v.results })),
          winnerLabel: winner.label,
        },
      });
      await supabase.from("campaign_variants").update({ ai_summary: summary }).eq("id", winner.id);
      toast.success("Winner picked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not summarize");
    } finally {
      setPickingFor(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Variants &amp; A/B</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            Test 2+ versions, paste results, let AI explain why one won.
          </div>
        </div>
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          <IconPlus size={14} /> Add variant
        </button>
      </div>

      {items.length === 0 ? (
        <GlassPanel className="p-6 text-center text-sm text-muted-foreground">No variants yet.</GlassPanel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((v) => (
            <GlassPanel key={v.id} className={cn("flex flex-col gap-3 p-4", v.is_winner && "ring-1 ring-primary/60")}>
              <div className="flex items-start justify-between gap-2">
                <input
                  value={v.label}
                  onChange={(e) => setItems((c) => c.map((x) => (x.id === v.id ? { ...x, label: e.target.value } : x)))}
                  onBlur={(e) => e.target.value !== v.label && update(v.id, { label: e.target.value })}
                  className="bg-transparent font-display text-base outline-none"
                />
                <div className="flex items-center gap-2">
                  {v.is_winner && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                      <IconCheck size={10} /> Winner
                    </span>
                  )}
                  <button onClick={() => remove(v.id)} className="text-muted-foreground/50 hover:text-destructive">
                    <IconClose size={14} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={v.channel}
                  onChange={(e) => update(v.id, { channel: e.target.value })}
                  className="rounded-md border border-glass-border bg-background/40 px-2 py-1.5 text-xs outline-none focus:border-primary/50"
                >
                  {["email", "paid-social", "paid-search", "sms", "push", "display"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  value={v.utm_tail ?? ""}
                  onChange={(e) => setItems((c) => c.map((x) => (x.id === v.id ? { ...x, utm_tail: e.target.value } : x)))}
                  onBlur={(e) => update(v.id, { utm_tail: e.target.value || null })}
                  placeholder="utm_content suffix"
                  className="rounded-md border border-glass-border bg-background/40 px-2 py-1.5 font-mono text-xs outline-none focus:border-primary/50"
                />
              </div>
              <input
                value={v.subject ?? ""}
                onChange={(e) => setItems((c) => c.map((x) => (x.id === v.id ? { ...x, subject: e.target.value } : x)))}
                onBlur={(e) => update(v.id, { subject: e.target.value || null })}
                placeholder="Subject / headline"
                className="w-full rounded-md border border-glass-border bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
              />
              <textarea
                value={v.copy ?? ""}
                onChange={(e) => setItems((c) => c.map((x) => (x.id === v.id ? { ...x, copy: e.target.value } : x)))}
                onBlur={(e) => update(v.id, { copy: e.target.value || null })}
                placeholder="Body copy"
                rows={2}
                className="w-full resize-none rounded-md border border-glass-border bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {RESULT_FIELDS.map((f) => (
                  <div key={f}>
                    <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{f}</div>
                    <input
                      type="number"
                      value={v.results[f] ?? ""}
                      onChange={(e) => updateResult(v.id, f, Number(e.target.value) || 0)}
                      className="mt-0.5 w-full rounded-md border border-glass-border bg-background/40 px-1.5 py-1 text-right font-mono text-xs outline-none focus:border-primary/50"
                    />
                  </div>
                ))}
              </div>
              {v.ai_summary && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-foreground/90">
                  <IconSpark size={12} className="mr-1 inline text-primary" />
                  {v.ai_summary}
                </div>
              )}
              <button
                onClick={() => pickWinner(v)}
                disabled={pickingFor === v.id}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-glass-border bg-glass/40 py-1.5 text-xs hover:bg-glass disabled:opacity-50"
              >
                {pickingFor === v.id ? "Analyzing…" : v.is_winner ? "Re-summarize" : "Pick as winner"}
              </button>
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  );
}
