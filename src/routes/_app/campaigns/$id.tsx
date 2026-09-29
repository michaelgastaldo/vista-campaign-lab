import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  IconWorkspace,
  IconCampaign,
  IconImport,
  IconUtm,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconEdit,
  IconSpark,
  IconImport as IconDownload,
} from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChecklistSection } from "@/components/workspace/ChecklistSection";
import { BudgetSection } from "@/components/workspace/BudgetSection";
import { AssetsSection } from "@/components/workspace/AssetsSection";
import { VariantsSection } from "@/components/workspace/VariantsSection";
import { ResultsSection } from "@/components/workspace/ResultsSection";
import { WebhooksSection } from "@/components/workspace/WebhooksSection";
import { RetroModal } from "@/components/workspace/RetroModal";
import { ShareSection } from "@/components/workspace/ShareSection";
import { CommentsSection } from "@/components/workspace/CommentsSection";
// Lazy: ReactFlow (~150kb) only loads when the Flow tab opens
const FlowCanvas = lazy(() =>
  import("@/components/workspace/FlowCanvas").then((m) => ({ default: m.FlowCanvas })),
);
import { useServerFn } from "@tanstack/react-start";
import { suggestChecklist } from "@/lib/ai-suggest.functions";
import { buildHandoffPack } from "@/lib/handoff-pack.functions";
import { dispatchWorkspaceEvent } from "@/lib/webhook-dispatch.functions";
import { cn } from "@/lib/utils";
import { useAutosave } from "@/hooks/use-autosave";
import { reportAutosave } from "@/lib/autosave-store";

export const Route = createFileRoute("/_app/campaigns/$id")({
  component: WorkspaceDetail,
});

type Workspace = {
  id: string;
  org_id: string;
  name: string;
  status: string;
  goal: string | null;
  channel: string | null;
  owner_id: string;
  updated_at: string;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
  kpi_label: string | null;
  kpi_target: number | null;
  kpi_actual: number | null;
  currency: string;
  is_sample?: boolean;
  campaign_type:
    | "product_launch"
    | "webinar"
    | "newsletter"
    | "paid_acquisition"
    | "event"
    | "content"
    | "other";
};

type Activity = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type StageOpt = { key: string; label: string; color: string; position: number };


type Tab = "plan" | "flow" | "assets" | "variants" | "results" | "settings";

function WorkspaceDetail() {
  const { id } = useParams({ from: "/_app/campaigns/$id" });
  const { user } = useAuth();
  const nav = useNavigate();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [counts, setCounts] = useState({ campaigns: 0, audiences: 0, lists: 0, utm: 0 });
  const [orgChannels, setOrgChannels] = useState<string[]>([
    "paid-search", "paid-social", "email", "organic", "partner", "display", "video", "content", "events",
  ]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [stageOpts, setStageOpts] = useState<StageOpt[]>([]);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [kpiLabel, setKpiLabel] = useState("");
  const [kpiActual, setKpiActual] = useState<string>("");
  const [kpiTarget, setKpiTarget] = useState<string>("");
  const [tab, setTab] = useState<Tab>("plan");
  const [retroOpen, setRetroOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const nameRef = useRef<HTMLTextAreaElement>(null);
  const autoFocusedRef = useRef(false);
  const initializedRef = useRef(false);
  const suggest = useServerFn(suggestChecklist);
  const buildPack = useServerFn(buildHandoffPack);
  const dispatch = useServerFn(dispatchWorkspaceEvent);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: w }, { data: act }, c, a, l, u, assetsRes, reviewsRes, assignRes] = await Promise.all([
        supabase.from("workspaces").select("*").eq("id", id).single(),
        supabase
          .from("workspace_activity")
          .select("id,kind,payload,created_at")
          .eq("workspace_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", id),
        supabase.from("audiences").select("id", { count: "exact", head: true }).eq("workspace_id", id),
        supabase.from("imported_lists").select("id", { count: "exact", head: true }).eq("workspace_id", id),
        supabase.from("utm_links").select("id", { count: "exact", head: true }).eq("workspace_id", id),
        supabase.from("workspace_assets").select("id").eq("workspace_id", id),
        supabase.from("asset_reviews").select("asset_id,reviewer_id,status").eq("workspace_id", id),
        supabase.from("asset_reviewer_assignments").select("asset_id,reviewer_id,required").eq("workspace_id", id),
      ]);
      if (cancelled) return;
      if (w) {
        setWs(w as Workspace);
        // Only initialize local input state on the first load. Otherwise
        // realtime echoes from our own autosaves would overwrite what the
        // user is currently typing and jump the cursor.
        if (!initializedRef.current) {
          initializedRef.current = true;
          setEditName(w.name);
          setEditGoal(w.goal ?? "");
          setKpiLabel(w.kpi_label ?? "");
          setKpiActual(w.kpi_target != null || w.kpi_actual != null ? String(w.kpi_actual ?? "") : "");
          setKpiTarget(w.kpi_target != null || w.kpi_actual != null ? String(w.kpi_target ?? "") : "");
        }
        // Pull the org's channel vocabulary so BudgetSection matches what the
        // rest of the app uses (campaign-name tool, calendar filter, Settings).
        if (w.org_id) {
          supabase
            .from("taxonomy_settings")
            .select("channels")
            .eq("org_id", w.org_id)
            .single()
            .then(({ data }) => {
              if (cancelled) return;
              const ch = data?.channels as string[] | null | undefined;
              if (ch && ch.length) setOrgChannels(ch);
            });
          supabase
            .from("campaign_stages")
            .select("key,label,color,position")
            .eq("org_id", w.org_id)
            .order("position", { ascending: true })
            .then(({ data }) => {
              if (cancelled) return;
              setStageOpts(((data as StageOpt[] | null) ?? []));
            });
        }
        if (!autoFocusedRef.current && (w.name === "Untitled workspace" || w.name === "Untitled campaign")) {
          autoFocusedRef.current = true;
          requestAnimationFrame(() => {
            nameRef.current?.focus();
            nameRef.current?.select();
          });
        }
      }
      setActivity((act as Activity[]) ?? []);
      setCounts({
        campaigns: c.count ?? 0,
        audiences: a.count ?? 0,
        lists: l.count ?? 0,
        utm: u.count ?? 0,
      });
      // pending = assets that fail their reviewer rule
      // rule: if asset has required reviewers, every required reviewer must have approved
      //       otherwise, at least one approval is needed.
      const allAssets = (assetsRes.data ?? []) as Array<{ id: string }>;
      const reviewsArr = (reviewsRes.data ?? []) as Array<{ asset_id: string; reviewer_id: string; status: string }>;
      const assignArr = (assignRes.data ?? []) as Array<{ asset_id: string; reviewer_id: string; required: boolean }>;
      const approvedKey = new Set(reviewsArr.filter((r) => r.status === "approved").map((r) => `${r.asset_id}:${r.reviewer_id}`));
      const approvedAssetIds = new Set(reviewsArr.filter((r) => r.status === "approved").map((r) => r.asset_id));
      const pending = allAssets.filter((x) => {
        const required = assignArr.filter((a) => a.asset_id === x.id && a.required);
        if (required.length === 0) return !approvedAssetIds.has(x.id);
        return !required.every((r) => approvedKey.has(`${x.id}:${r.reviewer_id}`));
      }).length;
      setPendingApprovals(pending);
    };
    load();

    const channel = supabase
      .channel(`workspace-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_activity", filter: `workspace_id=eq.${id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspaces", filter: `id=eq.${id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asset_reviews", filter: `workspace_id=eq.${id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asset_reviewer_assignments", filter: `workspace_id=eq.${id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_assets", filter: `workspace_id=eq.${id}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const save = async (patch: Partial<Workspace>) => {
    if (!ws || !user) return;
    // Status guard: cannot move to live from planning until all assets approved.
    if (
      patch.status === "live" &&
      ws.status === "planning" &&
      pendingApprovals > 0
    ) {
      toast.error(`${pendingApprovals} asset(s) still need approval before going live.`);
      return;
    }
    const prevStatus = ws.status;
    const scope = `campaign:${ws.id}`;
    reportAutosave(scope, "saving");
    const { error } = await supabase.from("workspaces").update(patch).eq("id", ws.id);
    if (error) {
      reportAutosave(scope, "error", error.message);
      toast.error(error.message);
      return;
    }
    reportAutosave(scope, "saved");
    await supabase.from("workspace_activity").insert({
      workspace_id: ws.id,
      org_id: ws.org_id,
      actor_id: user.id,
      kind: patch.status && patch.status !== prevStatus ? "workspace.status_changed" : "workspace.updated",
      payload: patch as never,
    });
    if (patch.status && patch.status !== prevStatus) {
      // fire-and-forget webhook
      dispatch({
        data: {
          workspaceId: ws.id,
          orgId: ws.org_id,
          event: "workspace.status_changed",
          payload: { from: prevStatus, to: patch.status, name: ws.name },
        },
      }).catch(() => undefined);
      if (patch.status === "complete") setRetroOpen(true);
    }
  };

  // Live autosave for free-text fields while typing.
  useAutosave({
    scope: ws ? `campaign:${ws.id}:name` : "campaign:new:name",
    value: editName,
    enabled: !!ws && editName.trim().length > 0 && editName !== ws?.name,
    onSave: async (v) => {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: v.trim() || "Untitled campaign" })
        .eq("id", ws!.id);
      if (error) throw new Error(error.message);
    },
  });
  useAutosave({
    scope: ws ? `campaign:${ws.id}:goal` : "campaign:new:goal",
    value: editGoal,
    enabled: !!ws && editGoal !== (ws?.goal ?? ""),
    onSave: async (v) => {
      const { error } = await supabase
        .from("workspaces")
        .update({ goal: v || null })
        .eq("id", ws!.id);
      if (error) throw new Error(error.message);
    },
  });
  useAutosave({
    scope: ws ? `campaign:${ws.id}:kpi_label` : "campaign:new:kpi_label",
    value: kpiLabel,
    enabled: !!ws && kpiLabel !== (ws?.kpi_label ?? ""),
    onSave: async (v) => {
      const { error } = await supabase
        .from("workspaces")
        .update({ kpi_label: v.trim() || null })
        .eq("id", ws!.id);
      if (error) throw new Error(error.message);
    },
  });
  useAutosave({
    scope: ws ? `campaign:${ws.id}:kpi_actual` : "campaign:new:kpi_actual",
    value: kpiActual,
    enabled: !!ws && kpiActual !== (ws?.kpi_actual == null ? "" : String(ws.kpi_actual)),
    onSave: async (v) => {
      const n = v.trim() === "" ? null : Number(v);
      if (n !== null && !Number.isFinite(n)) return;
      const { error } = await supabase
        .from("workspaces")
        .update({ kpi_actual: n })
        .eq("id", ws!.id);
      if (error) throw new Error(error.message);
    },
  });
  useAutosave({
    scope: ws ? `campaign:${ws.id}:kpi_target` : "campaign:new:kpi_target",
    value: kpiTarget,
    enabled: !!ws && kpiTarget !== (ws?.kpi_target == null ? "" : String(ws.kpi_target)),
    onSave: async (v) => {
      const n = v.trim() === "" ? null : Number(v);
      if (n !== null && !Number.isFinite(n)) return;
      const { error } = await supabase
        .from("workspaces")
        .update({ kpi_target: n })
        .eq("id", ws!.id);
      if (error) throw new Error(error.message);
    },
  });


  const runSuggestChecklist = async () => {
    if (!ws || !user) return;
    setAiBusy(true);
    try {
      const { items } = await suggest({
        data: { campaignType: ws.campaign_type, goal: ws.goal, channel: ws.channel },
      });
      const { data: existing } = await supabase
        .from("checklist_items")
        .select("position")
        .eq("workspace_id", ws.id)
        .order("position", { ascending: false })
        .limit(1);
      const startPos = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;
      await supabase.from("checklist_items").insert(
        items.map((title, i) => ({
          workspace_id: ws.id,
          org_id: ws.org_id,
          title,
          position: startPos + i,
          created_by: user.id,
        })),
      );
      toast.success(`Added ${items.length} checklist items`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  const exportPack = async () => {
    if (!ws) return;
    setExportBusy(true);
    try {
      const { filename, base64 } = await buildPack({ data: { workspaceId: ws.id } });
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  };

  const handoffs = [
    { focus: "campaign-creator", label: "Name Generator", Icon: IconCampaign, n: counts.campaigns },
    { focus: "campaign-import", label: "List import", Icon: IconImport, n: counts.lists },
    { focus: "utm", label: "UTM links", Icon: IconUtm, n: counts.utm },
  ] as const;

  if (!ws) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-glass/40" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-glass/40" />
            <div className="h-8 w-2/3 rounded bg-glass/40" />
            <div className="h-3 w-1/2 rounded bg-glass/30" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-glass-border bg-glass/30" />
          ))}
        </div>
        <div className="h-10 w-full max-w-md rounded-full bg-glass/30" />
        <div className="h-64 rounded-2xl border border-glass-border bg-glass/20" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <IconWorkspace size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <Link to="/campaigns" className="block text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
              Campaigns
            </Link>
            {ws.is_sample && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-accent-foreground">
                <span className="inline-block size-1.5 rounded-full bg-accent" />
                Sample · safe to delete
              </div>
            )}
            <div
              className="group mt-1 flex w-full items-start gap-2 rounded-lg -mx-2 px-2 py-1 text-left transition hover:bg-glass/40 focus-within:bg-glass/40 focus-within:ring-1 focus-within:ring-primary/40"
              onClick={() => nameRef.current?.focus()}
            >
              <textarea
                ref={nameRef}
                value={editName}
                rows={1}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => editName !== ws.name && save({ name: editName.trim() || "Untitled campaign" })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.currentTarget as HTMLTextAreaElement).blur();
                  }
                  if (e.key === "Escape") {
                    setEditName(ws.name);
                    (e.currentTarget as HTMLTextAreaElement).blur();
                  }
                }}
                placeholder="Name your campaign…"
                style={{ fieldSizing: "content" } as React.CSSProperties}
                className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent font-display text-2xl sm:text-3xl leading-tight text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
              <IconEdit
                size={16}
                className="mt-2 shrink-0 text-muted-foreground/70 transition group-hover:text-foreground"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:mr-[260px]">
          <button
            onClick={exportPack}
            disabled={exportBusy}
            className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-foreground hover:bg-glass disabled:opacity-50"
            title="Download handoff pack (.zip)"
          >
            <IconDownload size={12} /> {exportBusy ? "Building…" : "Export"}
          </button>
          <Select
            value={ws.status}
            onValueChange={(v) => save({ status: v })}
          >
            <SelectTrigger className="rounded-full glass border-glass-border px-3 py-1.5 text-xs uppercase tracking-wider h-auto w-auto gap-2 focus:border-primary/60 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(stageOpts.length ? stageOpts : [{ key: ws.status, label: ws.status, color: "zinc", position: 0 }]).map((s) => (
                <SelectItem key={s.key} value={s.key} className="text-xs uppercase tracking-wider">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-2 flex gap-1 overflow-x-auto border-b border-glass-border px-2">
        {(
          [
            { id: "plan", label: "Plan" },
            { id: "flow", label: "Flow" },
            { id: "assets", label: `Assets${pendingApprovals > 0 ? ` (${pendingApprovals})` : ""}` },
            { id: "variants", label: "Variants" },
            { id: "results", label: "Results" },
            { id: "settings", label: "Settings" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm transition",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "plan" && (
        <>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Goal</div>
            <textarea
              value={editGoal}
              onChange={(e) => setEditGoal(e.target.value)}
              onBlur={() => editGoal !== (ws.goal ?? "") && save({ goal: editGoal || null })}
              placeholder="What does this campaign need to achieve?"
              rows={2}
              className="field-glass mt-2 w-full resize-none rounded-lg px-3 py-2 text-base text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dates</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={ws.start_date ?? ""}
                  onChange={(e) => save({ start_date: e.target.value || null })}
                  className="field-glass w-full rounded-md px-2 py-1.5 text-xs"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="date"
                  value={ws.end_date ?? ""}
                  onChange={(e) => save({ end_date: e.target.value || null })}
                  className="field-glass w-full rounded-md px-2 py-1.5 text-xs"
                />
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Campaign type</div>
              <select
                value={ws.campaign_type}
                onChange={(e) => save({ campaign_type: e.target.value as Workspace["campaign_type"] })}
                className="field-glass mt-2 w-full rounded-md px-2 py-1.5 text-xs capitalize"
              >
                {["product_launch", "webinar", "newsletter", "paid_acquisition", "event", "content", "other"].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Primary KPI</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={kpiLabel}
                  onChange={(e) => setKpiLabel(e.target.value)}
                  placeholder="e.g. Signups"
                  className="field-glass min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  value={kpiActual}
                  onChange={(e) => setKpiActual(e.target.value)}
                  placeholder="0"
                  className="field-glass w-16 rounded-md px-2 py-1.5 text-right font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">/</span>
                <input
                  type="number"
                  value={kpiTarget}
                  onChange={(e) => setKpiTarget(e.target.value)}
                  placeholder="—"
                  className="field-glass w-16 rounded-md px-2 py-1.5 text-right font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={runSuggestChecklist}
              disabled={aiBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              <IconSpark size={12} /> {aiBusy ? "Thinking…" : "AI suggest checklist"}
            </button>
          </div>

          <ChecklistSection workspaceId={ws.id} orgId={ws.org_id} />

          <BudgetSection
            workspaceId={ws.id}
            orgId={ws.org_id}
            currency={ws.currency}
            channels={orgChannels}
          />

          <div>
            <h2 className="font-display text-xl">Tools in this campaign</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {handoffs.map((t) => (
                <Link
                  key={t.focus}
                  to="/tools"
                  search={{ focus: t.focus, workspace: ws.id }}
                  onClick={() => {
                    try { sessionStorage.setItem("cmd:active-workspace", ws.id); } catch { /* ignore */ }
                  }}
                >
                  <GlassPanel className="group flex items-center justify-between p-5 lift">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <t.Icon size={22} />
                      </span>
                      <div>
                        <div className="font-display text-base">{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.n} saved</div>
                      </div>
                    </div>
                    <IconArrowRight size={16} className="text-muted-foreground transition group-hover:translate-x-1" />
                  </GlassPanel>
                </Link>
              ))}
            </div>
          </div>

          <CommentsSection workspaceId={ws.id} orgId={ws.org_id} />

          <div>
            <h2 className="font-display text-xl">Activity</h2>
            <GlassPanel className="mt-3 divide-y divide-glass-border">
              {activity.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">No activity yet.</div>
              ) : (
                activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-4">
                    <IconCheck size={14} className="mt-1 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-foreground">{a.kind}</div>
                      {Object.keys(a.payload).length > 0 && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {JSON.stringify(a.payload)}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <IconClock size={11} /> {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </GlassPanel>
          </div>
        </>
      )}

      {tab === "flow" && (
        <Suspense fallback={<div className="h-[480px] rounded-2xl border border-glass-border bg-glass/30 animate-pulse" />}>
          <FlowCanvas workspaceId={ws.id} orgId={ws.org_id} />
        </Suspense>
      )}
      {tab === "assets" && <AssetsSection workspaceId={ws.id} orgId={ws.org_id} />}
      {tab === "variants" && <VariantsSection workspaceId={ws.id} orgId={ws.org_id} />}
      {tab === "results" && (
        <ResultsSection
          workspaceId={ws.id}
          orgId={ws.org_id}
          currency={ws.currency}
          plan={{
            budgetCents: 0,
            kpiLabel: ws.kpi_label,
            kpiTarget: ws.kpi_target,
            startDate: ws.start_date,
            endDate: ws.end_date,
          }}
        />
      )}
      {tab === "settings" && (
        <div className="space-y-8">
          <ShareSection workspaceId={ws.id} orgId={ws.org_id} />
          <WebhooksSection workspaceId={ws.id} orgId={ws.org_id} />
          <div className="pt-4 text-right">
            <button
              onClick={async () => {
                if (!confirm("Delete this workspace? Tool records will detach but be preserved.")) return;
                const { error } = await supabase.from("workspaces").delete().eq("id", ws.id);
                if (error) { toast.error(error.message); return; }
                toast.success("Workspace deleted");
                nav({ to: "/campaigns" });
              }}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Delete workspace
            </button>
          </div>
        </div>
      )}

      <RetroModal
        workspaceId={ws.id}
        orgId={ws.org_id}
        campaignType={ws.campaign_type}
        open={retroOpen}
        onClose={() => setRetroOpen(false)}
      />
    </div>
  );
}
