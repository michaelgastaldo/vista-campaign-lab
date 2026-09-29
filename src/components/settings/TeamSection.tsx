import { useCallback, useEffect, useMemo, useState } from "react";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconCheck, IconClose, IconCopy, IconPlus } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type OrgRole = Database["public"]["Enums"]["org_role"];

interface Member {
  id: string;
  user_id: string;
  role: OrgRole;
  full_name: string | null;
  email: string | null;
}
interface Invite {
  id: string;
  email: string;
  role: OrgRole;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const INVITABLE: OrgRole[] = ["member", "admin"];
const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function TeamSection({ orgId }: { orgId: string | null }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [myRole, setMyRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<OrgRole>("member");
  const [sending, setSending] = useState(false);

  const canManage = myRole === "owner" || myRole === "admin";

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [{ data: rawMembers }, { data: rawInvites }] = await Promise.all([
      supabase
        .from("org_members")
        .select("id, user_id, role")
        .eq("org_id", orgId),
      supabase
        .from("org_invites")
        .select("id, email, role, expires_at, accepted_at, created_at")
        .eq("org_id", orgId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    // Fetch profile display names
    const memberRows = rawMembers ?? [];
    const ids = memberRows.map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string | null }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const enriched: Member[] = memberRows.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role as OrgRole,
      full_name: profileMap.get(m.user_id) ?? null,
      email: m.user_id === user?.id ? user?.email ?? null : null,
    }));
    setMembers(enriched);
    setInvites((rawInvites ?? []) as Invite[]);
    setMyRole(
      (enriched.find((m) => m.user_id === user?.id)?.role as OrgRole) ?? null,
    );
    setLoading(false);
  }, [orgId, user?.id, user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const inviteUrl = useCallback(
    (token: string) => `${window.location.origin}/invite/${token}`,
    [],
  );

  const sendInvite = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    if (!orgId || !user) return;
    setSending(true);
    const { data: inserted, error } = await supabase
      .from("org_invites")
      .insert({
        org_id: orgId,
        email,
        role: newRole,
        invited_by: user.id,
      })
      .select("id")
      .single();
    if (error) {
      setSending(false);
      toast.error(error.message.includes("duplicate") ? "Invite already pending for that email" : error.message);
      return;
    }
    setNewEmail("");
    setNewRole("member");
    await load();
    const { data: token } = inserted?.id
      ? await supabase.rpc("get_org_invite_token", { _invite_id: inserted.id })
      : { data: null as string | null };
    const link = token ? inviteUrl(token) : "";

    // Always copy the link as a fallback / convenience
    if (link) {
      await copyToClipboard(link).catch(() => {});
    }

    // Fetch org name + inviter name for the email body
    let orgName = "your workspace";
    let inviterName = user.user_metadata?.full_name || user.email || "A teammate";
    try {
      const [{ data: org }, { data: prof }] = await Promise.all([
        supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      if (org?.name) orgName = org.name;
      if (prof?.full_name) inviterName = prof.full_name;
    } catch {
      // best-effort enrichment only
    }

    // Send the invite email through Lovable transactional pipeline
    let emailSent = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken && link) {
        const res = await fetch("/lovable/email/transactional/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            templateName: "invite",
            recipientEmail: email,
            templateData: {
              siteUrl: window.location.origin,
              confirmationUrl: link,
              orgName,
              inviterName,
            },
          }),
        });
        const json = await res.json().catch(() => ({}));
        emailSent = res.ok && json?.success !== false;
      }
    } catch {
      emailSent = false;
    }

    setSending(false);
    if (emailSent) {
      toast.success(`Invite sent to ${email}`);
    } else {
      toast.warning("Invite link copied (email failed to send)");
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("org_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    load();
  };

  const copy = async (inviteId: string) => {
    const { data: token, error } = await supabase.rpc("get_org_invite_token", { _invite_id: inviteId });
    if (error || !token) {
      toast.error("Couldn't fetch invite link");
      return;
    }
    await copyToClipboard(inviteUrl(token));
    toast.success("Invite link copied");
  };

  const changeRole = async (memberId: string, role: OrgRole) => {
    const { error } = await supabase
      .from("org_members")
      .update({ role })
      .eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  };

  const removeMember = async (m: Member) => {
    if (m.user_id === user?.id) return toast.error("You can't remove yourself");
    const { error } = await supabase.from("org_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    load();
  };

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const rank = (r: OrgRole) => (r === "owner" ? 0 : r === "admin" ? 1 : 2);
        return rank(a.role) - rank(b.role);
      }),
    [members],
  );

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl">Team</h2>
            <p className="text-sm text-muted-foreground">
              Invite teammates and manage their access to this workspace.
            </p>
          </div>
        </div>

        {canManage && (
          <div className="mb-6 flex flex-col gap-2 rounded-xl border border-glass-border bg-glass/30 p-3 sm:flex-row">
            <input
              type="email"
              placeholder="teammate@company.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendInvite();
              }}
              className="flex-1 rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
            />
            <Select value={newRole} onValueChange={(v) => setNewRole(v as OrgRole)}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={sendInvite}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <IconPlus size={14} /> {sending ? "Creating…" : "Invite"}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Members ({sortedMembers.length})
          </div>
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-glass/30" />
          ) : (
            sortedMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-glass-border bg-glass/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {m.full_name ?? "Teammate"}{" "}
                    {m.user_id === user?.id && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                  {m.email && (
                    <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canManage && m.role !== "owner" && m.user_id !== user?.id ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) => changeRole(m.id, v as OrgRole)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVITABLE.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="rounded-full border border-glass-border bg-glass/40 px-3 py-1 text-xs">
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                  {canManage && m.role !== "owner" && m.user_id !== user?.id && (
                    <button
                      onClick={() => removeMember(m)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-glass-strong hover:text-foreground"
                      title="Remove"
                    >
                      <IconClose size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {invites.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Pending invites ({invites.length})
            </div>
            {invites.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              return (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-glass-border bg-glass/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {ROLE_LABEL[inv.role]} ·{" "}
                      {expired
                        ? "Expired"
                        : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copy(inv.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs hover:bg-glass-strong"
                    >
                      <IconCopy size={12} /> Copy link
                    </button>
                    {canManage && (
                      <button
                        onClick={() => revoke(inv.id)}
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-glass-strong hover:text-foreground"
                        title="Revoke"
                      >
                        <IconClose size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!canManage && (
          <p className="mt-4 text-xs text-muted-foreground">
            Only owners and admins can invite or manage teammates.
          </p>
        )}
      </GlassPanel>
    </div>
  );
}

// Suppress unused import warning when icons not all referenced (kept for clarity)
void IconCheck;
