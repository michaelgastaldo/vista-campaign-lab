import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import { PanelError } from "@/components/ui-custom/PanelError";
import { DemoDataBanner } from "@/components/ui-custom/DemoDataBanner";
import { NumberTicker } from "@/components/ui-custom/NumberTicker";

import {
  IconPlus,
  IconClose,
  IconArrowRight,
  IconFunnel,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/funnel")({
  component: () => <FunnelPageContent />,
});

type FunnelEvent = {
  id: string;
  stage: string;
  source: string | null;
  channel: string | null;
  value_count: number;
  occurred_on: string;
  is_sample?: boolean;
};

type StageDef = {
  id: string;
  label: string;
  /** CSS color used for SVG strokes / dots */
  hex: string;
  /** Soft tinted bg for cards */
  tint: string;
  /** Plain-English explanation for the tooltip */
  blurb: string;
};

// Heat: purple → indigo → blue → teal → green (top to bottom)
const STAGES: StageDef[] = [
  {
    id: "lead",
    label: "Leads",
    hex: "#a78bfa",
    tint: "bg-violet-500/10",
    blurb:
      "Anyone who has shown interest — form fills, ad clicks, event sign-ups.",
  },
  {
    id: "mql",
    label: "MQL",
    hex: "#818cf8",
    tint: "bg-indigo-500/10",
    blurb:
      "Marketing Qualified Lead — a lead that has met your marketing engagement threshold and is ready to hand off to sales.",
  },
  {
    id: "sql",
    label: "SQL",
    hex: "#60a5fa",
    tint: "bg-blue-500/10",
    blurb:
      "Sales Qualified Lead — a lead the sales team has reviewed and accepted as worth actively pursuing.",
  },
  {
    id: "opp",
    label: "Opportunity",
    hex: "#2dd4bf",
    tint: "bg-teal-500/10",
    blurb:
      "A qualified prospect with a potential deal — has a defined need, budget, and timeline.",
  },
  {
    id: "won",
    label: "Won",
    hex: "#34d399",
    tint: "bg-emerald-500/10",
    blurb: "A closed deal. A new customer.",
  },
];

type Period = "this_week" | "this_month" | "this_quarter" | "all_time";

function periodRange(p: Period): { from: string; to: string } {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "this_week") {
    const d = new Date(today);
    const day = d.getUTCDay() || 7;
    if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
    return { from: iso(d), to: iso(today) };
  }
  if (p === "this_month") {
    return {
      from: iso(new Date(Date.UTC(y, m, 1))),
      to: iso(new Date(Date.UTC(y, m + 1, 0))),
    };
  }
  if (p === "this_quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return {
      from: iso(new Date(Date.UTC(y, qStart, 1))),
      to: iso(new Date(Date.UTC(y, qStart + 3, 0))),
    };
  }
  return { from: "1970-01-01", to: "2999-12-31" };
}

function previousRange(r: { from: string; to: string }): { from: string; to: string } {
  const from = new Date(r.from + "T00:00:00Z");
  const to = new Date(r.to + "T00:00:00Z");
  const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (span - 1) * 86400000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

function withinRange(date: string, r: { from: string; to: string }) {
  return date >= r.from && date <= r.to;
}

function totalsByStage(events: FunnelEvent[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const s of STAGES) t[s.id] = 0;
  for (const e of events) t[e.stage] = (t[e.stage] ?? 0) + e.value_count;
  return t;
}

export function FunnelPageContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { user } = useAuth();
  const orgId = useOrgId();
  // Options/cohort events: a wide rolling window scoped to the org, used to
  // populate filter dropdowns and the weekly cohort table. Refetched only when
  // the org changes (or a new event is logged).
  const [optionsEvents, setOptionsEvents] = useState<FunnelEvent[]>([]);
  // Scoped events: the period+channel+source slice driving the funnel chart
  // and summary cards. Pulled from the DB every time a filter changes so we
  // never silently truncate at a client-side row cap.
  const [scopedEvents, setScopedEvents] = useState<FunnelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopedLoading, setScopedLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [scopedError, setScopedError] = useState<string | null>(null);
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);
  const [scopedReloadKey, setScopedReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);


  const [period, setPeriod] = useState<Period>("this_month");
  const [channelFilter, setChannelFilter] = useState<string>("__all__");
  const [sourceFilter, setSourceFilter] = useState<string>("__all__");
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const range = useMemo(() => periodRange(period), [period]);
  const prevRange = useMemo(() => previousRange(range), [range]);

  // Initial / org-scoped fetch — drives filter dropdowns and weekly cohort.
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("funnel_events")
        .select("id, stage, source, channel, value_count, occurred_on, is_sample")
        .eq("org_id", orgId)
        .order("occurred_on", { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (error) {
        setOptionsError(error.message);
        setOptionsEvents([]);
      } else {
        setOptionsError(null);
        setOptionsEvents((data as FunnelEvent[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, optionsReloadKey]);

  // Scoped fetch — re-runs whenever period or filters change.
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setScopedLoading(true);
    (async () => {
      let q = supabase
        .from("funnel_events")
        .select("id, stage, source, channel, value_count, occurred_on")
        .eq("org_id", orgId)
        .gte("occurred_on", prevRange.from)
        .lte("occurred_on", range.to)
        .order("occurred_on", { ascending: false })
        .limit(10000);
      if (channelFilter !== "__all__") q = q.eq("channel", channelFilter);
      if (sourceFilter !== "__all__") q = q.eq("source", sourceFilter);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        setScopedError(error.message);
        setScopedEvents([]);
      } else {
        setScopedError(null);
        setScopedEvents((data as FunnelEvent[]) ?? []);
      }
      setScopedLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, range.from, range.to, prevRange.from, prevRange.to, channelFilter, sourceFilter, scopedReloadKey]);


  const allChannels = useMemo(() => {
    const s = new Set<string>();
    for (const e of optionsEvents) if (e.channel) s.add(e.channel);
    return Array.from(s).sort();
  }, [optionsEvents]);
  const allSources = useMemo(() => {
    const s = new Set<string>();
    for (const e of optionsEvents) if (e.source) s.add(e.source);
    return Array.from(s).sort();
  }, [optionsEvents]);

  const current = useMemo(
    () => scopedEvents.filter((e) => withinRange(e.occurred_on, range)),
    [scopedEvents, range],
  );
  const previous = useMemo(
    () => scopedEvents.filter((e) => withinRange(e.occurred_on, prevRange)),
    [scopedEvents, prevRange],
  );

  // Weekly cohort uses the org-wide options events so it always shows the
  // full 8-week trend, independent of the page period selector. Channel /
  // source filters still apply so the trend matches what the user is slicing.
  const cohortEvents = useMemo(
    () =>
      optionsEvents.filter(
        (e) =>
          (channelFilter === "__all__" || e.channel === channelFilter) &&
          (sourceFilter === "__all__" || e.source === sourceFilter),
      ),
    [optionsEvents, channelFilter, sourceFilter],
  );

  const currentTotals = useMemo(() => totalsByStage(current), [current]);
  const previousTotals = useMemo(() => totalsByStage(previous), [previous]);

  const overallConv = useMemo(() => {
    const leads = currentTotals.lead || 0;
    const won = currentTotals.won || 0;
    return leads > 0 ? (won / leads) * 100 : 0;
  }, [currentTotals]);

  const activeStageDef = activeStage ? STAGES.find((s) => s.id === activeStage) ?? null : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        {!hideHeader && (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-start gap-4">
              <PageHexBadge hue={275} size={26} icon={<IconFunnel size={22} />} aria-label="Funnel" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Pipeline view
                </div>
                <h1 className="mt-1 font-display text-4xl tracking-tight">
                  Funnel
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Lead → Won pipeline, filtered by period, channel and source.{" "}
                  <Link to="/integrations" className="text-primary hover:opacity-80">
                    Connect your CRM or analytics source
                  </Link>{" "}
                  to stream events automatically.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/tools"
                search={{ focus: "funnel-targets" }}
                className="inline-flex items-center gap-2 rounded-xl border border-glass-border bg-glass/40 px-3.5 py-2 text-sm text-foreground transition hover:bg-glass-strong"
              >
                Set targets <IconArrowRight size={12} />
              </Link>
              <button
                onClick={() => setAdding(true)}
                className="btn-keystone inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_8px_32px_-8px_oklch(0.72_0.2_275_/_0.4)] hover:opacity-90"
              >
                <IconPlus size={14} /> Log event
              </button>
            </div>
          </div>
        )}

        {optionsEvents.some((e) => e.is_sample) && (
          <DemoDataBanner
            storageKey="funnel-sample"
            label="Sample data — these funnel events were seeded so the pipeline isn't empty. Replace them with your own or clear them in Settings."
            ctaHref="#"
          />
        )}

        <FiltersBar
          period={period}
          setPeriod={setPeriod}
          channels={allChannels}
          channelFilter={channelFilter}
          setChannelFilter={setChannelFilter}
          sources={allSources}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
        />

        {loading ? (
          <>
            <GlassSkeleton rows={2} />
            <GlassSkeleton rows={6} />
          </>
        ) : optionsError ? (
          <PanelError
            message="Couldn't load funnel"
            onRetry={() => {
              setOptionsReloadKey((k) => k + 1);
              setScopedReloadKey((k) => k + 1);
            }}
          />
        ) : optionsEvents.length === 0 ? (
          <>
            <SummaryRow
              currentTotals={currentTotals}
              previousTotals={previousTotals}
              overallConv={0}
              isSparse
            />
            <SparseFunnelGhost onLog={() => setAdding(true)} totals={currentTotals} />
          </>
        ) : scopedError ? (
          <PanelError
            message="Couldn't load funnel events for this slice"
            onRetry={() => setScopedReloadKey((k) => k + 1)}
          />
        ) : current.length === 0 && !scopedLoading ? (
          <FilteredEmptyState
            period={period}
            channelFilter={channelFilter}
            sourceFilter={sourceFilter}
            onReset={() => {
              setPeriod("all_time");
              setChannelFilter("__all__");
              setSourceFilter("__all__");
            }}
            onLog={() => setAdding(true)}
          />
        ) : (() => {
          const totalCount = Object.values(currentTotals).reduce((a, b) => a + b, 0);
          const isEmpty = totalCount === 0;
          const isGettingStarted = totalCount > 0 && totalCount < 20;
          return (
            <>
              <SummaryRow
                currentTotals={currentTotals}
                previousTotals={previousTotals}
                overallConv={overallConv}
                isSparse={isEmpty}
              />
              {isEmpty ? (
                <SparseFunnelGhost onLog={() => setAdding(true)} totals={currentTotals} />
              ) : (
                <>
                  {isGettingStarted && <GettingStartedHint />}
                  <FunnelChart
                    totals={currentTotals}
                    activeStage={activeStage}
                    onSelect={(id) => setActiveStage(id)}
                  />
                </>
              )}
              <WeeklyCohortPanel events={cohortEvents} orgId={orgId} />
            </>
          );
        })()}

        {/* Stage detail drawer */}
        <Sheet
          open={!!activeStageDef}
          onOpenChange={(o) => {
            if (!o) setActiveStage(null);
          }}
        >
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 border-l border-glass-border bg-background/85 p-0 backdrop-blur-xl sm:max-w-md"
          >
            {activeStageDef && (
              <StageDetail
                stage={activeStageDef}
                events={current}
                allEvents={cohortEvents}
                range={range}
                currentTotals={currentTotals}
              />
            )}
          </SheetContent>

        </Sheet>

        {adding && (
          <AddEventModal
            onClose={() => setAdding(false)}
            orgId={orgId}
            userId={user?.id ?? null}
            onAdded={(e) => {
              setOptionsEvents((cur) => [e, ...cur]);
              setScopedEvents((cur) => [e, ...cur]);
              // Belt-and-suspenders: trigger a refetch so the funnel and KPI
              // row reflect the new event even if it falls outside the local
              // optimistic slice (e.g. dated in the past or filtered out).
              setOptionsReloadKey((k) => k + 1);
              setScopedReloadKey((k) => k + 1);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

/* ====================== Filters ====================== */

function FiltersBar(props: {
  period: Period;
  setPeriod: (p: Period) => void;
  channels: string[];
  channelFilter: string;
  setChannelFilter: (v: string) => void;
  sources: string[];
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
}) {
  const periodOptions: { id: Period; label: string }[] = [
    { id: "this_week", label: "This week" },
    { id: "this_month", label: "This month" },
    { id: "this_quarter", label: "This quarter" },
    { id: "all_time", label: "All time" },
  ];
  return (
    <GlassPanel className="flex flex-wrap items-center gap-3 p-2">
      <div className="inline-flex rounded-xl border border-glass-border bg-glass/30 p-1">
        {periodOptions.map((p) => {
          const active = props.period === p.id;
          return (
            <button
              key={p.id}
              onClick={() => props.setPeriod(p.id)}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="period-pill"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{p.label}</span>
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Channel"
          value={props.channelFilter}
          onChange={props.setChannelFilter}
          options={["email", "paid-social", "organic", "partner", "event", ...props.channels.filter(c => !["email","paid-social","organic","partner","event"].includes(c))]}
        />
        <FilterSelect
          label="Source"
          value={props.sourceFilter}
          onChange={props.setSourceFilter}
          options={props.sources}
        />
      </div>
    </GlassPanel>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-glass rounded-lg px-2.5 py-1.5 text-xs"
      >
        <option value="__all__">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ====================== Summary cards ====================== */

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (cur === 0 && prev === 0) return <span className="text-muted-foreground/60">—</span>;
  if (prev === 0) {
    return <span className="text-muted-foreground/70">— no prior data</span>;
  }
  const delta = ((cur - prev) / prev) * 100;
  const up = delta >= 0;
  return (
    <span
      className={
        up
          ? "font-semibold text-emerald-300 [text-shadow:0_0_12px_rgb(110_231_183/0.35)]"
          : "font-semibold text-rose-300 [text-shadow:0_0_12px_rgb(253_164_175/0.35)]"
      }
    >
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

function InfoDot({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex size-3.5 items-center justify-center rounded-full border border-glass-border bg-glass/40 text-[9px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          aria-label="More info"
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function SummaryRow({
  currentTotals,
  previousTotals,
  overallConv,
  isSparse,
}: {
  currentTotals: Record<string, number>;
  previousTotals: Record<string, number>;
  overallConv: number;
  isSparse?: boolean;
}) {
  return (
    <div className="space-y-2">
      {/* Hero conversion */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassPanel className="relative overflow-hidden px-4 py-3">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(60% 80% at 20% 30%, oklch(0.72 0.2 275 / 0.18), transparent 70%), radial-gradient(50% 70% at 90% 70%, oklch(0.78 0.18 340 / 0.18), transparent 70%)",
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Overall pipeline conversion
              </div>
              <InfoDot>
                The share of Leads in this period that became Won customers. Calculated as Won ÷ Leads.
              </InfoDot>
            </div>
            <div className="hidden h-1.5 max-w-md flex-1 overflow-hidden rounded-full bg-black/30 sm:block">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, overallConv)}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400"
              />
            </div>
            <div className="font-display text-2xl tabular-nums leading-none">
              {isSparse ? (
                <span className="text-muted-foreground/60">—</span>
              ) : (
                <>
                  <NumberTicker value={overallConv} format={(n) => n.toFixed(2)} />
                  <span className="ml-1 text-base text-muted-foreground">%</span>
                </>
              )}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Per-stage stat tiles */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:gap-2 sm:overflow-visible lg:grid-cols-5">
        {STAGES.map((s, i) => {
          const cur = currentTotals[s.id] || 0;
          const prev = previousTotals[s.id] || 0;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-[148px] shrink-0 sm:min-w-0"
            >
              <GlassPanel
                className="relative flex h-[104px] flex-col justify-between overflow-hidden px-3.5 py-3"
              >
                {/* Accent bar */}
                <div
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{
                    background: `linear-gradient(90deg, ${s.hex} 0%, ${s.hex}88 60%, transparent 100%)`,
                    boxShadow: `0 0 12px ${s.hex}55`,
                  }}
                />
                {/* Soft stage tint */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    background: `radial-gradient(120% 90% at 100% 0%, ${s.hex}18, transparent 60%)`,
                  }}
                />
                <div className="relative flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: s.hex, boxShadow: `0 0 8px ${s.hex}` }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {s.label}
                  </span>
                  <InfoDot>{s.blurb}</InfoDot>
                </div>
                <div className="relative">
                  <div className="font-display text-[26px] tabular-nums leading-none">
                    {isSparse && cur === 0 ? (
                      <span className="text-muted-foreground/60">—</span>
                    ) : (
                      <NumberTicker value={cur} />
                    )}
                  </div>
                  <div className="mt-1.5 text-[10px] font-medium">
                    {isSparse ? (
                      <span className="text-muted-foreground/60">—</span>
                    ) : (
                      <>
                        <DeltaBadge cur={cur} prev={prev} />
                        <span className="ml-1 text-muted-foreground/70">vs prev</span>
                      </>
                    )}
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ====================== Funnel chart (smooth bezier silhouette) ====================== */


function rebuildSmoothPath(widths: number[], stageH: number, cx: number): string {
  const n = widths.length - 1;
  const lastW = widths[n];
  const r = Math.min(24, lastW / 2);
  const topY = 0;
  const bottomY = n * stageH;

  let d = `M ${cx - widths[0] / 2} ${topY}`;
  d += ` L ${cx + widths[0] / 2} ${topY}`;
  // Right edge
  for (let i = 0; i < n; i++) {
    const y0 = i * stageH;
    const y1 = (i + 1) * stageH;
    const x0 = cx + widths[i] / 2;
    const x1 = cx + widths[i + 1] / 2;
    const cy = stageH * 0.5;
    if (i === n - 1) {
      // last segment stops short for rounded corner
      d += ` C ${x0} ${y0 + cy} ${x1} ${y1 - cy} ${x1} ${y1 - r}`;
      d += ` Q ${x1} ${y1} ${x1 - r} ${y1}`;
    } else {
      d += ` C ${x0} ${y0 + cy} ${x1} ${y1 - cy} ${x1} ${y1}`;
    }
  }
  // Bottom edge
  d += ` L ${cx - lastW / 2 + r} ${bottomY}`;
  d += ` Q ${cx - lastW / 2} ${bottomY} ${cx - lastW / 2} ${bottomY - r}`;
  // Left edge (reverse)
  for (let i = n - 1; i >= 0; i--) {
    const y0 = i * stageH;
    const y1 = (i + 1) * stageH;
    const x0 = cx - widths[i] / 2;
    const x1 = cx - widths[i + 1] / 2;
    const cy = stageH * 0.5;
    if (i === n - 1) {
      d += ` L ${x1} ${y1 - r}`;
      d += ` C ${x1} ${y1 - cy} ${x0} ${y0 + cy} ${x0} ${y0}`;
    } else {
      d += ` C ${x1} ${y1 - cy} ${x0} ${y0 + cy} ${x0} ${y0}`;
    }
  }
  d += " Z";
  return d;
}

function FunnelChart({
  totals,
  activeStage,
  onSelect,
  ghost = false,
}: {
  totals: Record<string, number>;
  activeStage: string | null;
  onSelect: (id: string) => void;
  /** When true, render an outline-only "ghost" silhouette (empty state). */
  ghost?: boolean;
}) {
  const W_TOTAL = 920;
  const W_FUNNEL = 640;
  const FUNNEL_X = 40;
  const cx = FUNNEL_X + W_FUNNEL / 2;
  const STAGE_H = 96;
  const H = STAGES.length * STAGE_H;

  const values = STAGES.map((s) => (ghost ? 0 : totals[s.id] || 0));
  const maxVal = Math.max(1, ...values);
  const minRatio = 0.22;
  const widthOfVal = (v: number) => {
    const raw = maxVal > 0 ? v / maxVal : 0;
    return Math.max(minRatio, raw) * W_FUNNEL;
  };

  // widths at each seam: seam i = top of stage i (except last which also gets bottom = 60% of last)
  const seamWidths: number[] = [];
  for (let i = 0; i < STAGES.length; i++) {
    seamWidths.push(widthOfVal(values[i]));
  }
  // bottom of last stage: taper to 55% of last width (gives graceful bottleneck)
  seamWidths.push(Math.max(minRatio * W_FUNNEL * 0.55, seamWidths[seamWidths.length - 1] * 0.55));

  const outlinePath = rebuildSmoothPath(seamWidths, STAGE_H, cx);

  // Conversion per seam (skip first — no previous stage)
  const convs = STAGES.map((_, i) => {
    if (i === 0) return null;
    const prev = values[i - 1];
    const cur = values[i];
    return prev > 0 ? (cur / prev) * 100 : null;
  });
  // Biggest drop (smallest conversion %)
  let biggestDropIdx = -1;
  let smallest = Infinity;
  convs.forEach((c, i) => {
    if (c !== null && c < smallest) {
      smallest = c;
      biggestDropIdx = i;
    }
  });

  return (
    <GlassPanel className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg leading-tight">Pipeline funnel</h2>
          <p className="text-xs text-muted-foreground">
            Click a stage for details · widths proportional to volume
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Conversion %
          <InfoDot>
            The share of the previous stage that progressed here. Higher is better.
          </InfoDot>
        </div>
      </div>

      {/* Desktop: SVG silhouette with side conversion pills */}
      <div className="relative hidden md:block">
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .funnel-band, .funnel-pill { animation: none !important; }
            .funnel-arrow { animation: none !important; opacity: 0 !important; }
          }
          @keyframes funnel-band-in {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes funnel-pill-in {
            from { opacity: 0; transform: translateX(-8px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>
        <svg
          viewBox={`0 0 ${W_TOTAL} ${H + 8}`}
          className="mx-auto block w-full max-w-[920px]"
          style={{ height: H + 8 }}
        >
          <defs>
            {STAGES.map((s) => (
              <linearGradient
                key={s.id}
                id={`grad-${s.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.hex} stopOpacity={ghost ? 0 : 0.28} />
                <stop offset="45%" stopColor={s.hex} stopOpacity={ghost ? 0 : 0.85} />
                <stop offset="100%" stopColor={s.hex} stopOpacity={ghost ? 0 : 0.75} />
              </linearGradient>
            ))}
            <linearGradient id="stage-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0.22" />
              <stop offset="18%" stopColor="oklch(1 0 0)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="oklch(1 0 0)" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="flow-grad"
              x1="0"
              y1="0"
              x2="0"
              y2={H}
              gradientUnits="userSpaceOnUse"
            >
              {STAGES.map((s, i) => (
                <stop
                  key={s.id}
                  offset={`${(i / Math.max(1, STAGES.length - 1)) * 100}%`}
                  stopColor={s.hex}
                />
              ))}
            </linearGradient>
            <filter id="band-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="funnel-clip">
              <path d={outlinePath} />
            </clipPath>
          </defs>

          {/* Inner shadow for depth */}
          {!ghost && (
            <path
              d={outlinePath}
              fill="oklch(0 0 0 / 0.35)"
            />
          )}

          {/* Bands as gradient rects, clipped to silhouette */}
          <g clipPath="url(#funnel-clip)">
            {STAGES.map((s, i) => (
              <g
                key={s.id}
                className="funnel-band"
                style={{
                  animation: `funnel-band-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${
                    0.05 + i * 0.09
                  }s both`,
                  opacity: activeStage && activeStage !== s.id ? 0.42 : 1,
                  transition: "opacity 200ms ease",
                }}
              >
                <rect
                  x={0}
                  y={i * STAGE_H}
                  width={W_TOTAL}
                  height={STAGE_H}
                  fill={`url(#grad-${s.id})`}
                />
                {/* Per-band top-edge sheen */}
                <rect
                  x={0}
                  y={i * STAGE_H}
                  width={W_TOTAL}
                  height={STAGE_H * 0.55}
                  fill="url(#stage-sheen)"
                />
              </g>
            ))}

            {/* Ambient flowing arrows */}
            {!ghost && (
              <g pointerEvents="none">
                {(() => {
                  const count = 12;
                  const steps = 12;
                  const els: React.ReactNode[] = [];
                  for (let i = 0; i < count; i++) {
                    const p = -0.85 + ((i * 0.181) % 1) * 1.7;
                    const duration = 10 + ((i * 1.9) % 6);
                    const delay = -((i * 1.31) % duration);
                    const size = 5.5 + (i % 3) * 1.1;
                    const op = 0.28 + ((i * 2) % 4) * 0.04;
                    const animName = `flowarrow-${i}`;
                    const kfs: string[] = [];
                    for (let k = 0; k <= steps; k++) {
                      const t = k / steps;
                      // Interpolate width along seams
                      const stageF = t * (seamWidths.length - 1);
                      const si = Math.min(seamWidths.length - 2, Math.floor(stageF));
                      const sf = stageF - si;
                      const halfW =
                        (seamWidths[si] + (seamWidths[si + 1] - seamWidths[si]) * sf) / 2;
                      const x = cx + p * halfW;
                      const y = -18 + t * (H + 36);
                      const pct = ((k / steps) * 100).toFixed(2);
                      kfs.push(`${pct}% { transform: translate(${x.toFixed(2)}px, ${y.toFixed(2)}px); }`);
                    }
                    els.push(
                      <g
                        key={`arr-${i}`}
                        className="funnel-arrow"
                        style={{
                          animation: `${animName} ${duration}s linear ${delay}s infinite, flowarrow-fade ${duration}s linear ${delay}s infinite`,
                          transformBox: "fill-box",
                          transformOrigin: "center",
                        }}
                      >
                        <style>{`@keyframes ${animName} { ${kfs.join(" ")} }`}</style>
                        <path
                          d={`M ${-size} 0 L 0 ${size * 0.7} L ${size} 0`}
                          fill="none"
                          stroke="url(#flow-grad)"
                          strokeOpacity={op}
                          strokeWidth={1.4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>,
                    );
                  }
                  return (
                    <>
                      <style>{`@keyframes flowarrow-fade { 0%, 100% { opacity: 0 } 12%, 88% { opacity: 1 } }`}</style>
                      {els}
                    </>
                  );
                })()}
              </g>
            )}
          </g>

          {/* Outline stroke */}
          <path
            d={outlinePath}
            fill="none"
            stroke={ghost ? "oklch(1 0 0 / 0.28)" : "oklch(1 0 0 / 0.18)"}
            strokeWidth={ghost ? 1.4 : 1}
            strokeDasharray={ghost ? "5 6" : undefined}
            pointerEvents="none"
          />

          {/* Labels + interactive hit areas per stage */}
          {STAGES.map((s, i) => {
            const y = i * STAGE_H;
            const topW = seamWidths[i];
            const botW = seamWidths[i + 1];
            const midW = (topW + botW) / 2;
            const isActive = activeStage === s.id;

            return (
              <g key={s.id}>
                {/* Active ring — soft glow inside silhouette */}
                {isActive && !ghost && (
                  <rect
                    x={cx - midW / 2}
                    y={y}
                    width={midW}
                    height={STAGE_H}
                    fill="oklch(1 0 0 / 0.08)"
                    clipPath="url(#funnel-clip)"
                  />
                )}
                {/* Centered label + count */}
                {!ghost && (
                  <>
                    <text
                      x={cx}
                      y={y + STAGE_H / 2 - 8}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight={700}
                      fill="oklch(1 0 0 / 0.92)"
                      style={{ letterSpacing: 1.6, textTransform: "uppercase" }}
                      pointerEvents="none"
                    >
                      {s.label}
                    </text>
                    <text
                      x={cx}
                      y={y + STAGE_H / 2 + 18}
                      textAnchor="middle"
                      fontSize="22"
                      fontWeight={700}
                      fill="oklch(1 0 0 / 0.98)"
                      pointerEvents="none"
                      style={{ letterSpacing: -0.5 }}
                    >
                      {(values[i] || 0).toLocaleString()}
                    </text>
                  </>
                )}
                {ghost && (
                  <text
                    x={cx}
                    y={y + STAGE_H / 2 + 5}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={600}
                    fill="oklch(1 0 0 / 0.35)"
                    style={{ letterSpacing: 1.6, textTransform: "uppercase" }}
                    pointerEvents="none"
                  >
                    {s.label}
                  </text>
                )}
                {/* Hit area for click */}
                {!ghost && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <rect
                        x={cx - Math.max(topW, botW) / 2}
                        y={y}
                        width={Math.max(topW, botW)}
                        height={STAGE_H}
                        fill="transparent"
                        clipPath="url(#funnel-clip)"
                        style={{ cursor: "pointer" }}
                        onClick={() => onSelect(s.id)}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      sideOffset={12}
                      className="max-w-[280px] border-glass-border bg-background/95 p-0 shadow-2xl backdrop-blur-xl"
                    >
                      <div className="space-y-2.5 p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.hex }} />
                          <span className="font-display text-base leading-none">{s.label}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {s.blurb}
                        </p>
                        <div className="flex items-end justify-between gap-3 border-t border-glass-border/60 pt-2.5">
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              In period
                            </div>
                            <div className="mt-0.5 font-display text-xl tabular-nums">
                              {(values[i] || 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {i === 0 ? "Top of funnel" : `From ${STAGES[i - 1].label}`}
                            </div>
                            <div className="mt-0.5 font-display text-xl tabular-nums">
                              {convs[i] !== null ? `${convs[i]!.toFixed(1)}%` : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </g>
            );
          })}
        </svg>

        {/* Conversion pills — HTML overlay, positioned on each seam */}
        {!ghost && (
          <div className="pointer-events-none absolute inset-0">
            {STAGES.map((s, i) => {
              if (i === 0 || convs[i] === null) return null;
              const conv = convs[i]!;
              const isBiggestDrop = i === biggestDropIdx && conv < 100;
              // Position the pill vertically at the seam between stage i-1 and stage i.
              // The SVG uses viewBox 0..H+8, so seam-y as fraction of total height:
              const seamY = i * STAGE_H;
              const topPct = (seamY / (H + 8)) * 100;
              return (
                <div
                  key={`pill-${s.id}`}
                  className="funnel-pill absolute right-2 md:right-4 -translate-y-1/2"
                  style={{
                    top: `${topPct}%`,
                    animation: `funnel-pill-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${
                      0.15 + i * 0.09
                    }s both`,
                  }}
                >
                  <ConversionPill
                    label={`${conv.toFixed(0)}%`}
                    from={STAGES[i - 1].label}
                    biggestDrop={isBiggestDrop}
                    hue={s.hex}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile: stacked full-width bands with inline chips */}
      <div className="md:hidden">
        <MobileFunnel
          values={values}
          convs={convs}
          biggestDropIdx={biggestDropIdx}
          activeStage={activeStage}
          onSelect={onSelect}
          ghost={ghost}
        />
      </div>
    </GlassPanel>
  );
}

function ConversionPill({
  label,
  from,
  biggestDrop,
  hue,
}: {
  label: string;
  from: string;
  biggestDrop?: boolean;
  hue: string;
}) {
  return (
    <div
      className={`glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold tabular-nums shadow-[0_8px_24px_-8px_oklch(0_0_0/0.6)] ${
        biggestDrop ? "ring-1 ring-amber-300/60" : ""
      }`}
      style={
        biggestDrop
          ? {
              background:
                "linear-gradient(135deg, oklch(0.86 0.14 88 / 0.28), oklch(0.78 0.18 340 / 0.14))",
              boxShadow:
                "0 0 0 1px oklch(0.86 0.14 88 / 0.5), 0 0 24px -4px oklch(0.86 0.14 88 / 0.55)",
            }
          : undefined
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: biggestDrop ? "oklch(0.86 0.14 88)" : hue }}
      />
      <span>→ {label}</span>
      <span className="text-[10px] font-medium text-muted-foreground">from {from}</span>
      {biggestDrop && (
        <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-amber-200/95">
          Biggest drop
        </span>
      )}
    </div>
  );
}

function MobileFunnel({
  values,
  convs,
  biggestDropIdx,
  activeStage,
  onSelect,
  ghost,
}: {
  values: number[];
  convs: (number | null)[];
  biggestDropIdx: number;
  activeStage: string | null;
  onSelect: (id: string) => void;
  ghost: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {STAGES.map((s, i) => {
        const isActive = activeStage === s.id;
        return (
          <div key={s.id}>
            {i > 0 && convs[i] !== null && (
              <div className="my-1 flex justify-center">
                <ConversionPill
                  label={`${convs[i]!.toFixed(0)}%`}
                  from={STAGES[i - 1].label}
                  biggestDrop={i === biggestDropIdx && convs[i]! < 100}
                  hue={s.hex}
                />
              </div>
            )}
            <button
              onClick={() => !ghost && onSelect(s.id)}
              disabled={ghost}
              className="funnel-band block w-full text-left"
              style={{
                animation: `funnel-band-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${
                  0.05 + i * 0.07
                }s both`,
              }}
            >
              <div
                className="relative overflow-hidden rounded-2xl border px-4 py-4 transition"
                style={{
                  background: ghost
                    ? "transparent"
                    : `linear-gradient(90deg, ${s.hex}30 0%, ${s.hex}55 45%, ${s.hex}30 100%)`,
                  borderColor: ghost ? "oklch(1 0 0 / 0.22)" : `${s.hex}66`,
                  borderStyle: ghost ? "dashed" : "solid",
                  opacity: activeStage && !isActive ? 0.55 : 1,
                  boxShadow: isActive ? `0 0 0 1px ${s.hex}, 0 0 22px -4px ${s.hex}88` : undefined,
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent" />
                <div className="relative flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/90">
                    {s.label}
                  </div>
                  <div className="font-display text-xl tabular-nums text-white">
                    {ghost ? "—" : (values[i] || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ====================== Getting-started hint (small-but-real) ====================== */

function GettingStartedHint() {
  const STORAGE_KEY = "funnel-getting-started-dismissed";
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1") {
        setDismissed(true);
      }
    } catch {}
  }, []);
  if (dismissed) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-glass-border bg-glass/40 px-3 py-2 text-xs text-muted-foreground backdrop-blur"
    >
      <span
        className="inline-block size-1.5 rounded-full bg-primary"
        style={{ boxShadow: "0 0 8px oklch(0.72 0.2 275)" }}
      />
      <span>
        Just getting started — log events or{" "}
        <Link
          to="/tools"
          search={{ focus: "campaign-import" }}
          className="text-primary underline-offset-2 hover:underline"
        >
          import a list
        </Link>{" "}
        and the funnel fills in.
      </span>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, "1");
          } catch {}
          setDismissed(true);
        }}
        className="ml-auto rounded-md p-1 text-muted-foreground/70 transition hover:bg-glass-strong hover:text-foreground"
        aria-label="Dismiss hint"
      >
        <IconClose size={12} />
      </button>
    </motion.div>
  );
}

/* ====================== Sparse (near-empty) ghost overlay ====================== */



function SparseFunnelGhost({
  onLog,
  totals,
}: {
  onLog: () => void;
  totals: Record<string, number>;
}) {
  return (
    <div className="relative">
      <FunnelChart
        totals={totals}
        activeStage={null}
        onSelect={() => {}}
        ghost
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto max-w-sm rounded-2xl border border-glass-border bg-background/70 p-5 text-center shadow-[0_24px_60px_-24px_oklch(0_0_0/0.8)] backdrop-blur-xl"
        >
          <div className="mx-auto inline-flex size-10 items-center justify-center rounded-xl border border-glass-border bg-glass/60 text-primary">
            <IconFunnel size={18} />
          </div>
          <h3 className="mt-3 font-display text-lg">Your funnel fills in as events are logged.</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Log a stage manually or connect your CRM to stream conversions automatically.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              onClick={onLog}
              className="btn-keystone inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <IconPlus size={14} /> Log an event
            </button>
            <Link
              to="/connectors"
              className="inline-flex items-center gap-2 rounded-xl border border-glass-border bg-glass/40 px-3.5 py-2 text-sm transition hover:bg-glass-strong"
            >
              Connect your CRM <IconArrowRight size={12} />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ====================== Stage detail (drawer) ====================== */

function StageDetail({
  stage,
  events,
  allEvents,
  range,
  currentTotals,
}: {
  stage: StageDef;
  events: FunnelEvent[];
  allEvents: FunnelEvent[];
  range: { from: string; to: string };
  currentTotals: Record<string, number>;
}) {
  const stageEvents = events.filter((e) => e.stage === stage.id);

  const topSources = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of stageEvents) {
      const k = e.source ?? "direct";
      map.set(k, (map.get(k) ?? 0) + e.value_count);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [stageEvents]);

  const spark = useMemo(() => {
    const days: { d: string; v: number }[] = [];
    const end = new Date(range.to + "T00:00:00Z");
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
      days.push({ d, v: 0 });
    }
    const idx = new Map(days.map((x, i) => [x.d, i]));
    for (const e of allEvents.filter((x) => x.stage === stage.id)) {
      const i = idx.get(e.occurred_on);
      if (i !== undefined) days[i].v += e.value_count;
    }
    return days;
  }, [allEvents, stage.id, range.to]);

  const sparkMax = Math.max(1, ...spark.map((x) => x.v));
  const sparkW = 320;
  const sparkH = 60;
  const path = spark
    .map((p, i) => {
      const x = (i / (spark.length - 1)) * sparkW;
      const y = sparkH - (p.v / sparkMax) * sparkH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const allStageEntries = useMemo(
    () =>
      [...stageEvents].sort((a, b) =>
        a.occurred_on < b.occurred_on ? 1 : -1,
      ),
    [stageEvents],
  );
  const total = stageEvents.reduce((sum, e) => sum + e.value_count, 0);


  const stageIdx = STAGES.findIndex((s) => s.id === stage.id);
  const prevStage = stageIdx > 0 ? STAGES[stageIdx - 1] : null;
  const prevTotal = prevStage ? currentTotals[prevStage.id] || 0 : 0;
  const convFromPrev = prevStage && prevTotal > 0 ? (total / prevTotal) * 100 : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Fixed top: header + summary cards */}
      <div className="shrink-0 border-b border-glass-border/60 p-6 pb-5">
        <SheetHeader>
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.hex }} />
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Stage detail
            </div>
          </div>
          <SheetTitle className="font-display text-2xl">
            {stage.label}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{stage.blurb}</p>
        </SheetHeader>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <GlassPanel className={`p-4 ${stage.tint}`}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              In period
            </div>
            <div className="mt-1 font-display text-2xl tabular-nums">{total.toLocaleString()}</div>
          </GlassPanel>
          <GlassPanel className="p-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                From {prevStage?.label ?? "—"}
              </span>
              {prevStage && (
                <InfoDot>
                  The percentage of {prevStage.label} that progressed to {stage.label}.
                </InfoDot>
              )}
            </div>
            <div className="mt-1 font-display text-2xl tabular-nums">
              {convFromPrev !== null ? `${convFromPrev.toFixed(1)}%` : "—"}
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* Scrollable body: top sources, trend, then all entries */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-5" data-lenis-prevent>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Top sources
          </div>
          {topSources.length === 0 ? (
            <div className="text-sm text-muted-foreground">No entries in period.</div>
          ) : (
            <div className="space-y-2">
              {topSources.map(([src, v]) => {
                const max = topSources[0][1];
                const pct = (v / max) * 100;
                return (
                  <div key={src} className="flex items-center gap-3 text-sm">
                    <span className="w-24 truncate text-foreground/85">{src}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-black/30">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{ background: stage.hex }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-xs">{v}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            30-day trend
          </div>
          <GlassPanel className="p-3">
            <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="h-16 w-full">
              <defs>
                <linearGradient id={`spark-${stage.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stage.hex} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={stage.hex} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${path} L ${sparkW} ${sparkH} L 0 ${sparkH} Z`}
                fill={`url(#spark-${stage.id})`}
              />
              <path d={path} fill="none" stroke={stage.hex} strokeWidth="1.5" />
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/70">
              <span>{spark[0]?.d}</span>
              <span>{spark[spark.length - 1]?.d}</span>
            </div>
          </GlassPanel>
        </div>

        <StageContacts stage={stage} />



        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              All entries
            </div>
            <div className="text-[10px] tabular-nums text-muted-foreground/70">
              {allStageEntries.length}
            </div>
          </div>
          {allStageEntries.length === 0 ? (
            <div className="text-sm text-muted-foreground">No entries in period.</div>
          ) : (
            <div className="space-y-1.5 text-xs">
              {allStageEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded-lg border border-glass-border/60 bg-glass/30 px-2.5 py-2"
                >
                  <span className="w-20 shrink-0 font-mono text-muted-foreground/80">
                    {e.occurred_on}
                  </span>
                  <span className="truncate text-foreground/90">
                    {e.source ?? "direct"}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {e.channel ? `/ ${e.channel}` : ""}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-foreground/85">
                    +{e.value_count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

}

/* ====================== Stage contacts (drawer section) ====================== */

type StageContact = {
  id: string;
  full_name: string;
  email: string | null;
  company: string | null;
  title: string | null;
  source: string | null;
  last_activity_on: string;
};

function StageContacts({ stage }: { stage: StageDef }) {
  const orgId = useOrgId();
  const [rows, setRows] = useState<StageContact[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    (async () => {
      const { data, error, count } = await supabase
        .from("contacts")
        .select("id, full_name, email, company, title, source, last_activity_on", {
          count: "exact",
        })
        .eq("org_id", orgId)
        .eq("stage", stage.id)
        .order("last_activity_on", { ascending: false })
        .limit(12);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as StageContact[]);
      setTotal(count ?? data?.length ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, stage.id]);

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Contacts in this stage
        </div>
        <Link
          to="/leads"
          search={{ stage: stage.id }}
          className="text-[11px] text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
        >
          View all{total ? ` (${total})` : ""} →
        </Link>
      </div>
      {error ? (
        <div className="text-sm text-rose-300/80">Couldn't load contacts.</div>
      ) : rows === null ? (
        <div className="space-y-1.5">
          <GlassSkeleton className="h-9 w-full" />
          <GlassSkeleton className="h-9 w-full" />
          <GlassSkeleton className="h-9 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No contacts at this stage yet.
        </div>
      ) : (
        <div className="space-y-1.5 text-xs">
          {rows.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-glass-border/60 bg-glass/30 px-2.5 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-semibold text-foreground/80">
                {c.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-foreground/90">{c.full_name}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {[c.title, c.company].filter(Boolean).join(" · ") ||
                    c.email ||
                    "—"}
                </div>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/80">
                {c.last_activity_on}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



/* ====================== Empty state ====================== */

function FilteredEmptyState({
  period,
  channelFilter,
  sourceFilter,
  onReset,
  onLog,
}: {
  period: Period;
  channelFilter: string;
  sourceFilter: string;
  onReset: () => void;
  onLog: () => void;
}) {
  const periodLabel: Record<Period, string> = {
    this_week: "this week",
    this_month: "this month",
    this_quarter: "this quarter",
    all_time: "all time",
  };
  const bits: string[] = [periodLabel[period]];
  if (channelFilter !== "__all__") bits.push(`channel ${channelFilter}`);
  if (sourceFilter !== "__all__") bits.push(`source ${sourceFilter}`);
  return (
    <GlassPanel className="relative overflow-hidden p-10 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 20%, oklch(0.72 0.2 275 / 0.18), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-md">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-xl border border-glass-border bg-glass/40 text-muted-foreground">
          <IconFunnel size={18} />
        </div>
        <h3 className="mt-4 font-display text-lg">
          No funnel events for <span className="font-serif italic">{bits.join(" · ")}</span>
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You have data in other periods. Try widening the period or clearing filters.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-glass-border bg-glass/40 px-3.5 py-2 text-sm transition hover:bg-glass-strong"
          >
            Reset filters
          </button>
          <button
            onClick={onLog}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <IconPlus size={14} /> Log event
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}


/* ====================== Add event modal ====================== */

function AddEventModal({
  onClose,
  orgId,
  userId,
  onAdded,
}: {
  onClose: () => void;
  orgId: string | null;
  userId: string | null;
  onAdded: (e: FunnelEvent) => void;
}) {
  const [stage, setStage] = useState("lead");
  const [source, setSource] = useState("");
  const [channel, setChannel] = useState("");
  const [value, setValue] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!orgId || !userId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("funnel_events")
      .insert({
        org_id: orgId,
        created_by: userId,
        stage,
        source: source || null,
        channel: channel || null,
        value_count: value,
        occurred_on: date,
      })
      .select("id, stage, source, channel, value_count, occurred_on")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not save");
      return;
    }
    onAdded(data as FunnelEvent);
    toast.success("Logged");
    onClose();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-glass-border bg-glass/40 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Pipeline
              </div>
              <h3 className="mt-0.5 font-display text-xl text-foreground">
                Log funnel event
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-glass/40 hover:text-foreground"
            >
              <IconClose size={16} />
            </button>
          </div>

          <div className="mt-5 space-y-5">
            {/* Stage as segmented pills */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                Stage
              </label>
              <div className="mt-2 grid grid-cols-5 gap-1.5 rounded-xl border border-glass-border bg-glass/30 p-1">
                {STAGES.map((s) => {
                  const active = stage === s.id;
                  return (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setStage(s.id)}
                          className={`relative rounded-lg px-2 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${
                            active
                              ? "text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="stage-pill"
                              className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-accent"
                              transition={{ type: "spring", stiffness: 400, damping: 32 }}
                            />
                          )}
                          <span className="relative">{s.label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">
                        {s.blurb}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ModalField
                label="Source"
                value={source}
                onChange={setSource}
                placeholder="google, partner…"
              />
              <ModalField
                label="Channel"
                value={channel}
                onChange={setChannel}
                placeholder="email, paid-social…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                  Count
                </label>
                <div className="mt-1.5 flex items-stretch overflow-hidden rounded-lg border border-glass-border bg-glass/30">
                  <button
                    type="button"
                    onClick={() => setValue((v) => Math.max(1, v - 1))}
                    className="px-3 text-lg text-muted-foreground transition hover:bg-glass/60 hover:text-foreground"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={value}
                    onChange={(e) =>
                      setValue(Math.max(1, parseInt(e.target.value || "1", 10)))
                    }
                    className="w-full border-x border-glass-border bg-transparent px-3 py-2 text-center text-sm tabular-nums text-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setValue((v) => v + 1)}
                    className="px-3 text-lg text-muted-foreground transition hover:bg-glass/60 hover:text-foreground"
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="field-glass mt-1.5 w-full rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={submit}
              disabled={saving}
              className="btn-keystone w-full rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_32px_-8px_oklch(0.72_0.2_275_/_0.45)] transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Log event"}
            </button>
          </div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}

function ModalField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-glass mt-1.5 w-full rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70"
      />
    </div>
  );
}

/* ====================== Weekly cohort vs target ====================== */

type Target = {
  year_month: string;
  mql_target: number;
  sqo_target: number;
  workspace_id: string | null;
};

function isoWeekStart(d: Date) {
  const x = new Date(d);
  const day = x.getUTCDay() || 7;
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1));
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function weekLabel(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function WeeklyCohortPanel({
  events,
  orgId,
}: {
  events: FunnelEvent[];
  orgId: string | null;
}) {
  const [targets, setTargets] = useState<Target[]>([]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("funnel_targets")
        .select("year_month, mql_target, sqo_target, workspace_id")
        .eq("org_id", orgId)
        .is("workspace_id", null);
      setTargets((data as Target[]) ?? []);
    })();
  }, [orgId]);

  const weeks = useMemo(() => {
    const map = new Map<string, { week: Date; mql: number; sqo: number }>();
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const w = isoWeekStart(new Date(now.getTime() - i * 7 * 86400000));
      map.set(weekLabel(w), { week: w, mql: 0, sqo: 0 });
    }
    for (const e of events) {
      const d = new Date(e.occurred_on + "T00:00:00Z");
      const w = isoWeekStart(d);
      const key = weekLabel(w);
      const slot = map.get(key);
      if (!slot) continue;
      if (e.stage === "mql") slot.mql += e.value_count;
      if (e.stage === "sql" || e.stage === "opp") slot.sqo += e.value_count;
    }
    return Array.from(map.values());
  }, [events]);

  const proratedFor = (week: Date) => {
    const ym = `${week.getUTCFullYear()}-${String(week.getUTCMonth() + 1).padStart(2, "0")}`;
    const t = targets.find((x) => x.year_month === ym);
    if (!t) return { mql: 0, sqo: 0 };
    const dim = daysInMonth(week.getUTCFullYear(), week.getUTCMonth() + 1);
    const share = 7 / dim;
    return {
      mql: Math.round(t.mql_target * share),
      sqo: Math.round(t.sqo_target * share),
    };
  };

  const hasTargets = targets.length > 0;

  return (
    <GlassPanel className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-xl">Weekly cohort vs target</h2>
          <p className="text-sm text-muted-foreground">
            Last 8 weeks · MQL + SQO pacing (prorated by days-in-month)
          </p>
        </div>
        <Link
          to="/tools"
          search={{ focus: "funnel-targets" }}
          className="text-xs text-primary hover:opacity-80"
        >
          {hasTargets ? "Edit targets →" : "Set targets →"}
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium">Week of</th>
              <th className="px-2 py-2 text-right font-medium">MQL</th>
              <th className="px-2 py-2 text-right font-medium">MQL target</th>
              <th className="px-2 py-2 text-right font-medium">SQO</th>
              <th className="px-2 py-2 text-right font-medium">SQO target</th>
              <th className="px-2 py-2 text-right font-medium">MQL→SQO</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const t = proratedFor(w.week);
              const conv = w.mql > 0 ? Math.round((w.sqo / w.mql) * 100) : 0;
              const mqlPct = t.mql > 0 ? Math.round((w.mql / t.mql) * 100) : null;
              const sqoPct = t.sqo > 0 ? Math.round((w.sqo / t.sqo) * 100) : null;
              return (
                <tr key={weekLabel(w.week)} className="border-t border-glass-border/40">
                  <td className="px-2 py-2 text-muted-foreground">{weekLabel(w.week)}</td>
                  <td className="px-2 py-2 text-right font-medium">{w.mql}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">
                    {t.mql || "—"}
                    {mqlPct !== null && (
                      <span
                        className={`ml-1.5 text-[10px] ${mqlPct >= 100 ? "text-emerald-400" : "text-amber-400"}`}
                      >
                        {mqlPct}%
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-medium">{w.sqo}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">
                    {t.sqo || "—"}
                    {sqoPct !== null && (
                      <span
                        className={`ml-1.5 text-[10px] ${sqoPct >= 100 ? "text-emerald-400" : "text-amber-400"}`}
                      >
                        {sqoPct}%
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{conv}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassPanel>
  );
}
