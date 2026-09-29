import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  IconCheck,
  IconClock,
  IconArrowRight,
  IconWarning,
  IconScroll,
  IconList,
  IconTrophy,
} from "@/components/ui-custom/CustomIcon";
import { PanelSkeleton } from "@/components/ui-custom/TabSkeleton";
import { PanelError } from "@/components/ui-custom/PanelError";

type Item = {
  key: string;
  kind: "overdue" | "mention" | "request" | "retro";
  label: string;
  meta?: string;
  workspaceId?: string;
  to: string;
  params?: Record<string, string>;
  weight: number; // for sort
};

const KIND_ICON = {
  overdue: IconWarning,
  mention: IconScroll,
  request: IconList,
  retro: IconTrophy,
} as const;

const KIND_COLOR = {
  overdue: "text-[oklch(0.78_0.18_25)]",
  mention: "text-[oklch(0.78_0.18_305)]",
  request: "text-[oklch(0.82_0.17_75)]",
  retro: "text-[oklch(0.82_0.20_155)]",
} as const;

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function NeedsYouPanel() {
  const { user } = useAuth();
  const orgId = useOrgId();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    supabase
      .from("org_members")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .then((res) => {
        if (cancelled) return;
        setMemberCount(res.count ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);


  useEffect(() => {
    if (!orgId || !user) return;
    let cancelled = false;
    setError(null);
    (async () => {
      const todayIso = new Date().toISOString();
      const [overdueRes, mentionsRes, requestsRes, liveOverdueRes, retrosRes] = await Promise.all([
        supabase
          .from("checklist_items")
          .select("id,title,due_at,workspace_id,owner_id")
          .eq("org_id", orgId)
          .eq("done", false)
          .not("due_at", "is", null)
          .lt("due_at", todayIso)
          .or(`owner_id.eq.${user.id},created_by.eq.${user.id}`)
          .order("due_at", { ascending: true })
          .limit(8),
        supabase
          .from("workspace_comments")
          .select("id,body,workspace_id,created_at,mentions")
          .eq("org_id", orgId)
          .contains("mentions", [user.id])
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("campaign_requests")
          .select("id,brief,workspace_id,created_at,status")
          .eq("org_id", orgId)
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("workspaces")
          .select("id,name,end_date")
          .eq("org_id", orgId)
          .eq("status", "live")
          .not("end_date", "is", null)
          .lt("end_date", new Date().toISOString().slice(0, 10))
          .limit(8),
        supabase.from("workspace_retros").select("workspace_id").eq("org_id", orgId),
      ]);

      if (cancelled) return;

      const firstError =
        overdueRes.error ||
        mentionsRes.error ||
        requestsRes.error ||
        liveOverdueRes.error ||
        retrosRes.error;
      if (firstError) {
        console.error("[NeedsYouPanel] failed to load:", firstError);
        setError(firstError.message ?? "Failed to load");
        return;
      }

      const retroSet = new Set(((retrosRes.data ?? []) as { workspace_id: string }[]).map((r) => r.workspace_id));

      const out: Item[] = [];

      (overdueRes.data ?? []).forEach((c: any) => {
        out.push({
          key: `o-${c.id}`,
          kind: "overdue",
          label: c.title,
          meta: `Overdue · ${relTime(c.due_at)}`,
          workspaceId: c.workspace_id,
          to: "/campaigns/$id",
          params: { id: c.workspace_id },
          weight: 100,
        });
      });

      (mentionsRes.data ?? []).forEach((m: any) => {
        const snip = (m.body as string).replace(/\s+/g, " ").slice(0, 90);
        out.push({
          key: `m-${m.id}`,
          kind: "mention",
          label: `Mentioned you: "${snip}${snip.length === 90 ? "…" : ""}"`,
          meta: relTime(m.created_at),
          workspaceId: m.workspace_id,
          to: "/campaigns/$id",
          params: { id: m.workspace_id },
          weight: 80,
        });
      });

      (requestsRes.data ?? []).forEach((r: any) => {
        const snip = (r.brief as string).replace(/\s+/g, " ").slice(0, 90);
        out.push({
          key: `r-${r.id}`,
          kind: "request",
          label: `Request needs triage: "${snip}${snip.length === 90 ? "…" : ""}"`,
          meta: `New · ${relTime(r.created_at)}`,
          to: "/requests",
          weight: 60,
        });
      });

      (liveOverdueRes.data ?? []).forEach((w: any) => {
        if (retroSet.has(w.id)) return;
        out.push({
          key: `rt-${w.id}`,
          kind: "retro",
          label: `Retro missing for "${w.name}"`,
          meta: `Ended ${new Date(w.end_date).toLocaleDateString()}`,
          workspaceId: w.id,
          to: "/campaigns/$id",
          params: { id: w.id },
          weight: 50,
        });
      });

      out.sort((a, b) => b.weight - a.weight);
      setItems(out.slice(0, 6));
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, user, reloadKey]);

  const soloOrg = memberCount === 1;
  const inviteCard = soloOrg ? (
    <GlassPanel tier="strong" className="mt-4 flex items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <div className="font-display text-base">Bring your team in</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Campaigns are better with reviewers, assignees, and a shared retro. Send invites from Settings.
        </p>
      </div>
      <Link
        to="/settings"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        Invite team <IconArrowRight size={12} />
      </Link>
    </GlassPanel>
  ) : null;

  return (
    <div>
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl">Needs you</h2>
        {items && items.length > 0 && (
          <span className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</span>
        )}
      </div>
      {inviteCard}
      {error ? (
        <PanelError className="mt-4" onRetry={() => setReloadKey((k) => k + 1)} />
      ) : items === null ? (
        <PanelSkeleton className="mt-4" lines={3} />
      ) : items.length === 0 && !soloOrg ? (
        <GlassPanel className="mt-4 flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconCheck size={16} />
          </span>
          You're clear. Nice.
        </GlassPanel>
      ) : items.length === 0 && soloOrg ? null : (
        <GlassPanel tier="strong" className="mt-4 divide-y divide-glass-border">
          {items.map((it) => {
            const Icon = KIND_ICON[it.kind];
            const linkProps =
              it.params
                ? ({ to: it.to, params: it.params } as const)
                : ({ to: it.to } as const);
            return (
              <Link
                key={it.key}
                {...(linkProps as any)}
                className="flex items-center justify-between gap-3 p-4 text-sm transition hover:bg-glass/30"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`shrink-0 ${KIND_COLOR[it.kind]}`}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{it.label}</span>
                    {it.meta && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <IconClock size={11} /> {it.meta}
                      </span>
                    )}
                  </span>
                </span>
                <IconArrowRight size={14} className="shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </GlassPanel>
      )}
    </div>
  );
}
