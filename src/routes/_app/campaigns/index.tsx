import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { useCachedFetch, setCachedFetch } from "@/hooks/use-cached-fetch";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import { PanelError } from "@/components/ui-custom/PanelError";


import {
  IconWorkspace,
  IconPlus,
  IconArrowRight,
  IconClock,
  IconCampaign,
  IconAudience,
  IconImport,
  IconUtm,
  IconSpark,
  IconClose,
  IconChevronDown,
  IconCheck,
} from "@/components/ui-custom/CustomIcon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings, GripVertical, Trash2 } from "lucide-react";

import { PageHexBadge } from "@/components/app/PageHexBadge";
import { LoadSampleCTA } from "@/components/templates/LoadSampleCTA";
import { useServerFn } from "@tanstack/react-start";
import { draftCampaignFromBrief } from "@/lib/ai-suggest.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campaigns/")({
  component: WorkspacesList,
});

type Workspace = {
  id: string;
  name: string;
  status: string;
  goal: string | null;
  channel: string | null;
  updated_at: string;
};

type Stage = {
  id: string;
  key: string;
  label: string;
  color: string;
  position: number;
  is_system: boolean;
};

type FilterValue = "all" | string;

// Color tokens for stage palette — each maps to badge + dot styles.
const COLOR_PALETTE = [
  "zinc", "slate", "violet", "emerald", "sky", "amber", "rose", "indigo", "cyan", "orange", "lime", "fuchsia",
] as const;

const COLOR_BADGE: Record<string, string> = {
  zinc: "bg-zinc-500/20 text-zinc-100 border border-zinc-400/30",
  slate: "bg-white/5 text-white/60 border border-white/10",
  violet: "bg-violet-500/25 text-violet-100 border border-violet-400/40",
  emerald: "bg-emerald-500/25 text-emerald-100 border border-emerald-400/40",
  sky: "bg-sky-500/25 text-sky-100 border border-sky-400/40",
  amber: "bg-amber-500/25 text-amber-100 border border-amber-400/40",
  rose: "bg-rose-500/25 text-rose-100 border border-rose-400/40",
  indigo: "bg-indigo-500/25 text-indigo-100 border border-indigo-400/40",
  cyan: "bg-cyan-500/25 text-cyan-100 border border-cyan-400/40",
  orange: "bg-orange-500/25 text-orange-100 border border-orange-400/40",
  lime: "bg-lime-500/25 text-lime-100 border border-lime-400/40",
  fuchsia: "bg-fuchsia-500/25 text-fuchsia-100 border border-fuchsia-400/40",
};

const COLOR_DOT: Record<string, string> = {
  zinc: "bg-zinc-300",
  slate: "bg-white/40",
  violet: "bg-violet-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  indigo: "bg-indigo-400",
  cyan: "bg-cyan-400",
  orange: "bg-orange-400",
  lime: "bg-lime-400",
  fuchsia: "bg-fuchsia-400",
};

const colorBadge = (c: string) => COLOR_BADGE[c] ?? COLOR_BADGE.zinc;
const colorDot = (c: string) => COLOR_DOT[c] ?? COLOR_DOT.zinc;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

// ---- Stages hook ----------------------------------------------------------
function useStages(orgId: string | null) {
  const cacheKey = orgId ? `campaign_stages:${orgId}` : null;
  const { data, refetch } = useCachedFetch<Stage[]>(cacheKey, async () => {
    const { data, error } = await supabase
      .from("campaign_stages")
      .select("id,key,label,color,position,is_system")
      .eq("org_id", orgId!)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data as Stage[]) ?? [];
  });
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel("campaign-stages-" + orgId)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_stages", filter: `org_id=eq.${orgId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, refetch]);
  return { stages: data ?? null, refetch };
}

function WorkspacesList() {
  const orgId = useOrgId();
  const { user } = useAuth();
  const nav = useNavigate();
  const cacheKey = orgId ? `workspaces:list:${orgId}` : null;
  const { data: cached, error: loadError, refetch } = useCachedFetch<Workspace[]>(cacheKey, async () => {
    const { data, error } = await supabase
      .from("workspaces")
      .select("id,name,status,goal,channel,updated_at")
      .eq("org_id", orgId!)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as Workspace[]) ?? [];
  });

  const [items, setItems] = useState<Workspace[] | null>(cached ?? null);
  useEffect(() => {
    if (cached !== undefined) setItems(cached);
  }, [cached]);

  const { stages, refetch: refetchStages } = useStages(orgId);

  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [draftOpen, setDraftOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [drafting, setDrafting] = useState(false);
  const draft = useServerFn(draftCampaignFromBrief);

  const draftFromBrief = async () => {
    if (!orgId || !user || !brief.trim()) return;
    setDrafting(true);
    try {
      const plan = await draft({ data: { brief } });
      const { data: ws, error } = await supabase
        .from("workspaces")
        .insert({
          org_id: orgId,
          owner_id: user.id,
          name: plan.name,
          status: "planning",
          goal: plan.goal,
          channel: plan.channel,
          campaign_type: plan.campaign_type,
          kpi_label: plan.kpi_label,
          kpi_target: plan.kpi_target,
        })
        .select("id")
        .single();
      if (error || !ws) throw new Error(error?.message ?? "Could not create");
      const checklistRows = plan.checklist.map((title, i) => ({
        workspace_id: ws.id, org_id: orgId, created_by: user.id, title, position: i,
      }));
      const variantRows = plan.variants.map((v, i) => ({
        workspace_id: ws.id, org_id: orgId, created_by: user.id,
        label: v.label, subject: v.subject, copy: v.copy, position: i, channel: plan.channel,
      }));
      await Promise.all([
        supabase.from("checklist_items").insert(checklistRows),
        supabase.from("campaign_variants").insert(variantRows),
        supabase.from("workspace_activity").insert({
          workspace_id: ws.id, org_id: orgId, actor_id: user.id,
          kind: "workspace.drafted_by_ai", payload: { brief_chars: brief.length },
        }),
      ]);
      toast.success("Workspace drafted");
      setDraftOpen(false);
      setBrief("");
      nav({ to: "/campaigns/$id", params: { id: ws.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI draft failed");
    } finally {
      setDrafting(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("workspaces-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspaces", filter: `org_id=eq.${orgId}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, refetch]);


  const create = async () => {
    if (!orgId || !user) {
      toast.message("Just a sec — finishing sign-in…");
      return;
    }
    setCreating(true);
    const now = new Date();
    const draftName = `Campaign — ${now.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}`;
    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        org_id: orgId,
        owner_id: user.id,
        name: draftName,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !data) {
      setCreating(false);
      toast.error(error?.message ?? "Could not create campaign");
      return;
    }
    if (cacheKey) {
      const prev = (items ?? []) as Workspace[];
      const optimistic: Workspace = {
        id: data.id,
        name: draftName,
        status: "draft",
        goal: null,
        channel: null,
        updated_at: new Date().toISOString(),
      };
      setCachedFetch(cacheKey, [optimistic, ...prev]);
    }
    nav({ to: "/campaigns/$id", params: { id: data.id } });
    void supabase.from("workspace_activity").insert({
      workspace_id: data.id,
      org_id: orgId,
      actor_id: user.id,
      kind: "workspace.created",
      payload: {},
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={150} size={26} icon={<IconCampaign size={22} />} aria-label="Campaigns" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Campaigns</div>
            <h1 className="mt-1 font-display text-4xl tracking-tight">Every initiative, one place.</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              A campaign bundles its name, audience, list, UTM links, and checklist under one roof — share saved audiences
              and lists across campaigns from your workspace settings.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setDraftOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary hover:bg-primary/15"
          >
            <IconSpark size={14} /> Draft from brief
          </button>
          <button
            onClick={create}
            disabled={creating}
            data-tour="new-campaign-btn"
            className="btn-keystone inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <IconPlus size={16} />
            {creating ? "Creating…" : "New campaign"}
          </button>
        </div>
      </div>

      {draftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !drafting && setDraftOpen(false)}>
          <GlassPanel tier="strong" className="relative w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => !drafting && setDraftOpen(false)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            >
              <IconClose size={16} />
            </button>
            <div className="flex items-center gap-2">
              <IconSpark size={16} className="text-primary" />
              <h2 className="font-display text-xl">Draft this campaign for me</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste a 1–3 paragraph brief. AI will name it, set the goal, KPI, channel, checklist, and 2–4 variants.
            </p>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={8}
              placeholder="e.g. We're launching our Pro plan in 3 weeks to existing free-tier signups. Goal: 200 paid conversions. Mostly email + a small paid social retarget…"
              className="mt-3 w-full resize-none rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDraftOpen(false)}
                disabled={drafting}
                className="rounded-full px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={draftFromBrief}
                disabled={drafting || brief.trim().length < 20}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <IconSpark size={12} /> {drafting ? "Drafting…" : "Draft campaign"}
              </button>
            </div>
          </GlassPanel>
        </div>
      )}

      {manageOpen && stages && orgId && (
        <ManageStagesDialog
          orgId={orgId}
          stages={stages}
          onClose={() => setManageOpen(false)}
          onChanged={refetchStages}
        />
      )}

      {items === null && loadError ? (
        <PanelError message="Couldn't load campaigns" onRetry={() => refetch()} />
      ) : items === null ? (
        <GlassSkeleton rows={6} />
      ) : items.length === 0 ? (

        <GlassPanel tier="strong" className="flex flex-col gap-8 p-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <IconWorkspace size={24} />
            </span>
            <h2 className="font-display text-2xl">Start your first campaign</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              A campaign is one initiative — a launch, webinar, or nurture. Name it, build the audience, import the list, and mint tracked links. All four stay wired together.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", label: "Name it", Icon: IconCampaign },
              { step: "02", label: "Build audience", Icon: IconAudience },
              { step: "03", label: "Import list", Icon: IconImport },
              { step: "04", label: "Track URLs", Icon: IconUtm },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3 rounded-xl border border-glass-border bg-glass/30 px-4 py-3">
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{s.step}</span>
                <s.Icon size={16} className="text-primary" />
                <span className="text-sm">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={create} disabled={creating} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                <IconPlus size={16} />
                {creating ? "Creating…" : "Create your first campaign"}
              </button>
              <button onClick={() => setDraftOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm text-primary hover:bg-primary/15">
                <IconSpark size={14} /> Draft from brief
              </button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Tip: press <kbd className="rounded bg-black/30 px-1.5 py-0.5 font-mono">⌘K</kbd> anywhere to jump around.
            </span>
          </div>
          <LoadSampleCTA
            headline="Or load a sample to see it wired up"
            body="Spins up a workspace with checklist, budget, and KPI seeded — so you can poke at a real example instead of a blank shell."
          />
        </GlassPanel>
      ) : (
        <>
          <StatusFilterTabs
            items={items}
            stages={stages ?? []}
            value={filter}
            onChange={setFilter}
            onManage={() => setManageOpen(true)}
          />
          <GroupedCampaigns items={items} stages={stages ?? []} filter={filter} />
        </>
      )}
    </div>
  );
}

function StatusFilterTabs({
  items, stages, value, onChange, onManage,
}: {
  items: Workspace[];
  stages: Stage[];
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  onManage: () => void;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const w of items) c[w.status] = (c[w.status] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full border border-glass-border bg-glass/20 p-1 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs transition ${
          value === "all"
            ? "bg-glass/60 text-foreground shadow-[0_2px_12px_-4px_oklch(0.78_0.2_280/0.5)]"
            : "text-muted-foreground hover:text-foreground hover:bg-glass/30"
        }`}
        aria-pressed={value === "all"}
      >
        <span>All</span>
        <span className={`font-mono text-[10px] ${value === "all" ? "text-foreground/70" : "text-muted-foreground/60"}`}>
          {items.length}
        </span>
      </button>
      {stages.map((s) => {
        const active = value === s.key;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.key)}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs transition ${
              active
                ? "bg-glass/60 text-foreground shadow-[0_2px_12px_-4px_oklch(0.78_0.2_280/0.5)]"
                : "text-muted-foreground hover:text-foreground hover:bg-glass/30"
            }`}
            aria-pressed={active}
          >
            <span className={`size-1.5 rounded-full ${colorDot(s.color)}`} />
            <span>{s.label}</span>
            <span className={`font-mono text-[10px] ${active ? "text-foreground/70" : "text-muted-foreground/60"}`}>
              {counts[s.key] ?? 0}
            </span>
          </button>
        );
      })}
      <div className="ml-auto pl-1">
        <button
          type="button"
          onClick={onManage}
          aria-label="Manage stages"
          title="Manage stages"
          className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-glass/40 hover:text-foreground"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ workspace, stages }: { workspace: Workspace; stages: Stage[] }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(workspace.status);
  useEffect(() => setCurrent(workspace.status), [workspace.status]);

  const currentStage = stages.find((s) => s.key === current);
  const currentLabel = currentStage?.label ?? current;
  const currentColor = currentStage?.color ?? "zinc";

  const change = async (nextKey: string) => {
    setOpen(false);
    if (nextKey === current) return;
    const prev = current;
    setCurrent(nextKey);
    const { error } = await supabase
      .from("workspaces")
      .update({ status: nextKey })
      .eq("id", workspace.id);
    if (error) {
      setCurrent(prev);
      toast.error(error.message ?? "Couldn't update status");
    } else {
      const label = stages.find((s) => s.key === nextKey)?.label ?? nextKey;
      toast.success(`Moved to ${label}`);
    }
  };

  // Stop link navigation on every interaction that could bubble.
  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  // pointerdown/mousedown only stop propagation — preventDefault would block
  // Radix Popover's open trigger and the button's focus.
  const stopBubble = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            // Prevent the wrapping <Link> from navigating, and toggle the
            // popover ourselves (preventDefault would block Radix's own open).
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className={`group/badge shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider transition hover:brightness-110 ${colorBadge(currentColor)}`}
          aria-label={`Status: ${currentLabel}. Click to change.`}
        >
          <span>{currentLabel}</span>
          <IconChevronDown size={10} className="opacity-70 transition group-hover/badge:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-48 p-1" onClick={stop}>
        <div className="px-2 pb-1.5 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Change status
        </div>
        {stages.map((s) => {
          const isCurrent = s.key === current;
          return (
            <button
              key={s.id}
              type="button"
              onClick={(e) => { stop(e); void change(s.key); }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-glass/60 ${
                isCurrent ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`size-2 rounded-full ${colorDot(s.color)}`} />
              <span className="flex-1 text-left">{s.label}</span>
              {isCurrent && <IconCheck size={12} className="text-foreground/70" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function GroupedCampaigns({
  items, stages, filter,
}: { items: Workspace[]; stages: Stage[]; filter: FilterValue }) {
  const groups = useMemo(() => {
    const filtered = filter === "all" ? items : items.filter((w) => w.status === filter);
    if (filter !== "all") {
      return [{ key: filter, label: stages.find((s) => s.key === filter)?.label ?? filter, color: stages.find((s) => s.key === filter)?.color ?? "zinc", rows: filtered, hideHeader: true }];
    }
    const by: Record<string, Workspace[]> = {};
    for (const w of filtered) (by[w.status] ??= []).push(w);
    const stageKeys = new Set(stages.map((s) => s.key));
    const known = stages
      .map((s) => ({ key: s.key, label: s.label, color: s.color, rows: by[s.key] ?? [], hideHeader: false }))
      .filter((g) => g.rows.length > 0);
    const orphanRows = filtered.filter((w) => !stageKeys.has(w.status));
    if (orphanRows.length > 0) {
      known.push({ key: "__other__", label: "Other", color: "zinc", rows: orphanRows, hideHeader: false });
    }
    return known;
  }, [items, stages, filter]);

  if (groups.length === 0 || groups.every((g) => g.rows.length === 0)) {
    return (
      <div className="rounded-2xl border border-glass-border bg-glass/20 px-6 py-10 text-center text-sm text-muted-foreground">
        No campaigns in this status.
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {groups.map((g) => (
        <section key={g.key} className="space-y-2.5">
          {!g.hideHeader && (
            <div className="flex items-baseline gap-2 px-1">
              <span className={`size-1.5 rounded-full ${colorDot(g.color)}`} />
              <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
                {g.label}
              </h2>
              <span className="font-mono text-[11px] text-muted-foreground/70">{g.rows.length}</span>
            </div>
          )}
          <ul className="space-y-2.5">
            {g.rows.map((w) => (
              <li key={w.id} className="relative">
                {/* Badge sits outside the Link so its popover clicks
                    don't trigger navigation. Aligned to match the original layout. */}
                <div className="pointer-events-none absolute inset-y-0 left-5 z-10 flex items-center">
                  <span className="pointer-events-auto">
                    <StatusBadge workspace={w} stages={stages} />
                  </span>
                </div>
                <Link
                  to="/campaigns/$id"
                  params={{ id: w.id }}
                  preload="intent"
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-glass-border border-l-4 bg-glass/30 py-4 pl-5 pr-5 backdrop-blur-xl transition hover:border-primary/30 hover:bg-glass/50 hover:border-l-primary hover:shadow-[0_8px_30px_-12px_oklch(0.78_0.2_280/0.35)]"
                >
                  {/* Invisible spacer matching the badge width so layout is identical */}
                  <span
                    aria-hidden
                    className="invisible shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
                  >
                    <span>{stages.find((s) => s.key === w.status)?.label ?? w.status}</span>
                    <IconChevronDown size={10} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-base">
                      {(() => {
                        const n = w.name?.trim();
                        const isPlaceholder = !n || n === "Untitled workspace" || n === "Untitled campaign";
                        return isPlaceholder ? (
                          <span className="italic text-muted-foreground">Untitled campaign</span>
                        ) : n;
                      })()}
                    </div>
                    {w.goal && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{w.goal}</div>
                    )}
                  </div>
                  {w.channel && (
                    <span className="hidden shrink-0 rounded-full border border-glass-border bg-glass/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:inline-block">
                      {w.channel}
                    </span>
                  )}
                  <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
                    <IconClock size={12} /> {new Date(w.updated_at).toLocaleDateString()}
                  </span>
                  <IconArrowRight
                    size={14}
                    className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---- Manage Stages dialog -------------------------------------------------
function ManageStagesDialog({
  orgId, stages, onClose, onChanged,
}: {
  orgId: string;
  stages: Stage[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [working, setWorking] = useState<Stage[]>(() => [...stages].sort((a, b) => a.position - b.position));
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>("indigo");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    setWorking([...stages].sort((a, b) => a.position - b.position));
  }, [stages]);

  const setLabel = (id: string, label: string) =>
    setWorking((cur) => cur.map((s) => (s.id === id ? { ...s, label } : s)));
  const setColor = (id: string, color: string) =>
    setWorking((cur) => cur.map((s) => (s.id === id ? { ...s, color } : s)));

  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setWorking((cur) => {
      const next = [...cur];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };
  const onDragEnd = () => setDragIdx(null);

  const addStage = () => {
    const label = newLabel.trim();
    if (!label) return;
    const baseKey = slugify(label) || `stage-${Date.now()}`;
    let key = baseKey;
    let i = 2;
    while (working.some((s) => s.key === key)) {
      key = `${baseKey}-${i++}`;
    }
    setWorking((cur) => [
      ...cur,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        key,
        label,
        color: newColor,
        position: cur.length,
        is_system: false,
      },
    ]);
    setNewLabel("");
  };

  const removeStage = (id: string) => {
    setWorking((cur) => cur.filter((s) => s.id !== id));
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const originalById = new Map(stages.map((s) => [s.id, s]));
      const workingIds = new Set(working.filter((s) => !s.id.startsWith("new-")).map((s) => s.id));

      // Deletes: original rows no longer in working
      const toDelete = stages.filter((s) => !workingIds.has(s.id) && !s.is_system);
      // Inserts: new ones
      const toInsert = working
        .map((s, idx) => ({ ...s, position: idx }))
        .filter((s) => s.id.startsWith("new-"))
        .map((s) => ({ org_id: orgId, key: s.key, label: s.label, color: s.color, position: s.position, is_system: false }));
      // Updates: existing rows whose label/color/position changed
      const toUpdate = working
        .map((s, idx) => ({ ...s, position: idx }))
        .filter((s) => !s.id.startsWith("new-"))
        .filter((s) => {
          const o = originalById.get(s.id);
          return o && (o.label !== s.label || o.color !== s.color || o.position !== s.position);
        });

      if (toDelete.length) {
        const { error } = await supabase.from("campaign_stages").delete().in("id", toDelete.map((s) => s.id));
        if (error) throw error;
      }
      if (toInsert.length) {
        const { error } = await supabase.from("campaign_stages").insert(toInsert);
        if (error) throw error;
      }
      for (const s of toUpdate) {
        const { error } = await supabase
          .from("campaign_stages")
          .update({ label: s.label, color: s.color, position: s.position })
          .eq("id", s.id);
        if (error) throw error;
      }
      toast.success("Stages updated");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save stages");
    } finally {
      setSaving(false);
    }
  }, [working, stages, orgId, onChanged, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <GlassPanel tier="strong" className="relative w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <IconClose size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-primary" />
          <h2 className="font-display text-xl">Manage Stages</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Rename, recolor, reorder, or add custom stages. System stages can be edited but not deleted.
        </p>

        <ul className="mt-4 space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {working.map((s, idx) => (
            <li
              key={s.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
              className={`group flex items-center gap-2 rounded-lg border border-glass-border bg-glass/30 px-2 py-1.5 ${dragIdx === idx ? "opacity-60" : ""}`}
            >
              <span className="cursor-grab text-muted-foreground hover:text-foreground" aria-label="Drag to reorder">
                <GripVertical size={14} />
              </span>
              <ColorPicker value={s.color} onChange={(c) => setColor(s.id, c)} />
              <input
                value={s.label}
                onChange={(e) => setLabel(s.id, e.target.value)}
                className="flex-1 rounded-md bg-transparent px-2 py-1 text-sm outline-none focus:bg-background/40"
              />
              {s.is_system ? (
                <span className="rounded-full bg-glass/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">System</span>
              ) : (
                <button
                  type="button"
                  onClick={() => removeStage(s.id)}
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-rose-500/15 hover:text-rose-300"
                  aria-label="Delete stage"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-glass-border bg-glass/20 p-2">
          <ColorPicker value={newColor} onChange={setNewColor} />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(); } }}
            placeholder="New stage name…"
            className="flex-1 rounded-md bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground/60 focus:bg-background/40"
          />
          <button
            type="button"
            onClick={addStage}
            disabled={!newLabel.trim()}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary hover:bg-primary/25 disabled:opacity-40"
          >
            <IconPlus size={12} /> Add
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="rounded-full px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pick color"
          className={`size-5 shrink-0 rounded-full border border-white/20 ${colorDot(value)}`}
        />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`size-6 rounded-full border ${value === c ? "border-foreground" : "border-white/20"} ${colorDot(c)}`}
              aria-label={c}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
