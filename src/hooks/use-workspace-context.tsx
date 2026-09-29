import { useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { IconWorkspace, IconClose } from "@/components/ui-custom/CustomIcon";

/**
 * Reads ?workspace=<id> from the URL (falls back to sessionStorage), validates
 * the user can see it, and exposes a small banner + an `attach` helper that
 * tools can spread into inserts. Also logs activity when records are created.
 */
export function useWorkspaceContext(toolKey: string) {
  const { user } = useAuth();
  // `useSearch` is route-strict; we read from the current route loosely
  const search = useSearch({ strict: false }) as { workspace?: string };
  const workspaceParam = search.workspace;
  const nav = useNavigate();
  const [wsId, setWsId] = useState<string | null>(null);
  const [wsName, setWsName] = useState<string | null>(null);

  useEffect(() => {
    const candidate =
      workspaceParam ??
      (typeof window !== "undefined" ? sessionStorage.getItem("cmd:active-workspace") : null);
    if (!candidate || !user) {
      setWsId(null);
      setWsName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("workspaces").select("id,name").eq("id", candidate).single();
      if (cancelled) return;
      if (data) {
        setWsId(data.id);
        setWsName(data.name);
      } else {
        setWsId(null);
        setWsName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceParam, user?.id]);

  const detach = useCallback(() => {
    try {
      sessionStorage.removeItem("cmd:active-workspace");
    } catch {
      /* ignore */
    }
    nav({ search: { workspace: undefined } as never, replace: true });
  }, [nav]);

  const logActivity = useCallback(
    async (orgId: string, kind: string, payload: Record<string, unknown>) => {
      if (!wsId || !user) return;
      await supabase.from("workspace_activity").insert({
        workspace_id: wsId,
        org_id: orgId,
        actor_id: user.id,
        kind: `${toolKey}.${kind}`,
        payload: payload as never,
      });
      // bump workspace timestamp so dashboards re-sort
      await supabase.from("workspaces").update({ updated_at: new Date().toISOString() }).eq("id", wsId);
    },
    [toolKey, user, wsId],
  );

  const attach = useMemo(() => (wsId ? { workspace_id: wsId } : {}), [wsId]);

  // Fragile: tool pages spread this object into mutations and use these
  // callbacks in effects. Keep identities stable unless the actual workspace
  // changes, otherwise route navigation gets a second render pass.
  return useMemo(
    () => ({
      workspaceId: wsId,
      workspaceName: wsName,
      attach,
      logActivity,
      detach,
    }),
    [attach, detach, logActivity, wsId, wsName],
  );
}

export function WorkspaceBanner({
  workspaceId,
  workspaceName,
  onDetach,
}: {
  workspaceId: string | null;
  workspaceName: string | null;
  onDetach: () => void;
}) {
  if (!workspaceId || !workspaceName) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-2.5 text-foreground">
        <IconWorkspace size={16} className="text-primary" />
        <span className="text-muted-foreground">Saving into</span>
        <Link
          to="/campaigns/$id"
          params={{ id: workspaceId }}
          className="truncate font-medium hover:underline"
        >
          {workspaceName}
        </Link>
      </div>
      <button
        onClick={onDetach}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-glass-strong hover:text-foreground"
        aria-label="Detach campaign"
      >
        <IconClose size={12} /> detach
      </button>
    </div>
  );
}
