import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  IconArrowRight,
  IconClock,
  IconCheck,
  IconHome,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { PanelSkeleton } from "@/components/ui-custom/TabSkeleton";
import { PanelError } from "@/components/ui-custom/PanelError";
import { OnboardingChecklist } from "@/components/app/OnboardingChecklist";
import { getCachedOnboardedAt } from "@/hooks/use-onboarding-status";
import { NeedsYouPanel } from "@/components/dashboard/NeedsYouPanel";
import { ThisWeekPanel } from "@/components/dashboard/ThisWeekPanel";
import { PacingSnapshot } from "@/components/dashboard/PacingSnapshot";
import { DashboardHexLauncher } from "@/components/dashboard/DashboardHexLauncher";
import { LoadSampleCTA } from "@/components/templates/LoadSampleCTA";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type Workspace = {
  id: string;
  name: string;
  status: string;
  goal: string | null;
  updated_at: string;
};

type Activity = {
  id: string;
  kind: string;
  workspace_id: string;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  planning: "bg-accent",
  live: "bg-primary",
  complete: "bg-secondary",
  archived: "bg-muted-foreground/20",
};

const ACTIVITY_LABEL: Record<string, string> = {
  "workspace.created": "Created a campaign",
  "workspace.created_from_template": "Spun up from a template",
  "workspace.status_changed": "Changed campaign status",
  "workspace.archived": "Archived a campaign",
  "workspace.shared": "Shared a campaign",
  "workspace.drafted_by_ai": "Drafted a campaign with AI",
  "campaign.named": "Generated a campaign name",
  "utm.minted": "Minted a UTM link",
  "list.imported": "Imported a contact list",
  "list.cleaned": "Cleaned a contact list",
  "retro.added": "Added a retro",
  "comment.added": "Left a comment",
  "asset.added": "Attached an asset",
  "webhook.dispatched": "Dispatched a webhook",
  "request.created": "Submitted a request",
  "request.promoted": "Promoted a request",
};

// Activity kinds we hide from the dashboard feed (too noisy)
const NOISY_KINDS = new Set(["workspace.updated", "checklist.completed", "workspace.seeded"]);

const humanizeKind = (k: string) =>
  ACTIVITY_LABEL[k] ?? k.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

type GroupedActivity = {
  id: string;
  kind: string;
  workspace_id: string;
  workspace_name: string | null;
  created_at: string;
  count: number;
};

function groupActivity(rows: Activity[], names: Map<string, string>): GroupedActivity[] {
  const out: GroupedActivity[] = [];
  for (const r of rows) {
    if (NOISY_KINDS.has(r.kind)) continue;
    const last = out[out.length - 1];
    if (
      last &&
      last.workspace_id === r.workspace_id &&
      last.kind === r.kind &&
      Math.abs(new Date(last.created_at).getTime() - new Date(r.created_at).getTime()) < 30 * 60 * 1000
    ) {
      last.count += 1;
    } else {
      out.push({
        id: r.id,
        kind: r.kind,
        workspace_id: r.workspace_id,
        workspace_name: names.get(r.workspace_id) ?? null,
        created_at: r.created_at,
        count: 1,
      });
    }
  }
  return out.slice(0, 4);
}

function Dashboard() {
  const { user } = useAuth();
  const orgId = useOrgId();
  const [activeWs, setActiveWs] = useState<Workspace[] | null>(null);
  const [recentActivity, setRecentActivity] = useState<GroupedActivity[] | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const onboardedAt = await getCachedOnboardedAt(user.id);
      if (cancelled) return;
      setIsFirstVisit(!onboardedAt);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);


  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setWsError(null);
    setActError(null);
    const load = async () => {
      const [wsRes, actRes] = await Promise.all([
        supabase
          .from("workspaces")
          .select("id,name,status,goal,updated_at")
          .eq("org_id", orgId)
          .in("status", ["planning", "live"])
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase
          .from("workspace_activity")
          .select("id,kind,workspace_id,actor_id,payload,created_at")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;
      if (wsRes.error) {
        console.error("[Dashboard] failed to load workspaces:", wsRes.error);
        setWsError(wsRes.error.message ?? "Failed to load");
      } else {
        setActiveWs((wsRes.data as Workspace[]) ?? []);
      }
      if (actRes.error) {
        console.error("[Dashboard] failed to load activity:", actRes.error);
        setActError(actRes.error.message ?? "Failed to load");
      } else {
        const acts = (actRes.data as Activity[]) ?? [];
        // Fetch names for the workspaces referenced in the feed so we can
        // render "Minted a UTM link · Q2 Product Launch" instead of generic copy.
        const ids = Array.from(new Set(acts.map((a) => a.workspace_id))).filter(Boolean);
        const names = new Map<string, string>();
        if (ids.length) {
          const { data: wsRows } = await supabase
            .from("workspaces")
            .select("id,name")
            .in("id", ids);
          for (const r of (wsRows as { id: string; name: string }[] | null) ?? []) {
            names.set(r.id, r.name);
          }
        }
        setRecentActivity(groupActivity(acts, names));
      }
    };
    load();

    const channel = supabase
      .channel("dashboard-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_activity", filter: `org_id=eq.${orgId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspaces", filter: `org_id=eq.${orgId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orgId, reloadKey]);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0];

  return (
    <div className="space-y-10">
      <div className="flex items-start gap-4" data-tour="dashboard-hero">
        <PageHexBadge hue={88} size={26} icon={<IconHome size={22} />} aria-label="Dashboard" />
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {isFirstVisit ? "First visit" : "This week"}
          </div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">
            {isFirstVisit
              ? firstName
                ? `Welcome, ${firstName}.`
                : "Welcome."
              : firstName
                ? `Welcome back, ${firstName}.`
                : "Welcome back."}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {isFirstVisit
              ? "Quick tour: load a sample campaign, then poke at the tools below."
              : "What needs you, how you're pacing, and what's coming up."}
          </p>
        </div>
      </div>


      <DashboardHexLauncher />

      <NeedsYouPanel />

      {orgId && <PacingSnapshot orgId={orgId} />}

      <ThisWeekPanel />

      <div>
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">In flight</h2>
          <Link to="/campaigns" className="text-xs text-muted-foreground hover:text-foreground">
            All campaigns →
          </Link>
        </div>
        {wsError ? (
          <PanelError className="mt-4" onRetry={() => setReloadKey((k) => k + 1)} />
        ) : activeWs === null ? (
          <PanelSkeleton className="mt-4" lines={3} />
        ) : activeWs.length === 0 ? (
          <div className="mt-4 space-y-4">
            <GlassPanel className="honeycomb-ghost p-6 text-sm text-muted-foreground">
              Nothing in planning or live right now. Pick a template or load a sample to see a real campaign wired up.
            </GlassPanel>
            <LoadSampleCTA
              headline="Load a sample campaign"
              body="Workspace + checklist + budget + KPI, all seeded so you can poke around. Remove it any time."
              compact
            />
          </div>

        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {activeWs.map((w) => (
              <Link key={w.id} to="/campaigns/$id" params={{ id: w.id }} className="block">
                <GlassPanel className="group flex h-full flex-col gap-3 p-4 lift">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-display text-base">{w.name}</div>
                      {w.goal && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{w.goal}</div>}
                    </div>
                    <span className="inline-flex items-center gap-1.5 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span className={`inline-block size-2 rounded-full ${STATUS_DOT[w.status] ?? STATUS_DOT.draft}`} />
                      {w.status}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <IconClock size={12} /> {new Date(w.updated_at).toLocaleDateString()}
                    </span>
                    <IconArrowRight size={14} className="transition group-hover:translate-x-1" />
                  </div>
                </GlassPanel>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Activity — trimmed + grouped */}
      <div>
        <h2 className="font-display text-2xl">Recent activity</h2>
        {actError ? (
          <PanelError className="mt-4" onRetry={() => setReloadKey((k) => k + 1)} />
        ) : recentActivity === null ? (
          <PanelSkeleton className="mt-4" lines={4} />
        ) : recentActivity.length === 0 ? (
          <GlassPanel className="honeycomb-ghost mt-4 p-8 text-sm text-muted-foreground">
            Nothing yet. Saving a campaign name, list, or UTM will show up here.
          </GlassPanel>

        ) : (
          <GlassPanel className="mt-4 divide-y divide-glass-border">
            {recentActivity.map((a) => (
              <Link
                key={a.id}
                to="/campaigns/$id"
                params={{ id: a.workspace_id }}
                className="flex items-center justify-between gap-3 p-3.5 text-sm hover:bg-glass/30"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <IconCheck size={14} className="shrink-0 text-primary" />
                  <span className="min-w-0 text-sm text-foreground">
                    {humanizeKind(a.kind)}
                    {a.workspace_name && (
                      <span className="ml-2 text-muted-foreground">
                        ·{" "}
                        <span className="text-foreground/80">{a.workspace_name}</span>
                      </span>
                    )}
                    {a.count > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">×{a.count}</span>
                    )}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <IconClock size={11} /> {new Date(a.created_at).toLocaleString()}
                </span>
              </Link>
            ))}
          </GlassPanel>
        )}
      </div>

      {/* Onboarding — full variant only when <50% (auto handles), at the bottom */}
      <OnboardingChecklist />
    </div>
  );
}
