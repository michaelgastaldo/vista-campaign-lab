import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconPlus, IconClose } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { validatePublicHttpUrl } from "@/lib/webhook-url";

type Hook = {
  id: string;
  workspace_id: string | null;
  org_id: string;
  url: string;
  events: string[];
  active: boolean;
};

const HOOK_COLS = "id,workspace_id,org_id,url,events,active";

const ALL_EVENTS = ["workspace.status_changed", "asset.approved", "list.created", "variant.winner_picked"];

export function WebhooksSection({ workspaceId, orgId }: { workspaceId: string; orgId: string }) {
  const { user } = useAuth();
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("webhook_subscriptions")
        .select(HOOK_COLS)
        .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
        .eq("org_id", orgId);
      if (!cancelled) setHooks((data as Hook[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, orgId]);

  const add = async () => {
    if (!url.trim() || !user) return;
    const urlError = validatePublicHttpUrl(url);
    if (urlError) {
      toast.error(urlError);
      return;
    }
    const secret = crypto.getRandomValues(new Uint32Array(4)).join("");
    const { data, error } = await supabase
      .from("webhook_subscriptions")
      .insert({
        workspace_id: workspaceId,
        org_id: orgId,
        url: url.trim(),
        secret,
        events: ALL_EVENTS,
        created_by: user.id,
      })
      .select(HOOK_COLS)
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setHooks((cur) => [...cur, data as Hook]);
    setUrl("");
    toast.success("Webhook added");
  };

  const remove = async (id: string) => {
    setHooks((cur) => cur.filter((h) => h.id !== id));
    await supabase.from("webhook_subscriptions").delete().eq("id", id);
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="font-display text-xl">Outbound webhooks</h2>
        <div className="mt-1 text-xs text-muted-foreground">
          Notify Slack, Zapier, n8n, or your own service when this workspace changes.
        </div>
      </div>

      <GlassPanel className="divide-y divide-glass-border">
        {hooks.map((h) => (
          <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
            <span className={`size-2 shrink-0 rounded-full ${h.active ? "bg-primary" : "bg-muted-foreground/30"}`} />
            <span className="min-w-0 flex-1 truncate font-mono">{h.url}</span>
            <span className="hidden text-muted-foreground sm:inline">{h.events.length} events</span>
            <button onClick={() => remove(h.id)} className="text-muted-foreground/50 hover:text-destructive">
              <IconClose size={14} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <IconPlus size={14} className="text-muted-foreground" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="https://hooks.slack.com/…"
            className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/60"
          />
          {url.trim() && (
            <button onClick={add} className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">
              Add
            </button>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
