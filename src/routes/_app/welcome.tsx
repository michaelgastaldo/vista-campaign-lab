import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { useServerFn } from "@tanstack/react-start";
import { instantiateTemplate } from "@/lib/templates.functions";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { IconArrowRight, IconCheck, IconClose, IconLogo, IconPlus, IconCopy, IconSpark } from "@/components/ui-custom/CustomIcon";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { BRAND } from "@/lib/brand";
import { getCachedOnboardedAt, markOnboarded } from "@/hooks/use-onboarding-status";

type OrgRole = Database["public"]["Enums"]["org_role"];
type PendingInvite = { email: string; role: OrgRole };

const SAMPLE_PICKS = [
  { slug: "product-launch", label: "Product launch", hint: "4 weeks · checklist & budget" },
  { slug: "webinar", label: "Webinar", hint: "Promo → live → replay" },
  { slug: "newsletter", label: "Newsletter", hint: "Recurring single send" },
];

export const Route = createFileRoute("/_app/welcome")({
  component: Welcome,
});

const INDUSTRIES = [
  "SaaS / Software",
  "E-commerce",
  "Agency",
  "Media / Publisher",
  "Fintech",
  "Healthcare",
  "Education",
  "Nonprofit",
  "Other",
];

const CHANNELS = [
  "email",
  "paid-social",
  "paid-search",
  "organic",
  "content",
  "events",
  "partner",
  "display",
  "video",
  "sms",
  "podcast",
  "affiliate",
];

function Welcome() {
  const { user } = useAuth();
  const orgId = useOrgId();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState("");
  const [picked, setPicked] = useState<string[]>(["email", "paid-social", "organic"]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [sampleSlug, setSampleSlug] = useState<string | null>("product-launch");
  const instantiate = useServerFn(instantiateTemplate);

  // If already onboarded, bounce to dashboard
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const onboardedAt = await getCachedOnboardedAt(user.id);
      if (!cancelled && onboardedAt) nav({ to: "/dashboard", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, nav]);

  const togglePick = (c: string) =>
    setPicked((arr) => (arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c]));

  const addPending = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    if (pendingInvites.some((p) => p.email === email)) {
      toast.error("Already added");
      return;
    }
    setPendingInvites((arr) => [...arr, { email, role: inviteRole }]);
    setInviteEmail("");
    setInviteRole("member");
  };

  const removePending = (email: string) =>
    setPendingInvites((arr) => arr.filter((p) => p.email !== email));

  const finish = async (skipInvite = false) => {
    if (!user || !orgId) return;
    setSaving(true);
    try {
      if (industry) {
        await supabase.from("organizations").update({ industry }).eq("id", orgId);
      }
      if (picked.length) {
        await supabase
          .from("taxonomy_settings")
          .update({ channels: picked })
          .eq("org_id", orgId);
      }
      const queued: PendingInvite[] = skipInvite ? [] : [...pendingInvites];
      // Include the unsubmitted field as a last invite if valid
      if (!skipInvite) {
        const trailing = inviteEmail.trim().toLowerCase();
        if (trailing && trailing.includes("@") && !queued.some((p) => p.email === trailing)) {
          queued.push({ email: trailing, role: inviteRole });
        }
      }
      let firstToken: string | null = null;
      if (queued.length) {
        const rows = queued.map((p) => ({
          org_id: orgId,
          email: p.email,
          role: p.role,
          invited_by: user.id,
        }));
        const { data: created, error } = await supabase
          .from("org_invites")
          .insert(rows)
          .select("id");
        if (error) {
          toast.error(error.message);
          setSaving(false);
          return;
        }
        const firstId = created?.[0]?.id;
        if (firstId) {
          const { data: tok } = await supabase.rpc("get_org_invite_token", { _invite_id: firstId });
          if (tok) firstToken = tok as string;
        }
        toast.success(`${queued.length} invite${queued.length === 1 ? "" : "s"} created`);
      }
      await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", user.id);
      markOnboarded(user.id);
      if (firstToken) {
        const url = `${window.location.origin}/invite/${firstToken}`;
        await copyToClipboard(url).catch(() => {});
        setLastInviteUrl(url);
      }

      // Optional sample-campaign drop. If picked, route into the new workspace
      // so the first thing the user sees is a populated campaign — not an empty list.
      if (sampleSlug) {
        try {
          const res = await instantiate({ data: { slug: sampleSlug } });
          toast.success("Sample campaign loaded");
          nav({ to: "/campaigns/$id", params: { id: res.id }, replace: true });
          return;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not load sample");
        }
      }

      nav({ to: "/dashboard", replace: true });
    } finally {
      setSaving(false);
    }
  };
  void lastInviteUrl;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--color-ink)] text-foreground">
      <GradientMesh />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <IconLogo size={26} className="text-primary" />
            <span className="font-display text-lg">{BRAND.name}</span>
          </div>
          <button
            onClick={() => finish(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip setup →
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-all ${
                n <= step ? "bg-primary" : "bg-glass-border"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Step {step} of 4 · about 60 seconds
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              {step === 1 && (
                <GlassPanel tier="strong" className="p-6 md:p-8">
                  <h1 className="font-display text-3xl">What do you market?</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We'll tune the defaults so naming and tagging feel native.
                  </p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {INDUSTRIES.map((i) => {
                      const active = industry === i;
                      return (
                        <button
                          key={i}
                          onClick={() => setIndustry(i)}
                          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                            active
                              ? "border-primary/60 bg-primary/10 text-foreground"
                              : "border-glass-border bg-glass/30 text-muted-foreground hover:bg-glass-strong hover:text-foreground"
                          }`}
                        >
                          {i}
                          {active && <IconCheck size={16} className="text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </GlassPanel>
              )}

              {step === 2 && (
                <GlassPanel tier="strong" className="p-6 md:p-8">
                  <h1 className="font-display text-3xl">Pick your channels.</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    These pre-fill every campaign, UTM, and audience field. Add or
                    remove later in Settings.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {CHANNELS.map((c) => {
                      const active = picked.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() => togglePick(c)}
                          className={`rounded-full border px-4 py-2 font-mono text-xs transition ${
                            active
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-glass-border bg-glass/30 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    {picked.length} selected
                  </div>
                </GlassPanel>
              )}

              {step === 3 && (
                <GlassPanel tier="strong" className="p-6 md:p-8">
                  <h1 className="font-display text-3xl">Invite teammates.</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add anyone who'll work in this workspace. They'll get a private link to join with the role you choose.
                  </p>

                  <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPending();
                        }
                      }}
                      placeholder="teammate@company.com"
                      className="flex-1 rounded-xl border border-glass-border bg-glass/30 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                    />
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                      <SelectTrigger className="h-12 w-full rounded-xl border-glass-border bg-glass/30 sm:w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={addPending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-glass-border bg-glass/40 px-4 py-3 text-sm hover:bg-glass-strong"
                    >
                      <IconPlus size={14} /> Add
                    </button>
                  </div>

                  {pendingInvites.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {pendingInvites.map((p) => (
                        <div
                          key={p.email}
                          className="flex items-center justify-between rounded-xl border border-glass-border bg-glass/20 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm">{p.email}</div>
                            <div className="text-[11px] capitalize text-muted-foreground">{p.role}</div>
                          </div>
                          <button
                            onClick={() => removePending(p.email)}
                            className="rounded-full p-1.5 text-muted-foreground hover:bg-glass-strong hover:text-foreground"
                          >
                            <IconClose size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <IconCopy size={11} /> We'll copy the first invite link to your clipboard so you can share it right away.
                  </p>
                </GlassPanel>
              )}

              {step === 4 && (
                <GlassPanel tier="strong" className="p-6 md:p-8">
                  <h1 className="font-display text-3xl">Want a sample campaign?</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We'll seed a workspace with a goal, checklist, budget, and KPI so the app isn't a blank slate. Delete it any time — sample campaigns are clearly badged.
                  </p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    {SAMPLE_PICKS.map((p) => {
                      const active = sampleSlug === p.slug;
                      return (
                        <button
                          key={p.slug}
                          onClick={() => setSampleSlug(active ? null : p.slug)}
                          className={`group rounded-xl border p-3 text-left transition ${
                            active
                              ? "border-primary/60 bg-primary/10"
                              : "border-glass-border bg-glass/30 hover:border-primary/40 hover:bg-glass-strong"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{p.label}</div>
                            {active ? <IconCheck size={14} className="text-primary" /> : <IconSpark size={12} className="text-muted-foreground" />}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{p.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setSampleSlug(null)}
                    className={`mt-4 text-[11px] transition ${
                      sampleSlug === null ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sampleSlug === null ? "Starting empty" : "No thanks, start empty"}
                  </button>
                </GlassPanel>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            ← Back
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 1 && !industry) || (step === 2 && picked.length === 0)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Continue <IconArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => finish(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Setting up…" : sampleSlug ? "Load sample & enter" : `Enter ${BRAND.name}`} <IconArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
