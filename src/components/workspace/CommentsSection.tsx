import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconClose } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";

type Comment = {
  id: string;
  body: string;
  author_id: string;
  mentions: string[];
  created_at: string;
};
type Member = { user_id: string; full_name: string | null };

export function CommentsSection({ workspaceId, orgId }: { workspaceId: string; orgId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase
        .from("workspace_comments")
        .select("id,body,author_id,mentions,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      supabase
        .from("org_members")
        .select("user_id, profiles:user_id(full_name)")
        .eq("org_id", orgId),
    ]);
    setItems((c ?? []) as Comment[]);
    setMembers(
      (m ?? []).map((x: any) => ({
        user_id: x.user_id,
        full_name: x.profiles?.full_name ?? null,
      })),
    );
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`comments:${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_comments", filter: `workspace_id=eq.${workspaceId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, orgId]);

  const nameById = (id: string) => members.find((m) => m.user_id === id)?.full_name ?? "Teammate";

  const post = async () => {
    if (!user || !body.trim()) return;
    setBusy(true);
    const mentionMatches = Array.from(body.matchAll(/@([\w-]+)/g)).map((m) => m[1].toLowerCase());
    const mentioned = members
      .filter((m) =>
        mentionMatches.some((needle) =>
          (m.full_name ?? "").toLowerCase().split(/\s+/).join("-").includes(needle),
        ),
      )
      .map((m) => m.user_id);
    const { error } = await supabase.from("workspace_comments").insert({
      org_id: orgId,
      workspace_id: workspaceId,
      author_id: user.id,
      body: body.trim(),
      mentions: mentioned,
    });
    if (!error) {
      await supabase.from("workspace_activity").insert({
        workspace_id: workspaceId,
        org_id: orgId,
        actor_id: user.id,
        kind: "comment.posted",
        payload: { mentions: mentioned.length },
      });
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else setBody("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("workspace_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <GlassPanel className="space-y-4 p-5">
      <div>
        <div className="font-display text-lg">Comments</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Use @first-last to mention teammates. Updates in realtime.
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-glass-border p-4 text-center text-xs text-muted-foreground">
            No comments yet.
          </div>
        )}
        {items.map((c) => (
          <div key={c.id} className="group rounded-lg border border-glass-border bg-glass/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{nameById(c.author_id)}</span>
              <span>·</span>
              <span>{new Date(c.created_at).toLocaleString()}</span>
              {c.author_id === user?.id && (
                <button
                  onClick={() => remove(c.id)}
                  className="ml-auto opacity-0 transition group-hover:opacity-100"
                  title="Delete"
                >
                  <IconClose size={12} />
                </button>
              )}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{c.body}</div>
            {c.mentions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {c.mentions.map((id) => (
                  <span key={id} className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                    @{nameById(id)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Write a comment… use @name to mention"
          className="w-full resize-none rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
        <div className="flex justify-end">
          <button
            onClick={post}
            disabled={busy || !body.trim()}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}
