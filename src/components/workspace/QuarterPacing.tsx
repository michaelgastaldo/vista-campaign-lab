import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

type Row = { status: string; start_date: string | null; end_date: string | null };

function quarterBounds(d: Date) {
  const q = Math.floor(d.getMonth() / 3);
  const start = new Date(d.getFullYear(), q * 3, 1);
  const end = new Date(d.getFullYear(), q * 3 + 3, 0);
  return { start, end, label: `${d.getFullYear()} Q${q + 1}` };
}

const STATUS_ORDER = ["draft", "planning", "live", "complete"];

// High-contrast, distinct hues. Each status gets its own identity.
const STATUS_COLOR: Record<string, string> = {
  draft: "oklch(0.72 0.02 240)",       // cool gray
  planning: "oklch(0.78 0.16 215)",    // sky blue
  live: "oklch(0.82 0.20 155)",        // emerald
  complete: "oklch(0.78 0.16 195)",    // teal
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  planning: "Planning",
  in_review: "In review",
  scheduled: "Scheduled",
  live: "Live",
  complete: "Complete",
};

export function QuarterPacing({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const { start, end, label } = useMemo(() => quarterBounds(new Date()), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("status,start_date,end_date")
        .eq("org_id", orgId)
        .or(
          `and(start_date.lte.${end.toISOString().slice(0, 10)},end_date.gte.${start.toISOString().slice(0, 10)}),start_date.is.null`,
        );
      if (!cancelled) setRows((data as Row[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, start, end]);

  const data = useMemo(() => {
    const buckets: Record<string, number> = {};
    STATUS_ORDER.forEach((s) => (buckets[s] = 0));
    (rows ?? []).forEach((r) => {
      if (buckets[r.status] !== undefined) buckets[r.status] += 1;
    });
    return STATUS_ORDER.map((s) => ({
      status: s,
      label: STATUS_LABEL[s],
      count: buckets[s],
      fill: STATUS_COLOR[s],
    }));
  }, [rows]);

  const total = data.reduce((s, d) => s + d.count, 0);
  const elapsedPct = Math.max(
    0,
    Math.min(100, ((Date.now() - start.getTime()) / (end.getTime() - start.getTime())) * 100),
  );
  const completeCount = data.find((d) => d.status === "complete")?.count ?? 0;
  const completePct = total > 0 ? (completeCount / total) * 100 : 0;
  const yMax = Math.max(4, ...data.map((d) => d.count));

  return (
    <GlassPanel className="p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Quarter pacing
          </div>
          <div className="mt-1 font-display text-2xl">{label}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl tabular-nums text-foreground">
            {total}
            <span className="ml-1.5 text-xs font-normal uppercase tracking-wider text-muted-foreground">
              in flight
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground tabular-nums">
            <span className="text-foreground">{total > 0 ? `${completePct.toFixed(0)}%` : "—"}</span> done ·{" "}
            <span className="text-foreground">{elapsedPct.toFixed(0)}%</span> time elapsed
          </div>
        </div>
      </div>

      {/* Dual-track progress: time elapsed vs work complete */}
      <div className="mt-5 space-y-2">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_275)] via-[oklch(0.78_0.18_305)] to-[oklch(0.78_0.18_340)] transition-all"
            style={{ width: `${completePct}%` }}
          />
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-all"
            style={{ width: `${elapsedPct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-3 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_275)] to-[oklch(0.78_0.18_340)]" />
            Complete
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-3 rounded-full bg-white/30" />
            Time elapsed
          </span>
        </div>
      </div>

      {total === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-glass-border py-10 text-center text-sm text-muted-foreground">
          No campaigns scheduled this quarter yet.
        </div>
      ) : (
        <div className="mt-6 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 18, right: 8, bottom: 0, left: -24 }}
              barCategoryGap="22%"
            >
              <defs>
                {data.map((d) => (
                  <linearGradient
                    key={d.status}
                    id={`bar-${d.status}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="oklch(0.78 0.18 340)" stopOpacity={1} />
                    <stop offset="55%" stopColor="oklch(0.78 0.18 305)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="oklch(0.72 0.2 275)" stopOpacity={0.85} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "oklch(0.82 0.01 240)" }}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, yMax]}
                tick={{ fontSize: 10, fill: "oklch(0.6 0.01 240)" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)", radius: 8 }}
                contentStyle={{
                  background: "oklch(0.16 0.01 240 / 0.96)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  fontSize: 12,
                  padding: "8px 10px",
                  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)",
                }}
                labelStyle={{ color: "oklch(0.95 0 0)", fontWeight: 500, marginBottom: 2 }}
                itemStyle={{ color: "oklch(0.85 0.01 240)" }}
                formatter={(value: number) => [`${value} campaign${value === 1 ? "" : "s"}`, ""]}
                separator=""
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {data.map((d) => (
                  <Cell key={d.status} fill={`url(#bar-${d.status})`} stroke="oklch(0.78 0.18 305)" strokeOpacity={0.4} />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  fill="oklch(0.95 0 0)"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(v: number) => (v > 0 ? v : "")}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassPanel>
  );
}
