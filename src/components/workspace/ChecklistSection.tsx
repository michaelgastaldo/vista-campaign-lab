import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconPlus, IconClose, IconClock } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  workspace_id: string;
  org_id: string;
  title: string;
  done: boolean;
  due_at: string | null;
  owner_id: string | null;
  position: number;
  depends_on: string[];
};

type Member = { user_id: string; full_name: string | null };

export function ChecklistSection({
  workspaceId,
  orgId,
}: {
  workspaceId: string;
  orgId: string;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: rows }, { data: mems }] = await Promise.all([
        supabase
          .from("checklist_items")
          .select("id,workspace_id,org_id,title,done,due_at,owner_id,position,depends_on")
          .eq("workspace_id", workspaceId)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase.from("org_members").select("user_id").eq("org_id", orgId),
      ]);
      if (cancelled) return;
      setItems((rows as Item[]) ?? []);
      const userIds = ((mems as Array<{ user_id: string }>) ?? []).map((m) => m.user_id);
      if (userIds.length === 0) {
        setMembers([]);
      } else {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        if (cancelled) return;
        setMembers(
          ((profs as Array<{ id: string; full_name: string | null }>) ?? []).map((p) => ({
            user_id: p.id,
            full_name: p.full_name,
          })),
        );
      }
    };
    load();
    const ch = supabase
      .channel(`checklist-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checklist_items",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [workspaceId, orgId]);

  const add = async () => {
    const title = draft.trim();
    if (!title || !user) return;
    setDraft("");
    const position = items.length;
    // optimistic
    const tempId = `temp-${Date.now()}`;
    setItems((cur) => [
      ...cur,
      {
        id: tempId,
        workspace_id: workspaceId,
        org_id: orgId,
        title,
        done: false,
        due_at: null,
        owner_id: null,
        position,
        depends_on: [],
      },
    ]);
    const { error } = await supabase.from("checklist_items").insert({
      workspace_id: workspaceId,
      org_id: orgId,
      title,
      position,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
  };

  const update = async (id: string, patch: Partial<Item>) => {
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("checklist_items").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    setItems((cur) => cur.filter((i) => i.id !== id));
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const completed = items.filter((i) => i.done).length;
  const pct = items.length === 0 ? 0 : Math.round((completed / items.length) * 100);

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Launch checklist</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {items.length === 0 ? "Add the first task to get started." : `${completed} of ${items.length} done · ${pct}%`}
          </div>
        </div>
        {items.length > 0 && (
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <GlassPanel className="divide-y divide-glass-border">
        {items.map((it, idx) => {
          const owner = members.find((m) => m.user_id === it.owner_id);
          const overdue = it.due_at && !it.done && new Date(it.due_at) < new Date();
          return (
            <div key={it.id} className="group relative px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums",
                    it.done
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-glass-border bg-glass/40 text-muted-foreground",
                  )}
                >
                  {idx + 1}
                </span>
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={(e) => update(it.id, { done: e.target.checked })}
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                />
                <input
                  value={it.title}
                  onChange={(e) =>
                    setItems((cur) =>
                      cur.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)),
                    )
                  }
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== it.title) update(it.id, { title: v });
                  }}
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-sm outline-none",
                    it.done && "text-muted-foreground line-through",
                  )}
                />
                <select
                  value={it.owner_id ?? ""}
                  onChange={(e) => update(it.id, { owner_id: e.target.value || null })}
                  className="hidden shrink-0 rounded-md border border-glass-border bg-background/40 px-2 py-1 text-xs text-muted-foreground outline-none focus:border-primary/50 sm:block"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name ?? "Member"}
                    </option>
                  ))}
                </select>
                {owner && (
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">
                    {owner.full_name?.split(" ")[0] ?? "Member"}
                  </span>
                )}
                <input
                  type="date"
                  value={it.due_at ? it.due_at.slice(0, 10) : ""}
                  onChange={(e) =>
                    update(it.id, {
                      due_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className={cn(
                    "shrink-0 rounded-md border border-glass-border bg-background/40 px-2 py-1 text-xs outline-none focus:border-primary/50",
                    overdue ? "text-destructive" : "text-muted-foreground",
                  )}
                />
                <button
                  onClick={() => remove(it.id)}
                  className="shrink-0 text-muted-foreground/50 opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <IconClose size={14} />
                </button>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <IconPlus size={16} className="shrink-0 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add a checklist item…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 outline-none"
          />
          {draft.trim() && (
            <button
              onClick={add}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              Add
            </button>
          )}
        </div>
      </GlassPanel>

      {items.some((i) => i.due_at && !i.done && new Date(i.due_at!) < new Date()) && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive">
          <IconClock size={11} /> Overdue items need attention
        </div>
      )}
    </div>
  );
}
