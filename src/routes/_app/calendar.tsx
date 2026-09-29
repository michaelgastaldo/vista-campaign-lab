import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import {
  IconCalendar,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { PanelError } from "@/components/ui-custom/PanelError";
import { cn } from "@/lib/utils";
import { TimelineGantt } from "@/components/workspace/TimelineGantt";
import { MonthGrid, type CalCampaign, type CalItem } from "@/components/calendar/MonthGrid";
import {
  CalendarFilters,
  EMPTY_FILTERS,
  type CalendarFilterValue,
} from "@/components/calendar/CalendarFilters";
import { colorForCampaign } from "@/lib/calendar-colors";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

type Ws = CalCampaign & { updated_at: string };

const calendarCampaignCache = new Map<string, Ws[]>();
const calendarOverlayCache = new Map<string, CalItem[]>();

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  planning: "bg-accent",
  live: "bg-primary",
  complete: "bg-secondary",
  archived: "bg-muted-foreground/20",
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function displayName(n: string | null | undefined) {
  const t = (n ?? "").trim();
  if (!t || t === "Untitled workspace" || t === "Untitled campaign") return "Untitled campaign";
  return t;
}

function CalendarPage() {
  const orgId = useOrgId();
  const [items, setItems] = useState<Ws[] | null>(null);
  const [checklistItems, setChecklistItems] = useState<CalItem[] | null>(null);
  const [view, setView] = useState<"month" | "list" | "timeline">(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      return "list";
    }
    return "month";
  });
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [filters, setFilters] = useState<CalendarFilterValue>(EMPTY_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Keyboard nav: ← / → for prev / next month when in month view
  useEffect(() => {
    if (view !== "month") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "ArrowLeft") setCursor((c) => addMonths(c, -1));
      else if (e.key === "ArrowRight") setCursor((c) => addMonths(c, 1));
      else if (e.key.toLowerCase() === "t") setCursor(startOfMonth(new Date()));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  useEffect(() => {
    if (!orgId) return;
    const cacheKey = `calendar:campaigns:${orgId}`;
    const cached = calendarCampaignCache.get(cacheKey);
    if (cached) setItems(cached);
    setError(null);
    let cancelled = false;
    (async () => {
      const res = await supabase
        .from("workspaces")
        .select(
          "id,name,status,channel,campaign_type,start_date,end_date,updated_at",
        )
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (res.error) {
        console.error("[Calendar] failed to load workspaces:", res.error);
        setError(res.error.message ?? "Failed to load");
        return;
      }
      const next = (res.data as Ws[]) ?? [];
      calendarCampaignCache.set(cacheKey, next);
      setItems(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, reloadKey]);

  // Load checklist items + campaign requests with due dates in a wide window around the cursor
  useEffect(() => {
    if (!orgId) return;
    const overlayKey = `calendar:overlays:${orgId}:${cursor.toISOString().slice(0, 7)}`;
    const cached = calendarOverlayCache.get(overlayKey);
    if (cached) setChecklistItems(cached);
    let cancelled = false;
    const start = new Date(cursor);
    start.setMonth(start.getMonth() - 1);
    const end = new Date(cursor);
    end.setMonth(end.getMonth() + 2);
    (async () => {
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const startYmd = startIso.slice(0, 10);
      const endYmd = endIso.slice(0, 10);

      const [checklistRes, requestsRes, listsRes] = await Promise.all([
        supabase
          .from("checklist_items")
          .select("id,workspace_id,title,due_at,done")
          .eq("org_id", orgId)
          .not("due_at", "is", null)
          .gte("due_at", startIso)
          .lt("due_at", endIso)
          .order("due_at", { ascending: true }),
        supabase
          .from("campaign_requests")
          .select("id,workspace_id,brief,desired_due_date,status,requestor_name,requestor_email")
          .eq("org_id", orgId)
          .not("desired_due_date", "is", null)
          .gte("desired_due_date", startYmd)
          .lt("desired_due_date", endYmd)
          .order("desired_due_date", { ascending: true }),
        supabase
          .from("imported_lists")
          .select("id,workspace_id,source_label,event_date,row_count")
          .eq("org_id", orgId)
          .not("event_date", "is", null)
          .gte("event_date", startYmd)
          .lt("event_date", endYmd)
          .order("event_date", { ascending: true }),
      ]);

      if (cancelled) return;
      const overlayErr =
        checklistRes.error || requestsRes.error || listsRes.error;
      if (overlayErr) {
        console.error("[Calendar] failed to load overlay items:", overlayErr);
        // Items list (campaigns) is still useful — don't blank the page; just skip overlays.
        setChecklistItems([]);
        return;
      }



      const reqItems: CalItem[] = ((requestsRes.data ?? []) as Array<{
        id: string;
        workspace_id: string | null;
        brief: string | null;
        desired_due_date: string;
        status: string;
        requestor_name: string | null;
        requestor_email: string | null;
      }>).map((r) => {
        const who = r.requestor_name?.trim() || r.requestor_email || "Request";
        const briefSnip = (r.brief ?? "").trim().split(/\s+/).slice(0, 6).join(" ");
        return {
          id: `req-${r.id}`,
          workspace_id: r.workspace_id ?? "",
          title: `Request · ${who}${briefSnip ? ` — ${briefSnip}` : ""}`,
          due_at: `${r.desired_due_date}T12:00:00.000Z`,
          done: r.status === "converted" || r.status === "declined",
        } satisfies CalItem;
      });

      const listItems: CalItem[] = ((listsRes.data ?? []) as Array<{
        id: string;
        workspace_id: string | null;
        source_label: string;
        event_date: string;
        row_count: number;
      }>).map((l) => ({
        id: `list-${l.id}`,
        workspace_id: l.workspace_id ?? "",
        title: `Event · ${l.source_label}${l.row_count ? ` (${l.row_count})` : ""}`,
        due_at: `${l.event_date}T12:00:00.000Z`,
        done: false,
      }));

      const next = [
        ...(((checklistRes.data as CalItem[]) ?? [])),
        ...reqItems,
        ...listItems,
      ];
      calendarOverlayCache.set(overlayKey, next);
      setChecklistItems(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, cursor, reloadKey]);

  const availableChannels = useMemo(
    () => Array.from(new Set((items ?? []).map((w) => w.channel).filter(Boolean))) as string[],
    [items],
  );
  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set((items ?? []).map((w) => w.campaign_type ?? "other")),
      ),
    [items],
  );

  const filteredCampaigns = useMemo(() => {
    if (!items) return [];
    const q = filters.search.trim().toLowerCase();
    return items.filter((w) => {
      if (!filters.showCampaigns) return false;
      if (!w.start_date) return false;
      if (filters.statuses.length && !filters.statuses.includes(w.status)) return false;
      if (filters.channels.length && (!w.channel || !filters.channels.includes(w.channel))) return false;
      if (filters.types.length && !filters.types.includes(w.campaign_type ?? "other")) return false;
      if (q && !displayName(w.name).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filters]);

  const campaignById = useMemo(() => {
    const m = new Map<string, CalCampaign>();
    for (const c of items ?? []) m.set(c.id, c);
    return m;
  }, [items]);

  const visibleItems = useMemo(() => {
    if (!filters.showPosts) return [];
    const q = filters.search.trim().toLowerCase();
    const visibleCampaignIds = new Set(filteredCampaigns.map((c) => c.id));
    return (checklistItems ?? []).filter((it) => {
      // If any campaign filters are active, restrict posts to campaigns that pass them
      const anyCampaignFilter =
        filters.statuses.length > 0 ||
        filters.channels.length > 0 ||
        filters.types.length > 0;
      if (anyCampaignFilter && !visibleCampaignIds.has(it.workspace_id)) return false;
      if (q && !it.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [checklistItems, filters, filteredCampaigns]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <PageHexBadge hue={200} size={26} icon={<IconCalendar size={22} />} aria-label="Calendar" />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Calendar</div>
            <h1 className="mt-1 font-display text-4xl tracking-tight">When everything ships</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Campaigns span their full date range. Posts &amp; tasks dot the days they're due.
              Color stays with the campaign across views.
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-glass-border bg-background/40 p-0.5 text-xs shrink-0">
          {(["month", "list", "timeline"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1.5 capitalize transition",
                view === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <PanelError onRetry={() => setReloadKey((k) => k + 1)} />
      ) : items === null ? (
        <GlassSkeleton rows={6} />
      ) : items.length === 0 ? (
        <GlassPanel tier="strong" className="flex flex-col items-center gap-4 p-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <IconCalendar size={24} />
          </span>
          <h2 className="font-display text-2xl">Your calendar is waiting</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Once you create a campaign with a start and end date, it'll span the days here — with posts and tasks dotting their due days.
          </p>
          <Link
            to="/campaigns"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Create your first campaign <IconArrowRight size={14} />
          </Link>
        </GlassPanel>
      ) : (
        <>
          <CalendarFilters
            value={filters}
            onChange={setFilters}
            availableChannels={availableChannels}
            availableTypes={availableTypes}
            totalVisible={filteredCampaigns.length + visibleItems.length}
            totalAll={items.length + (checklistItems?.length ?? 0)}
          />

          {view === "timeline" ? (
            <TimelineGantt items={filteredCampaigns as never} />
          ) : view === "month" ? (
            <GlassPanel className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-glass-border px-5 py-3">
                <div className="font-display text-xl">{monthLabel}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCursor(startOfMonth(new Date()))}
                    className="rounded-md px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setCursor(addMonths(cursor, -1))}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                    aria-label="Previous month"
                  >
                    <IconChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCursor(addMonths(cursor, 1))}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                    aria-label="Next month"
                  >
                    <IconChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <MonthGrid
                    cursor={cursor}
                    campaigns={filteredCampaigns}
                    items={visibleItems}
                    campaignById={campaignById}
                  />
                </div>
              </div>

              {/* Color legend — first 6 visible campaigns */}
              {filteredCampaigns.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-glass-border bg-background/20 px-5 py-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Legend
                  </span>
                  {filteredCampaigns.slice(0, 8).map((c) => {
                    const color = colorForCampaign(c.id);
                    return (
                      <Link
                        key={c.id}
                        to="/campaigns/$id"
                        params={{ id: c.id }}
                        className="group flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ background: color.edge }}
                        />
                        <span className="truncate max-w-[160px]">{displayName(c.name)}</span>
                      </Link>
                    );
                  })}
                  {filteredCampaigns.length > 8 && (
                    <span className="text-xs text-muted-foreground">
                      +{filteredCampaigns.length - 8} more
                    </span>
                  )}
                </div>
              )}
            </GlassPanel>
          ) : filteredCampaigns.length === 0 ? (
            <GlassPanel className="p-10 text-center text-sm text-muted-foreground">
              No campaigns match.{" "}
              <Link to="/campaigns" className="text-primary underline-offset-4 hover:underline">
                Create one
              </Link>{" "}
              to populate the calendar.
            </GlassPanel>
          ) : (
            <ListView items={filteredCampaigns as Ws[]} />
          )}
        </>
      )}
    </div>
  );
}

function ListView({ items }: { items: Ws[] }) {
  const byWeek = useMemo(() => {
    const groups = new Map<string, Ws[]>();
    items.forEach((w) => {
      const ref = w.start_date ? new Date(w.start_date) : new Date(w.updated_at);
      const monday = new Date(ref);
      monday.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(w);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [items]);

  return (
    <div className="space-y-4">
      {byWeek.map(([week, ws]) => (
        <GlassPanel key={week} className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Week of{" "}
              {new Date(week).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
            <span className="text-xs text-muted-foreground">
              {ws.length} campaign{ws.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="divide-y divide-glass-border">
            {ws.map((w) => {
              const color = colorForCampaign(w.id);
              return (
                <Link
                  key={w.id}
                  to="/campaigns/$id"
                  params={{ id: w.id }}
                  className="group flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ background: color.edge }}
                    />
                    <span className="truncate">{displayName(w.name)}</span>
                    {w.channel && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {w.channel}
                      </span>
                    )}
                    <span
                      className={`inline-block size-1.5 rounded-full ${STATUS_DOT[w.status] ?? STATUS_DOT.draft}`}
                    />
                  </span>
                  <IconArrowRight
                    size={14}
                    className="text-muted-foreground transition group-hover:translate-x-1"
                  />
                </Link>
              );
            })}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
