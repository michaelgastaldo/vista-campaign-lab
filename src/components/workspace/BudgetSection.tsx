import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconClose } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { formatLabel, channelCategoryStyle } from "@/lib/channel-format";
import { cn } from "@/lib/utils";

type Line = {
  id: string;
  workspace_id: string;
  org_id: string;
  label: string;
  channel: string | null;
  vendor: string | null;
  planned_cents: number;
  actual_cents: number;
  position: number;
};

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);

export function BudgetSection({
  workspaceId,
  orgId,
  currency = "USD",
  channels,
}: {
  workspaceId: string;
  orgId: string;
  currency?: string;
  channels: string[];
}) {
  const { user } = useAuth();
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<{ label: string; channel: string; vendor: string; planned: string; actual: string }>(
    { label: "", channel: "", vendor: "", planned: "", actual: "" },
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("workspace_budget_lines")
        .select("id,workspace_id,org_id,label,channel,vendor,planned_cents,actual_cents,position")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true });
      if (!cancelled) setLines((data as Line[]) ?? []);
    };
    load();
    const ch = supabase
      .channel(`budget-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_budget_lines",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [workspaceId]);

  const add = async (
    seed: { label?: string; channel?: string | null; vendor?: string | null; planned_cents?: number; actual_cents?: number } = {},
  ) => {
    if (!user) return;
    const { error } = await supabase.from("workspace_budget_lines").insert({
      workspace_id: workspaceId,
      org_id: orgId,
      label: seed.label?.trim() || "New line",
      channel: seed.channel ?? null,
      vendor: seed.vendor ?? null,
      planned_cents: seed.planned_cents ?? 0,
      actual_cents: seed.actual_cents ?? 0,
      position: lines.length,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
  };

  const update = async (id: string, patch: Partial<Line>) => {
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("workspace_budget_lines").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    setLines((cur) => cur.filter((l) => l.id !== id));
    const { error } = await supabase.from("workspace_budget_lines").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const planned = lines.reduce((s, l) => s + (l.planned_cents || 0), 0);
  const actual = lines.reduce((s, l) => s + (l.actual_cents || 0), 0);
  const variance = planned - actual;
  const overBudget = actual > planned && planned > 0;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Budget</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            Plan, then track what each line actually cost.
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Planned</div>
            <div className="font-mono text-sm">{fmt(planned, currency)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Actual</div>
            <div className="font-mono text-sm">{fmt(actual, currency)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {variance >= 0 ? "Remaining" : "Over"}
            </div>
            <div
              className={`font-mono text-sm ${overBudget ? "text-destructive" : "text-primary"}`}
            >
              {fmt(Math.abs(variance), currency)}
            </div>
          </div>
        </div>
      </div>

      <GlassPanel className="overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-glass-border bg-background/30 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Line</div>
          <div className="col-span-2">Channel</div>
          <div className="col-span-2">Vendor</div>
          <div className="col-span-2 text-right">Planned</div>
          <div className="col-span-2 text-right">Actual</div>
        </div>
        {lines.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No budget lines yet.
          </div>
        ) : (
          lines.map((l) => (
            <div
              key={l.id}
              className="group grid grid-cols-12 items-center gap-2 border-b border-glass-border px-4 py-2 last:border-0"
            >
              <input
                value={l.label}
                onChange={(e) =>
                  setLines((cur) =>
                    cur.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)),
                  )
                }
                onBlur={(e) => {
                  const v = e.target.value.trim() || "Untitled";
                  if (v !== l.label) update(l.id, { label: v });
                }}
                className="col-span-4 bg-transparent text-sm outline-none"
              />
              <div className="col-span-2 flex items-center gap-1.5">
                {l.channel && (
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      channelCategoryStyle(l.channel).className.split(" ")[1].replace("text-", "bg-"),
                    )}
                    aria-hidden
                  />
                )}
                <select
                  value={l.channel ?? ""}
                  onChange={(e) => update(l.id, { channel: e.target.value || null })}
                  className={cn(
                    "min-w-0 flex-1 rounded-md border px-2 py-1 text-xs outline-none focus:border-primary/50",
                    l.channel ? channelCategoryStyle(l.channel).className : "border-glass-border bg-background/40 text-muted-foreground",
                  )}
                  title={l.channel ? `${channelCategoryStyle(l.channel).category} channel` : undefined}
                >
                  <option value="">—</option>
                  {channels.map((c) => (
                    <option key={c} value={c}>
                      {formatLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={l.vendor ?? ""}
                onChange={(e) =>
                  setLines((cur) =>
                    cur.map((x) => (x.id === l.id ? { ...x, vendor: e.target.value } : x)),
                  )
                }
                onBlur={(e) => update(l.id, { vendor: e.target.value || null })}
                placeholder="—"
                className="col-span-2 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 outline-none"
              />
              <input
                type="number"
                min={0}
                value={l.planned_cents / 100 || ""}
                onChange={(e) =>
                  setLines((cur) =>
                    cur.map((x) =>
                      x.id === l.id
                        ? { ...x, planned_cents: Math.round(Number(e.target.value || 0) * 100) }
                        : x,
                    ),
                  )
                }
                onBlur={(e) =>
                  update(l.id, { planned_cents: Math.round(Number(e.target.value || 0) * 100) })
                }
                placeholder="0"
                className="col-span-2 rounded-md border border-glass-border bg-background/40 px-2 py-1 text-right font-mono text-xs outline-none focus:border-primary/50"
              />
              <div className="col-span-2 flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={l.actual_cents / 100 || ""}
                  onChange={(e) =>
                    setLines((cur) =>
                      cur.map((x) =>
                        x.id === l.id
                          ? { ...x, actual_cents: Math.round(Number(e.target.value || 0) * 100) }
                          : x,
                      ),
                    )
                  }
                  onBlur={(e) =>
                    update(l.id, { actual_cents: Math.round(Number(e.target.value || 0) * 100) })
                  }
                  placeholder="0"
                  className="w-full rounded-md border border-glass-border bg-background/40 px-2 py-1 text-right font-mono text-xs outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => remove(l.id)}
                  className="text-muted-foreground/50 opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <IconClose size={14} />
                </button>
              </div>
            </div>
          ))
        )}
        <div className="group grid grid-cols-12 items-center gap-2 px-4 py-2 opacity-70 transition focus-within:opacity-100 hover:opacity-100">
          {(() => {
            const commit = () => {
              if (!draft.label.trim() && !draft.vendor.trim() && !draft.channel && !draft.planned && !draft.actual) return;
              void add({
                label: draft.label,
                channel: draft.channel || null,
                vendor: draft.vendor || null,
                planned_cents: draft.planned ? Math.round(Number(draft.planned) * 100) : 0,
                actual_cents: draft.actual ? Math.round(Number(draft.actual) * 100) : 0,
              });
              setDraft({ label: "", channel: "", vendor: "", planned: "", actual: "" });
            };
            const onKey = (e: React.KeyboardEvent) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            };
            return (
              <>
                <input
                  value={draft.label}
                  placeholder="+ Add line…"
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  onBlur={commit}
                  onKeyDown={onKey}
                  className="col-span-4 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <select
                  value={draft.channel}
                  onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value }))}
                  onBlur={commit}
                  className="col-span-2 rounded-md border border-glass-border bg-background/40 px-2 py-1 text-xs text-muted-foreground outline-none focus:border-primary/50"
                >
                  <option value="">—</option>
                  {channels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.vendor}
                  placeholder="—"
                  onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
                  onBlur={commit}
                  onKeyDown={onKey}
                  className="col-span-2 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 outline-none"
                />
                <input
                  type="number"
                  min={0}
                  value={draft.planned}
                  placeholder="0"
                  onChange={(e) => setDraft((d) => ({ ...d, planned: e.target.value }))}
                  onBlur={commit}
                  onKeyDown={onKey}
                  className="col-span-2 rounded-md border border-glass-border bg-background/40 px-2 py-1 text-right font-mono text-xs outline-none focus:border-primary/50"
                />
                <input
                  type="number"
                  min={0}
                  value={draft.actual}
                  placeholder="0"
                  onChange={(e) => setDraft((d) => ({ ...d, actual: e.target.value }))}
                  onBlur={commit}
                  onKeyDown={onKey}
                  className="col-span-2 rounded-md border border-glass-border bg-background/40 px-2 py-1 text-right font-mono text-xs outline-none focus:border-primary/50"
                />
              </>
            );
          })()}
        </div>
      </GlassPanel>
    </div>
  );
}
