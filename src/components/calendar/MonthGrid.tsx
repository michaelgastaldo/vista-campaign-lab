import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { colorForCampaign } from "@/lib/calendar-colors";
import { IconArrowRight } from "@/components/ui-custom/CustomIcon";

export type CalCampaign = {
  id: string;
  name: string;
  status: string;
  channel: string | null;
  campaign_type?: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type CalItem = {
  id: string;
  workspace_id: string;
  title: string;
  due_at: string; // ISO
  done: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_LANES = 3; // visible campaign rows per cell before overflow
const MAX_DAY_ITEMS = 2; // visible post chips per day before overflow

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function displayName(n: string | null | undefined) {
  const t = (n ?? "").trim();
  if (!t || t === "Untitled workspace" || t === "Untitled campaign") return "Untitled campaign";
  return t;
}

type Lane = { col: number; span: number; campaign: CalCampaign }[];

type WeekLayout = {
  weekStart: Date;
  days: Date[];
  lanes: Lane[];
  // For each day col (0..6): bars hidden because of MAX_LANES cap
  overflowByCol: number[];
};

/**
 * Greedy lane-pack campaigns intersecting a 7-day window.
 * Returns rows of non-overlapping bar segments.
 */
function packWeek(weekStart: Date, campaigns: CalCampaign[]): WeekLayout {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekEnd = days[6];

  // Compute each campaign's intersection with this week
  const segments = campaigns
    .map((c) => {
      if (!c.start_date) return null;
      const s = parseYmd(c.start_date);
      const e = c.end_date ? parseYmd(c.end_date) : s;
      if (e < weekStart || s > weekEnd) return null;
      const segStart = s < weekStart ? weekStart : s;
      const segEnd = e > weekEnd ? weekEnd : e;
      const col = diffDays(weekStart, segStart);
      const span = diffDays(segStart, segEnd) + 1;
      return { campaign: c, col, span, originalStart: s };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    // Sort by original start, then longer first — stabilizes lane assignment across weeks
    .sort(
      (a, b) =>
        a.originalStart.getTime() - b.originalStart.getTime() ||
        b.span - a.span ||
        a.campaign.id.localeCompare(b.campaign.id),
    );

  const lanes: Lane[] = [];
  const overflowByCol = [0, 0, 0, 0, 0, 0, 0];

  for (const seg of segments) {
    let placed = false;
    for (const lane of lanes) {
      const conflict = lane.some((l) => seg.col < l.col + l.span && l.col < seg.col + seg.span);
      if (!conflict) {
        lane.push({ col: seg.col, span: seg.span, campaign: seg.campaign });
        placed = true;
        break;
      }
    }
    if (!placed) {
      if (lanes.length < MAX_LANES) {
        lanes.push([{ col: seg.col, span: seg.span, campaign: seg.campaign }]);
      } else {
        // Mark overflow on each day it would have touched
        for (let i = 0; i < seg.span; i++) overflowByCol[seg.col + i]++;
      }
    }
  }

  return { weekStart, days, lanes, overflowByCol };
}

type Props = {
  cursor: Date; // first of month
  campaigns: CalCampaign[];
  items: CalItem[];
  campaignById: Map<string, CalCampaign>;
};

export function MonthGrid({ cursor, campaigns, items, campaignById }: Props) {
  const today = new Date();
  const [hoverCampaign, setHoverCampaign] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const first = startOfMonth(cursor);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 6 }, (_, w) => {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + w * 7);
      return packWeek(weekStart, campaigns);
    });
  }, [cursor, campaigns]);

  // Index items by ymd for quick lookup
  const itemsByDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const it of items) {
      const key = ymd(new Date(it.due_at));
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    return m;
  }, [items]);

  return (
    <div onMouseLeave={() => setHoverCampaign(null)}>
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-glass-border bg-background/20">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="grid auto-rows-fr">
        {weeks.map((wk, wi) => (
          <WeekRow
            key={wi}
            week={wk}
            cursor={cursor}
            today={today}
            itemsByDay={itemsByDay}
            campaignById={campaignById}
            hoverCampaign={hoverCampaign}
            setHoverCampaign={setHoverCampaign}
            isLast={wi === weeks.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function WeekRow({
  week,
  cursor,
  today,
  itemsByDay,
  campaignById,
  hoverCampaign,
  setHoverCampaign,
  isLast,
}: {
  week: WeekLayout;
  cursor: Date;
  today: Date;
  itemsByDay: Map<string, CalItem[]>;
  campaignById: Map<string, CalCampaign>;
  hoverCampaign: string | null;
  setHoverCampaign: (id: string | null) => void;
  isLast: boolean;
}) {
  // Per-day items, plus per-day list of campaign IDs intersecting that day (for "+N more" popovers)
  const dayCampaignIds: string[][] = useMemo(() => {
    const out: string[][] = [[], [], [], [], [], [], []];
    // collect across all lanes + overflowed (need access to all, recompute from campaigns)
    // Easiest: walk lanes
    for (const lane of week.lanes) {
      for (const seg of lane) {
        for (let i = 0; i < seg.span; i++) {
          out[seg.col + i].push(seg.campaign.id);
        }
      }
    }
    return out;
  }, [week]);

  const laneHeight = 22; // px
  const laneGap = 3;
  const laneAreaHeight = MAX_LANES * laneHeight + (MAX_LANES - 1) * laneGap;

  return (
    <div
      className={cn(
        "relative grid grid-cols-7",
        !isLast && "border-b border-glass-border",
      )}
      style={{ minHeight: 140 }}
    >
      {/* Day cells (background, date numbers, post chips, overflow trigger) */}
      {week.days.map((d, col) => {
        const inMonth = d.getMonth() === cursor.getMonth();
        const isToday = sameDay(d, today);
        const key = ymd(d);
        const items = itemsByDay.get(key) ?? [];
        const overflow = week.overflowByCol[col];
        const visibleItems = items.slice(0, MAX_DAY_ITEMS);
        const hiddenItems = items.length - visibleItems.length;
        const totalHidden = overflow + (hiddenItems > 0 ? hiddenItems : 0);

        return (
          <div
            key={col}
            className={cn(
              "relative flex flex-col border-r border-glass-border p-1.5 transition",
              col === 6 && "border-r-0",
              !inMonth && "bg-background/10",
            )}
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs",
                  isToday
                    ? "bg-primary text-primary-foreground font-semibold"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50",
                )}
              >
                {d.getDate()}
              </span>
              {totalHidden > 0 && (
                <DayOverflowPopover
                  date={d}
                  campaignIdsInDay={[
                    ...dayCampaignIds[col],
                    // overflowed ones aren't in lanes, but the popover recomputes from passed-in items below
                  ]}
                  items={items}
                  campaignById={campaignById}
                  overflowCount={totalHidden}
                />
              )}
            </div>

            {/* Reserve vertical space so bars overlay below the date row */}
            <div style={{ height: laneAreaHeight }} aria-hidden />

            {/* Post chips below the lane area */}
            {visibleItems.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {visibleItems.map((it) => {
                  const parent = campaignById.get(it.workspace_id);
                  const color = parent ? colorForCampaign(parent.id) : null;
                  return (
                    <Link
                      key={it.id}
                      to="/campaigns/$id"
                      params={{ id: it.workspace_id }}
                      className={cn(
                        "flex items-center gap-1.5 truncate rounded px-1 py-0.5 text-[10px] transition hover:bg-muted/40",
                        it.done && "opacity-50 line-through",
                      )}
                      title={`${it.title}${parent ? ` · ${displayName(parent.name)}` : ""}`}
                    >
                      <span
                        className="inline-block size-1.5 shrink-0 rounded-full"
                        style={{ background: color?.dot ?? "currentColor" }}
                      />
                      <span className="truncate text-foreground/80">{it.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Bar layer — absolutely positioned across the 7-col grid */}
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: 32, // below date number row
          height: laneAreaHeight,
        }}
      >
        {week.lanes.map((lane, li) =>
          lane.map((seg) => {
            const color = colorForCampaign(seg.campaign.id);
            const startPct = (seg.col / 7) * 100;
            const widthPct = (seg.span / 7) * 100;
            const isStart = seg.col === 0 || isBarStart(seg, week.weekStart);
            const isEnd = isBarEnd(seg, week.weekStart);
            const dimmed = hoverCampaign && hoverCampaign !== seg.campaign.id;
            return (
              <Link
                key={`${seg.campaign.id}-${li}-${seg.col}`}
                to="/campaigns/$id"
                params={{ id: seg.campaign.id }}
                onMouseEnter={() => setHoverCampaign(seg.campaign.id)}
                onMouseLeave={() => setHoverCampaign(null)}
                className={cn(
                  "pointer-events-auto absolute flex items-center gap-1.5 overflow-hidden px-2 text-[11px] font-medium transition-all",
                  "hover:z-10 hover:brightness-110",
                  isStart && "rounded-l-md",
                  isEnd && "rounded-r-md",
                  dimmed && "opacity-25",
                )}
                style={{
                  left: `calc(${startPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                  top: li * (laneHeight + laneGap),
                  height: laneHeight,
                  background: color.bar,
                  color: "white",
                  borderLeft: isStart ? `3px solid ${color.edge}` : undefined,
                  boxShadow:
                    hoverCampaign === seg.campaign.id
                      ? `0 0 0 1px ${color.edge}, 0 8px 24px -8px ${color.edge}`
                      : undefined,
                }}
                title={`${displayName(seg.campaign.name)}${seg.campaign.channel ? ` · ${seg.campaign.channel}` : ""}`}
              >
                {isStart && (
                  <span className="truncate">{displayName(seg.campaign.name)}</span>
                )}
                {isEnd && !isStart && (
                  <span className="ml-auto truncate opacity-80">
                    {displayName(seg.campaign.name)}
                  </span>
                )}
              </Link>
            );
          }),
        )}
      </div>
    </div>
  );
}

function isBarStart(
  seg: { col: number; span: number; campaign: CalCampaign },
  weekStart: Date,
) {
  if (!seg.campaign.start_date) return true;
  const s = parseYmd(seg.campaign.start_date);
  const segDate = new Date(weekStart);
  segDate.setDate(weekStart.getDate() + seg.col);
  return sameDay(s, segDate);
}
function isBarEnd(
  seg: { col: number; span: number; campaign: CalCampaign },
  weekStart: Date,
) {
  if (!seg.campaign.end_date) return true;
  const e = parseYmd(seg.campaign.end_date);
  const segDate = new Date(weekStart);
  segDate.setDate(weekStart.getDate() + seg.col + seg.span - 1);
  return sameDay(e, segDate);
}

function DayOverflowPopover({
  date,
  campaignIdsInDay,
  items,
  campaignById,
  overflowCount,
}: {
  date: Date;
  campaignIdsInDay: string[];
  items: CalItem[];
  campaignById: Map<string, CalCampaign>;
  overflowCount: number;
}) {
  // Show every campaign intersecting this day (compute from campaignById + start/end)
  const dayCampaigns = useMemo(() => {
    const set = new Set(campaignIdsInDay);
    // also walk all campaigns to include the overflowed ones
    for (const c of campaignById.values()) {
      if (!c.start_date) continue;
      const s = parseYmd(c.start_date);
      const e = c.end_date ? parseYmd(c.end_date) : s;
      if (date >= s && date <= e) set.add(c.id);
    }
    return Array.from(set)
      .map((id) => campaignById.get(id))
      .filter((c): c is CalCampaign => !!c);
  }, [date, campaignIdsInDay, campaignById]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="rounded-full bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-primary/15 hover:text-primary">
          +{overflowCount}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 border-glass-border bg-popover/95 p-3 backdrop-blur-xl"
      >
        <div className="mb-2 font-display text-sm">
          {date.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </div>
        {dayCampaigns.length > 0 && (
          <div className="mb-3 space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Campaigns
            </div>
            {dayCampaigns.map((c) => {
              const color = colorForCampaign(c.id);
              return (
                <Link
                  key={c.id}
                  to="/campaigns/$id"
                  params={{ id: c.id }}
                  className="group flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs transition hover:bg-muted/40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ background: color.edge }}
                    />
                    <span className="truncate">{displayName(c.name)}</span>
                  </span>
                  <IconArrowRight
                    size={12}
                    className="text-muted-foreground transition group-hover:translate-x-0.5"
                  />
                </Link>
              );
            })}
          </div>
        )}
        {items.length > 0 && (
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Posts &amp; tasks
            </div>
            {items.map((it) => {
              const parent = campaignById.get(it.workspace_id);
              const color = parent ? colorForCampaign(parent.id) : null;
              return (
                <Link
                  key={it.id}
                  to="/campaigns/$id"
                  params={{ id: it.workspace_id }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition hover:bg-muted/40",
                    it.done && "opacity-50 line-through",
                  )}
                >
                  <span
                    className="inline-block size-1.5 shrink-0 rounded-full"
                    style={{ background: color?.dot ?? "currentColor" }}
                  />
                  <span className="truncate">{it.title}</span>
                </Link>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// expose for parent (kept here to colocate)
export { ymd as _ymd };
