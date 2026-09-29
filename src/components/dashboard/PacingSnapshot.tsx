import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PanelError } from "@/components/ui-custom/PanelError";
import { QuarterPacing } from "@/components/workspace/QuarterPacing";

function monthBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start, end };
}

type Stat = { mqlActual: number; sqoActual: number; mqlTarget: number; sqoTarget: number };

export function PacingSnapshot({ orgId }: { orgId: string }) {
  const [stat, setStat] = useState<Stat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { start, end } = useMemo(() => monthBounds(new Date()), []);
  const ym = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setError(null);
    (async () => {
      const [eventsRes, targetsRes] = await Promise.all([
        supabase
          .from("funnel_events")
          .select("stage,value_count,occurred_on")
          .eq("org_id", orgId)
          .gte("occurred_on", start.toISOString().slice(0, 10))
          .lte("occurred_on", end.toISOString().slice(0, 10)),
        supabase
          .from("funnel_targets")
          .select("mql_target,sqo_target,workspace_id")
          .eq("org_id", orgId)
          .eq("year_month", ym),
      ]);
      if (cancelled) return;
      if (eventsRes.error || targetsRes.error) {
        const err = eventsRes.error ?? targetsRes.error;
        console.error("[PacingSnapshot] failed to load:", err);
        setError(err?.message ?? "Failed to load");
        return;
      }
      let mql = 0;
      let sqo = 0;
      ((eventsRes.data ?? []) as any[]).forEach((r) => {
        const v = r.value_count ?? 1;
        if (r.stage === "mql") mql += v;
        if (r.stage === "sqo") sqo += v;
      });
      // Prefer org-level target row (workspace_id null), else sum
      const tgts = (targetsRes.data ?? []) as any[];
      const orgRow = tgts.find((t) => !t.workspace_id);
      const mqlTarget = orgRow
        ? orgRow.mql_target
        : tgts.reduce((s, t) => s + (t.mql_target ?? 0), 0);
      const sqoTarget = orgRow
        ? orgRow.sqo_target
        : tgts.reduce((s, t) => s + (t.sqo_target ?? 0), 0);
      setStat({ mqlActual: mql, sqoActual: sqo, mqlTarget, sqoTarget });
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, start, end, ym, reloadKey]);

  // expected % of month elapsed (for "on pace" comparison)
  const elapsedPct = Math.max(
    0,
    Math.min(100, ((Date.now() - start.getTime()) / (end.getTime() - start.getTime())) * 100),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {error ? (
        <PanelError onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <MqlSqoCard stat={stat} elapsedPct={elapsedPct} />
      )}
      <QuarterPacing orgId={orgId} />
    </div>
  );
}

function MqlSqoCard({ stat, elapsedPct }: { stat: Stat | null; elapsedPct: number }) {
  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long" });

  return (
    <GlassPanel className="p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Pipeline pacing
          </div>
          <div className="mt-1 font-display text-2xl">{monthLabel}</div>
        </div>
        <div className="text-right text-xs text-muted-foreground tabular-nums">
          <span className="text-foreground">{elapsedPct.toFixed(0)}%</span> of month elapsed
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <Row label="MQL" actual={stat?.mqlActual ?? 0} target={stat?.mqlTarget ?? 0} elapsedPct={elapsedPct} />
        <Row label="SQO" actual={stat?.sqoActual ?? 0} target={stat?.sqoTarget ?? 0} elapsedPct={elapsedPct} />
      </div>

      {stat && stat.mqlTarget === 0 && stat.sqoTarget === 0 && (
        <div className="mt-5 text-[11px] text-muted-foreground">
          Set monthly targets in{" "}
          <Link to="/tools" search={{ focus: "funnel-targets" }} className="text-foreground underline-offset-4 hover:underline">
            Funnel targets
          </Link>{" "}
          to see pacing.
        </div>
      )}
    </GlassPanel>
  );
}

function Row({
  label,
  actual,
  target,
  elapsedPct,
}: {
  label: string;
  actual: number;
  target: number;
  elapsedPct: number;
}) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  let pace: { txt: string; tone: string } = { txt: "—", tone: "text-muted-foreground" };
  if (target > 0) {
    const delta = pct - elapsedPct;
    if (delta >= 5) pace = { txt: "Ahead", tone: "text-[oklch(0.82_0.20_155)]" };
    else if (delta <= -5) pace = { txt: "Behind", tone: "text-[oklch(0.78_0.18_25)]" };
    else pace = { txt: "On pace", tone: "text-[oklch(0.82_0.17_75)]" };
  }
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="hex-frame font-display text-2xl tabular-nums leading-none">
            {actual.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            / {target.toLocaleString() || "—"}
          </span>
        </div>
        <span className={`text-[11px] uppercase tracking-wider ${pace.tone}`}>{pace.txt}</span>
      </div>

      <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_275)] via-[oklch(0.78_0.18_305)] to-[oklch(0.78_0.18_340)] transition-all"
          style={{ width: `${pct}%` }}
        />
        {target > 0 && (
          <div
            className="absolute inset-y-0 w-px bg-white/40"
            style={{ left: `${elapsedPct}%` }}
            title="Expected pace"
          />
        )}
      </div>
    </div>
  );
}
