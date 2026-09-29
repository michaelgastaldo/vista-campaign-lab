import { useEffect, useState } from "react";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconCopy, IconPlus, IconClose } from "@/components/ui-custom/CustomIcon";
import { mintShareToken } from "@/lib/share-token";
import { toast } from "sonner";

type Link = {
  id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  click_count: number;
  created_at: string;
};

export function ShareSection({ workspaceId, orgId }: { workspaceId: string; orgId: string }) {
  const { user } = useAuth();
  const [links, setLinks] = useState<Link[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("workspace_share_links")
      .select("id,token,label,expires_at,click_count,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setLinks((data ?? []) as Link[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const create = async () => {
    if (!user) return;
    setBusy(true);
    const token = mintShareToken();
    const { error } = await supabase.from("workspace_share_links").insert({
      org_id: orgId,
      workspace_id: workspaceId,
      created_by: user.id,
      token,
      label: label.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLabel("");
    toast.success("Share link created");
    load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("workspace_share_links").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Revoked");
      load();
    }
  };

  const copy = (token: string) => {
    const url = `${window.location.origin}/w/${token}`;
    copyToClipboard(url);
    toast.success("Link copied");
  };

  return (
    <GlassPanel className="space-y-4 p-5">
      <div>
        <div className="font-display text-lg">Share read-only</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Generate a link anyone can open without signing in. Shows goal, status, KPIs — no internal data.
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. exec readout)"
          className="flex-1 rounded-full border border-glass-border bg-glass/30 px-4 py-1.5 text-sm outline-none focus:border-primary/60"
        />
        <button
          onClick={create}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <IconPlus size={14} /> New link
        </button>
      </div>
      {links.length === 0 ? (
        <div className="rounded-lg border border-dashed border-glass-border p-4 text-center text-xs text-muted-foreground">
          No share links yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-lg border border-glass-border bg-glass/30 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{l.label || "Untitled"}</div>
                <div className="font-mono text-[11px] text-muted-foreground">/w/{l.token}</div>
              </div>
              <div className="text-[11px] text-muted-foreground">{l.click_count} views</div>
              <button
                onClick={() => copy(l.token)}
                className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-1 text-[11px] hover:bg-glass-strong"
              >
                <IconCopy size={11} /> Copy
              </button>
              <button
                onClick={() => revoke(l.id)}
                className="rounded-full border border-glass-border p-1.5 text-muted-foreground hover:text-foreground"
                title="Revoke"
              >
                <IconClose size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
