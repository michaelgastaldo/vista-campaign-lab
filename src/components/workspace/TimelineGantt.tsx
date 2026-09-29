import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  status: string;
  channel: string | null;
  start_date: string | null;
  end_date: string | null;
};

const STATUS_BAR: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  planning: "bg-accent/70",
  in_review: "bg-amber-500/70",
  scheduled: "bg-blue-500/70",
  live: "bg-primary/80",
  complete: "bg-secondary/80",
  archived: "bg-muted-foreground/20",
};

function dayDiff(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(s: string, n: number) {
  const d = new Date(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

type DragState = {
  id: string;
  mode: "move" | "resize-start" | "resize-end";
  startX: number;
  origStart: string;
  origEnd: string;
  pxPerDay: number;
  deltaDays: number;
};

export function TimelineGantt({ items }: { items: Item[] }) {
  const nav = useNavigate();
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, { start_date: string; end_date: string }>
  >({});

  const merged = useMemo(
    () =>
      items.map((w) => {
        const o = overrides[w.id];
        return o ? { ...w, start_date: o.start_date, end_date: o.end_date } : w;
      }),
    [items, overrides],
  );
  const dated = merged.filter((w) => w.start_date && w.end_date);

  const { rangeStart, totalDays, weeks } = useMemo(() => {
    if (dated.length === 0) {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { rangeStart: start, totalDays: 60, weeks: [] as Date[] };
    }
    const dates = dated.flatMap((w) => [new Date(w.start_date!), new Date(w.end_date!)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 7);
    const total = Math.max(28, dayDiff(min, max));
    const weeks: Date[] = [];
    const w = new Date(min);
    w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
    while (dayDiff(min, w) <= total) {
      weeks.push(new Date(w));
      w.setDate(w.getDate() + 7);
    }
    return { rangeStart: min, totalDays: total, weeks };
  }, [dated]);

  const lanes = useMemo(() => {
    const byChannel = new Map<string, Item[]>();
    merged.forEach((w) => {
      const k = w.channel ?? "unscheduled";
      if (!byChannel.has(k)) byChannel.set(k, []);
      byChannel.get(k)!.push(w);
    });
    return Array.from(byChannel.entries());
  }, [merged]);

  // Mouse handlers for drag/resize
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - drag.startX;
      const dd = Math.round(dx / drag.pxPerDay);
      if (dd === drag.deltaDays) return;
      setDrag({ ...drag, deltaDays: dd });
      setOverrides((cur) => {
        let s = drag.origStart;
        let en = drag.origEnd;
        if (drag.mode === "move") {
          s = addDays(drag.origStart, dd);
          en = addDays(drag.origEnd, dd);
        } else if (drag.mode === "resize-start") {
          const next = addDays(drag.origStart, dd);
          if (next <= drag.origEnd) s = next;
        } else {
          const next = addDays(drag.origEnd, dd);
          if (next >= drag.origStart) en = next;
        }
        return { ...cur, [drag.id]: { start_date: s, end_date: en } };
      });
    };
    const onUp = async () => {
      const final = overrides[drag.id];
      const id = drag.id;
      const moved = drag.deltaDays !== 0 && final;
      setDrag(null);
      if (!moved) return;
      const { error } = await supabase
        .from("workspaces")
        .update({ start_date: final.start_date, end_date: final.end_date })
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        setOverrides((cur) => {
          const next = { ...cur };
          delete next[id];
          return next;
        });
      } else {
        toast.success("Rescheduled");
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, overrides]);

  const startDrag = (
    e: React.MouseEvent,
    w: Item,
    mode: DragState["mode"],
  ) => {
    if (!w.start_date || !w.end_date) return;
    e.preventDefault();
    e.stopPropagation();
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement | null;
    const laneWidth = lane?.getBoundingClientRect().width ?? 1;
    const pxPerDay = laneWidth / totalDays;
    setDrag({
      id: w.id,
      mode,
      startX: e.clientX,
      origStart: w.start_date,
      origEnd: w.end_date,
      pxPerDay,
      deltaDays: 0,
    });
  };

  if (items.length === 0) {
    return (
      <GlassPanel className="p-10 text-center text-sm text-muted-foreground">
        No workspaces yet.
      </GlassPanel>
    );
  }

  const today = new Date();
  const todayLeft = (dayDiff(rangeStart, today) / totalDays) * 100;

  return (
    <GlassPanel className="overflow-hidden p-0">
      <div className="border-b border-glass-border bg-background/30 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        Drag a bar to reschedule · drag the edges to resize
      </div>
      <div className="relative overflow-x-auto" ref={trackRef}>
        <div className="min-w-[800px]">
          <div className="relative h-8 border-b border-glass-border bg-background/30">
            <div className="w-32 shrink-0" />
            {weeks.map((w, i) => {
              const left = (dayDiff(rangeStart, w) / totalDays) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-glass-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  style={{ left: `calc(8rem + ${left}% * (100% - 8rem) / 100%)` }}
                >
                  {w.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              );
            })}
          </div>

          <div className="relative">
            {lanes.map(([channel, ws]) => (
              <div key={channel} className="border-b border-glass-border last:border-0">
                <div className="flex">
                  <div className="w-32 shrink-0 border-r border-glass-border bg-background/20 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {channel}
                  </div>
                  <div data-lane className="relative min-h-[56px] flex-1">
                    {todayLeft >= 0 && todayLeft <= 100 && (
                      <div
                        className="pointer-events-none absolute top-0 z-10 h-full w-px bg-primary/60"
                        style={{ left: `${todayLeft}%` }}
                      />
                    )}
                    {ws.map((w, idx) => {
                      if (!w.start_date || !w.end_date) {
                        return (
                          <div
                            key={w.id}
                            className="absolute left-2 right-2 truncate rounded border border-dashed border-glass-border px-2 py-1 text-[11px] italic text-muted-foreground"
                            style={{ top: `${idx * 28 + 6}px` }}
                          >
                            {w.name} (no dates)
                          </div>
                        );
                      }
                      const start = new Date(w.start_date);
                      const end = new Date(w.end_date);
                      const left = (dayDiff(rangeStart, start) / totalDays) * 100;
                      const width = Math.max(2, (dayDiff(start, end) / totalDays) * 100);
                      const isDragging = drag?.id === w.id;
                      return (
                        <div
                          key={w.id}
                          className={cn(
                            "group absolute h-6 cursor-grab select-none truncate rounded text-[11px] text-foreground transition active:cursor-grabbing",
                            STATUS_BAR[w.status] ?? STATUS_BAR.draft,
                            isDragging ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md",
                          )}
                          style={{ left: `${left}%`, width: `${width}%`, top: `${idx * 28 + 6}px` }}
                          title={`${w.name} · ${w.start_date} → ${w.end_date}`}
                          onMouseDown={(e) => startDrag(e, w, "move")}
                          onClick={(e) => {
                            if (drag) return;
                            if (e.detail === 2) nav({ to: "/campaigns/$id", params: { id: w.id } });
                          }}
                          onDoubleClick={() => nav({ to: "/campaigns/$id", params: { id: w.id } })}
                        >
                          <div
                            className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-foreground/20 opacity-0 group-hover:opacity-100"
                            onMouseDown={(e) => startDrag(e, w, "resize-start")}
                          />
                          <div className="truncate px-2 py-0.5">{w.name}</div>
                          <div
                            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-foreground/20 opacity-0 group-hover:opacity-100"
                            onMouseDown={(e) => startDrag(e, w, "resize-end")}
                          />
                        </div>
                      );
                    })}
                    <div style={{ height: `${ws.length * 28 + 12}px` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
