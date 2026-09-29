import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconCalendar, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { PanelSkeleton } from "@/components/ui-custom/TabSkeleton";
import { PanelError } from "@/components/ui-custom/PanelError";

type Row =
  | {
      kind: "workspace";
      key: string;
      sortDate: string;
      workspaceId: string;
      workspaceName: string;
      tone: "starts" | "ends" | "active";
      label: string;
      sublabel: string;
    }
  | {
      kind: "due";
      key: string;
      sortDate: string;
      workspaceId: string;
      workspaceName: string;
      tone: "due";
      label: string;
      sublabel: string;
    };

const TONE = {
  starts: { text: "text-[oklch(0.82_0.20_155)]", label: "Starts" },
  ends: { text: "text-[oklch(0.78_0.18_25)]", label: "Ends" },
  active: { text: "text-primary", label: "Runs" },
  due: { text: "text-[oklch(0.82_0.17_75)]", label: "Due" },
} as const;

export function ThisWeekPanel() {
  const orgId = useOrgId();
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setError(null);
    (async () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const in7 = new Date(now.getTime() + 7 * 86400000);
      const in7Str = in7.toISOString().slice(0, 10);
      const in7Iso = in7.toISOString();

      const [wsRes, ckRes] = await Promise.all([
        supabase
          .from("workspaces")
          .select("id,name,start_date,end_date,status")
          .eq("org_id", orgId)
          .neq("status", "archived")
          .or(
            `and(start_date.gte.${todayStr},start_date.lte.${in7Str}),and(end_date.gte.${todayStr},end_date.lte.${in7Str})`,
          ),
        supabase
          .from("checklist_items")
          .select("id,title,due_at,workspace_id,done")
          .eq("org_id", orgId)
          .eq("done", false)
          .not("due_at", "is", null)
          .gte("due_at", now.toISOString())
          .lte("due_at", in7Iso)
          .limit(20),
      ]);

      if (cancelled) return;

      if (wsRes.error || ckRes.error) {
        const err = wsRes.error ?? ckRes.error;
        console.error("[ThisWeekPanel] failed to load:", err);
        setError(err?.message ?? "Failed to load");
        return;
      }


      const wsRows = (wsRes.data ?? []) as Array<{
        id: string;
        name: string;
        start_date: string | null;
        end_date: string | null;
      }>;
      const wsById = new Map(wsRows.map((w) => [w.id, w]));

      const out: Row[] = [];
      const fmtRange = (s: string | null, e: string | null) => {
        const f = (d: string) =>
          new Date(d + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
        if (s && e && s !== e) return `${f(s)} → ${f(e)}`;
        if (s) return f(s);
        if (e) return f(e);
        return "";
      };

      const displayName = (n: string | null | undefined) => {
        const t = (n ?? "").trim();
        if (!t || t === "Untitled workspace" || t === "Untitled campaign") return "Untitled campaign";
        return t;
      };
      wsRows.forEach((rawW) => {
        const w = { ...rawW, name: displayName(rawW.name) };
        const startsInWindow =
          w.start_date && w.start_date >= todayStr && w.start_date <= in7Str;
        const endsInWindow = w.end_date && w.end_date >= todayStr && w.end_date <= in7Str;

        if (startsInWindow && endsInWindow) {
          // Whole campaign happens this week — single row.
          out.push({
            kind: "workspace",
            key: `w-${w.id}`,
            sortDate: w.start_date!,
            workspaceId: w.id,
            workspaceName: w.name,
            tone: "active",
            label: w.name,
            sublabel: fmtRange(w.start_date, w.end_date),
          });
        } else if (startsInWindow) {
          out.push({
            kind: "workspace",
            key: `s-${w.id}`,
            sortDate: w.start_date!,
            workspaceId: w.id,
            workspaceName: w.name,
            tone: "starts",
            label: w.name,
            sublabel: w.end_date
              ? `${fmtRange(w.start_date, w.end_date)} · kicks off`
              : "kicks off",
          });
        } else if (endsInWindow) {
          out.push({
            kind: "workspace",
            key: `e-${w.id}`,
            sortDate: w.end_date!,
            workspaceId: w.id,
            workspaceName: w.name,
            tone: "ends",
            label: w.name,
            sublabel: w.start_date
              ? `${fmtRange(w.start_date, w.end_date)} · wraps up`
              : "wraps up",
          });
        }
      });

      (ckRes.data ?? []).forEach((c: { id: string; title: string; due_at: string | null; workspace_id: string }) => {
        if (!c.due_at) return;
        const w = wsById.get(c.workspace_id);
        const wn = displayName(w?.name);
        out.push({
          kind: "due",
          key: `d-${c.id}`,
          sortDate: c.due_at.slice(0, 10),
          workspaceId: c.workspace_id,
          workspaceName: wn,
          tone: "due",
          label: c.title,
          sublabel: wn,
        });
      });

      out.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
      setItems(out.slice(0, 6));
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, reloadKey]);

  return (
    <div>
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl">This week</h2>
        <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground">
          See calendar →
        </Link>
      </div>
      {error ? (
        <PanelError className="mt-4" onRetry={() => setReloadKey((k) => k + 1)} />
      ) : items === null ? (
        <PanelSkeleton className="mt-4" lines={2} />
      ) : items.length === 0 ? (
        <GlassPanel className="honeycomb-ghost mt-4 p-8 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <IconCalendar size={14} />
            Nothing on the calendar this week.
          </span>
        </GlassPanel>

      ) : (
        <div className="mt-4 grid gap-2">
          {items.map((m) => {
            const d = new Date(m.sortDate + "T00:00:00");
            const day = d.toLocaleDateString(undefined, { weekday: "short" });
            const dayNum = d.getDate();
            const monthShort = d.toLocaleDateString(undefined, { month: "short" });
            const tone = TONE[m.tone];
            return (
              <Link
                key={m.key}
                to="/campaigns/$id"
                params={{ id: m.workspaceId }}
                className="block"
              >
                <GlassPanel className="group flex items-center gap-4 p-3 lift">
                  <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-glass/40 py-1.5 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {monthShort}
                    </div>
                    <div className="font-display text-lg leading-none">{dayNum}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {day}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                      <span className={tone.text}>{tone.label}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="truncate text-muted-foreground">{m.sublabel}</span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-foreground">{m.label}</div>
                  </div>
                  <IconArrowRight
                    size={14}
                    className="shrink-0 text-muted-foreground transition group-hover:translate-x-1"
                  />
                </GlassPanel>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
