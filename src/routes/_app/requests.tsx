import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PanelError } from "@/components/ui-custom/PanelError";

import { IconClock, IconArrowRight, IconCheck, IconClose, IconPlus } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { promoteRequest } from "@/lib/promote-request.functions";
import { usePublicOrigin } from "@/lib/public-origin";
import { Link } from "@tanstack/react-router";
import { RequestForm } from "@/components/requests/RequestForm";

export const Route = createFileRoute("/_app/requests")({
  component: RequestsPage,
});

type Req = {
  id: string;
  org_id: string;
  requestor_name: string | null;
  requestor_email: string;
  brief: string;
  desired_due_date: string | null;
  template_id: string | null;
  status: "new" | "accepted" | "converted" | "declined";
  workspace_id: string | null;
  created_at: string;
};

function RequestsPage() {
  const orgId = useOrgId();
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Req[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const promote = useServerFn(promoteRequest);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const load = async () => {
      const [reqsRes, orgRes] = await Promise.all([
        supabase
          .from("campaign_requests")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false }),
        supabase.from("organizations").select("slug").eq("id", orgId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (reqsRes.error) {
        setLoadError(reqsRes.error.message);
        setItems(null);
      } else {
        setLoadError(null);
        setItems((reqsRes.data as Req[]) ?? []);
      }
      setOrgSlug(orgRes.data?.slug ?? null);
    };
    load();
    const ch = supabase
      .channel(`requests-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_requests", filter: `org_id=eq.${orgId}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [orgId, reloadKey]);


  const { origin: publicOrigin, isSet: publicUrlIsSet, loading: publicOriginLoading } = usePublicOrigin();
  const publicUrl = orgSlug && publicOrigin ? `${publicOrigin}/request/${orgSlug}` : null;
  const copyUrl = async () => {
    if (!publicUrl) return;
    await copyToClipboard(publicUrl);
    toast.success("Public request URL copied");
  };

  const accept = async (r: Req) => {
    if (!user) return;
    setBusy(r.id);
    try {
      const { workspaceId } = await promote({ data: { requestId: r.id } });
      toast.success("Campaign created");
      nav({ to: "/campaigns/$id", params: { id: workspaceId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not promote");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (r: Req) => {
    if (!confirm("Reject this request?")) return;
    await supabase.from("campaign_requests").update({ status: "declined" }).eq("id", r.id);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={340} size={26} icon={<IconClock size={22} />} aria-label="Campaign requests" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Inbox</div>
            <h1 className="mt-1 font-display text-4xl tracking-tight">Campaign requests</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Briefs submitted via your public request form. Accept to spawn a workspace pre-filled from the chosen template.
            </p>
          </div>
        </div>
        {publicUrl ? (
          <div className="flex items-center gap-2 rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs">
            <span className="font-mono text-muted-foreground">{publicUrl}</span>
            <button onClick={copyUrl} className="rounded-full bg-primary/20 px-2 py-0.5 text-primary hover:bg-primary/30">Copy</button>
          </div>
        ) : !publicOriginLoading && !publicUrlIsSet ? (
          <div className="flex max-w-sm items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span>
              Set your <Link to="/settings" className="underline">Public App URL</Link> in Settings to generate a shareable request link.
            </span>
          </div>
        ) : null}
      </div>

      <GlassPanel className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-glass/40"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <IconPlus size={16} />
            </span>
            <div>
              <div className="font-display text-base">New request</div>
              <div className="text-xs text-muted-foreground">Add a brief on behalf of a teammate or partner.</div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{showNew ? "Hide" : "Open"}</span>
        </button>
        {showNew && orgId && (
          <div className="border-t border-glass-border p-5">
            <RequestForm
              orgId={orgId}
              draftKey="requests:new:form"
              initialEmail={user?.email ?? undefined}
              submitLabel="Add request"
              onSubmitted={() => {
                toast.success("Request added");
                setShowNew(false);
                setReloadKey((k) => k + 1);
              }}
            />
          </div>
        )}
      </GlassPanel>

      {loadError ? (
        <PanelError message="Couldn't load requests" onRetry={() => setReloadKey((k) => k + 1)} />
      ) : items === null ? (
        <div className="text-muted-foreground">Loading…</div>

      ) : items.length === 0 ? (
        <GlassPanel className="p-10 text-center text-sm text-muted-foreground">
          No requests yet. Share your public request URL with anyone who needs marketing help.
        </GlassPanel>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <GlassPanel key={r.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    r.status === "new" ? "bg-amber-500/20 text-amber-400" :
                    r.status === "converted" ? "bg-primary/20 text-primary" :
                    r.status === "accepted" ? "bg-emerald-500/20 text-emerald-400" :
                    "bg-muted/40 text-muted-foreground line-through"
                  }`}>{r.status}</span>
                  <span className="text-muted-foreground">{r.requestor_name ?? r.requestor_email}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                    <IconClock size={11} /> {new Date(r.created_at).toLocaleDateString()}
                  </span>
                  {r.desired_due_date && (
                    <span className="text-muted-foreground/60">· due {r.desired_due_date}</span>
                  )}
                </div>
                <div className="mt-1.5 text-sm">{r.brief}</div>
              </div>
              {r.status === "new" && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => reject(r)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <IconClose size={12} /> Reject
                  </button>
                  <button
                    onClick={() => accept(r)}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <IconCheck size={12} /> {busy === r.id ? "Creating…" : "Accept"}
                  </button>
                </div>
              )}
              {r.status === "converted" && r.workspace_id && (
                <button
                  onClick={() => nav({ to: "/campaigns/$id", params: { id: r.workspace_id! } })}
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open workspace <IconArrowRight size={12} />
                </button>
              )}
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  );
}
