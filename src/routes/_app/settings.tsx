import { createFileRoute, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type TabId = "organization" | "team" | "account";
const TAB_IDS: TabId[] = ["organization", "team", "account"];
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import { PanelError } from "@/components/ui-custom/PanelError";

import {
  IconSettings,
  IconCampaign,
  IconUtm,
  IconLogout,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { ArrowRight, Layers } from "lucide-react";
import { Users as IconUsers } from "lucide-react";
import { TeamSection } from "@/components/settings/TeamSection";
import { ThemeToggle } from "@/components/ui-custom/ThemeToggle";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (s: Record<string, unknown>): { tab?: TabId } => {
    const raw = typeof s.tab === "string" ? s.tab : "";
    const mapped: TabId | undefined = (TAB_IDS as string[]).includes(raw)
      ? (raw as TabId)
      : raw === "naming" || raw === "utm" || raw === "activity" || raw === "vocabulary"
        ? "organization"
        : undefined;
    return mapped ? { tab: mapped } : {};
  },
  component: Settings,
});

const DEFAULT_TAX_CHANNELS = ["paid-search", "paid-social", "email", "organic", "partner", "display", "video", "content", "events"];
const DEFAULT_TAX_AUDIENCES = ["enterprise", "midmarket", "smb", "developer", "executive"];
const DEFAULT_UTM = {
  sources: ["google", "facebook", "linkedin", "twitter", "newsletter", "partner", "direct"],
  mediums: ["cpc", "social", "email", "banner", "referral", "organic", "affiliate"],
  campaigns: ["spring-launch", "webinar", "product-launch", "retargeting"],
};

type CampaignTypeRow = { category: string; label: string };

type Summary = {
  channels: string[];
  audiences: string[];
  sources: string[];
  mediums: string[];
  campaigns: string[];
  campaignTypes: CampaignTypeRow[];
};

type OrgStats = {
  memberCount: number;
  inviteCount: number;
};

function Settings() {
  const { user, signOut } = useAuth();
  const search = useSearch({ from: "/_app/settings" });
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [fullName, setFullName] = useState("");
  const tab: TabId = search.tab ?? "organization";
  const setTab = (next: TabId) =>
    navigate({ to: "/settings", search: next === "organization" ? {} : { tab: next }, replace: true });

  const [summary, setSummary] = useState<Summary | null>(null);
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      setLoading(true);
      setLoadError(null);
      try {
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("default_org_id, full_name")
          .eq("id", user.id)
          .single();
        if (cancelled) return;
        if (pErr) throw pErr;
        if (p?.full_name) setFullName(p.full_name);
        if (!p?.default_org_id) {
          setLoading(false);
          return;
        }
        setOrgId(p.default_org_id);
        const [orgRes, tRes, uRes, ctRes, memberRes, inviteRes] = await Promise.all([
          supabase.from("organizations").select("name, slug").eq("id", p.default_org_id).single(),
          supabase.from("taxonomy_settings").select("channels, audiences").eq("org_id", p.default_org_id).single(),
          supabase.from("utm_settings").select("sources, mediums, campaigns").eq("org_id", p.default_org_id).single(),
          supabase.from("org_campaign_types").select("category, label").eq("org_id", p.default_org_id).eq("archived", false).order("category").order("position"),
          supabase.from("org_members").select("id", { count: "exact", head: true }).eq("org_id", p.default_org_id),
          supabase.from("org_invites").select("id", { count: "exact", head: true }).eq("org_id", p.default_org_id).is("accepted_at", null),
        ]);
        if (cancelled) return;
        // Treat taxonomy/utm errors as hard errors — otherwise we'd render
        // hardcoded DEFAULT_TAX_CHANNELS/DEFAULT_UTM as if they were saved.
        const firstErr = tRes.error ?? uRes.error ?? ctRes.error ?? orgRes.error ?? memberRes.error ?? inviteRes.error;
        if (firstErr) throw firstErr;
        const org = orgRes.data;
        const t = tRes.data;
        const u = uRes.data;
        const ct = ctRes.data;
        if (org) {
          setOrgName(org.name ?? "");
          setOrgSlug(org.slug ?? "");
        }
        setSummary({
          channels: (t?.channels as string[]) ?? DEFAULT_TAX_CHANNELS,
          audiences: (t?.audiences as string[]) ?? DEFAULT_TAX_AUDIENCES,
          sources: (u?.sources as string[]) ?? DEFAULT_UTM.sources,
          mediums: (u?.mediums as string[]) ?? DEFAULT_UTM.mediums,
          campaigns: (u?.campaigns as string[]) ?? DEFAULT_UTM.campaigns,
          campaignTypes: (ct as CampaignTypeRow[] | null) ?? [],
        });
        setStats({ memberCount: memberRes.count ?? 0, inviteCount: inviteRes.count ?? 0 });
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Couldn't load settings");
        setSummary(null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, reloadKey]);


  return (
    <div className="space-y-8 pb-16">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={88} size={26} icon={<IconSettings size={22} />} aria-label="Settings" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</div>
            <h1 className="mt-1 font-display text-4xl tracking-tight">{orgName || "Organization"}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Organization, teammates, vocabulary, and your account — in one place.
            </p>
          </div>
        </div>
        {stats && (
          <div className="flex flex-wrap items-center gap-2">
            <StatChip label="Members" value={String(stats.memberCount)} />
            <StatChip label="Pending invites" value={String(stats.inviteCount)} muted={stats.inviteCount === 0} />
            {orgSlug && <StatChip label="Slug" value={orgSlug} mono />}
          </div>
        )}
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-glass-border bg-glass/40 p-1">
        {[
          { id: "organization", label: "Organization", Icon: IconSettings },
          { id: "team", label: "Team", Icon: IconUsers },
          { id: "account", label: "Account", Icon: IconLogout },
        ].map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id as TabId)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-glass-strong hover:text-foreground"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <GlassSkeleton rows={6} />
      ) : loadError && tab === "organization" ? (
        <PanelError message="Couldn't load settings" onRetry={() => setReloadKey((k) => k + 1)} />
      ) : tab === "organization" ? (
        <OrganizationTab summary={summary} orgId={orgId} />

      ) : tab === "team" ? (
        <TeamSection orgId={orgId} />
      ) : (
        <AccountTab email={user?.email ?? ""} fullName={fullName} orgName={orgName} signOut={signOut} />
      )}

    </div>
  );
}

function StatChip({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass/50 px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? "font-mono text-xs" : ""} ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

// ───────────────────────── Organization tab ─────────────────────────
function OrganizationTab({ summary, orgId }: { summary: Summary | null; orgId: string | null }) {

  if (!summary) return null;

  const eventTypes = summary.campaignTypes.filter((c) => c.category === "event");
  const webinarTypes = summary.campaignTypes.filter((c) => c.category === "webinar");
  const otherTypes = summary.campaignTypes.filter((c) => c.category === "other");

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-glass-border bg-glass/40 backdrop-blur-xl">
        {/* Header band */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-glass-border p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Organization vocabulary</span>
            </div>
            <h2 className="font-display text-2xl text-foreground">Vocabulary</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Standardized taxonomy used across {BRAND.name}. These lists feed Campaign name, the UTM builder, and the Campaign Creator.
            </p>
          </div>
          <span className="rounded-full border border-glass-border bg-glass px-3 py-1 text-[10px] font-medium text-muted-foreground">
            Org-wide
          </span>
        </div>

        {/* Registry grid */}
        <div className="grid grid-cols-1 divide-y divide-glass-border md:grid-cols-3 md:divide-y-0 md:divide-x">
          <VocabColumn
            accent="text-primary"
            Icon={IconCampaign}
            title="Campaign naming"
            blurb="Channels & audiences"
            focus="utm-campaign-name"
          >
            <ListGroup label={`ENUM.CHANNELS · ${summary.channels.length}`}>
              <PillList values={summary.channels} tone="primary" />
            </ListGroup>
            <ListGroup label={`ENUM.AUDIENCES · ${summary.audiences.length}`}>
              <PillList values={summary.audiences} tone="muted" />
            </ListGroup>
          </VocabColumn>

          <VocabColumn
            accent="text-emerald-400"
            Icon={IconUtm}
            title="UTM tracking"
            blurb="Traffic attribution logic"
            focus="utm"
            tinted
          >
            <ListGroup label={`SCHEMA.SOURCES · ${summary.sources.length}`}>
              <DotPillGrid values={summary.sources} />
            </ListGroup>
            <ListGroup label={`SCHEMA.MEDIUMS · ${summary.mediums.length}`}>
              <PillList values={summary.mediums} tone="muted" />
            </ListGroup>
            <ListGroup label={`SCHEMA.SAVED · ${summary.campaigns.length}`}>
              <PillList values={summary.campaigns} tone="muted" />
            </ListGroup>
          </VocabColumn>

          <VocabColumn
            accent="text-orange-400"
            Icon={Layers}
            title="Campaign types"
            blurb="Global event taxonomy"
            focus="utm-taxonomy"
          >
            <div className="relative">
              <div className="absolute bottom-0 left-[7px] top-3 w-px bg-glass-border" />
              <div className="space-y-5">
                <TaxRow
                  dotClass="border-orange-500/30 bg-orange-500/10"
                  innerDotClass="bg-orange-400"
                  label={`Events [${eventTypes.length}]`}
                  preview={eventTypes.slice(0, 3).map((t) => t.label).join(", ") || "—"}
                />
                <TaxRow
                  dotClass="border-primary/30 bg-primary/10"
                  innerDotClass="bg-primary"
                  label={`Webinars [${webinarTypes.length}]`}
                  preview={webinarTypes.slice(0, 3).map((t) => t.label).join(", ") || "—"}
                />
                <TaxRow
                  dotClass="border-glass-border bg-glass-strong"
                  innerDotClass="bg-muted-foreground"
                  label={`Other [${otherTypes.length}]`}
                  preview={otherTypes.slice(0, 3).map((t) => t.label).join(", ") || "—"}
                />
              </div>
            </div>
          </VocabColumn>
        </div>

        {/* Footer band */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-glass-border bg-glass/30 px-6 py-3 text-[11px] text-muted-foreground">
          <span>Each list is editable in the tool that uses it — Manage links above open the source of truth.</span>
          <span>
            Need activity or webhooks? See{" "}
            <Link to="/tools" search={{ focus: "activity-log" }} className="text-foreground underline decoration-dotted">Audit log</Link>
            {" · "}
            <Link to="/integrations" className="text-foreground underline decoration-dotted">Integrations</Link>
          </span>
        </div>
      </div>

      <PublicUrlCard orgId={orgId} />
    </div>
  );
}

function PublicUrlCard({ orgId }: { orgId: string | null }) {
  const [value, setValue] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("public_url")
        .eq("id", orgId)
        .single();
      if (cancelled) return;
      const v = (data?.public_url as string | null) ?? "";
      setValue(v);
      setInitial(v);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  const detectedOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const isSandbox = /lovableproject\.com|lovable\.dev/i.test(detectedOrigin);

  const save = async () => {
    if (!orgId) return;
    const trimmed = value.trim().replace(/\/+$/, "");
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setError("URL must start with http:// or https://");
      return;
    }
    setError(null);
    setSaving(true);
    const { error: err } = await supabase
      .from("organizations")
      .update({ public_url: trimmed || null })
      .eq("id", orgId);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setValue(trimmed);
    setInitial(trimmed);
  };

  const dirty = value.trim().replace(/\/+$/, "") !== initial;

  return (
    <div className="overflow-hidden rounded-3xl border border-glass-border bg-glass/40 p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Public app URL</span>
          </div>
          <h2 className="font-display text-2xl text-foreground">Shareable link origin</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            The base URL used for shareable links — public request form, referral links, workspace shares.
            Set this to your production domain (e.g. <span className="font-mono">https://yourcompany.com</span>).
            Leave blank to disable public link generation.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Public URL</label>
        <input
          type="url"
          value={loading ? "" : value}
          disabled={loading || !orgId}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://yourcompany.com"
          className="w-full rounded-xl border border-glass-border bg-glass/40 px-4 py-2.5 font-mono text-sm outline-none focus:border-primary/60"
        />
        {error && <div className="text-xs text-destructive">{error}</div>}
        {detectedOrigin && !isSandbox && !value && (
          <button
            type="button"
            onClick={() => setValue(detectedOrigin)}
            className="text-xs text-primary hover:underline"
          >
            Use current origin ({detectedOrigin})
          </button>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Sandbox/preview hosts are ignored and treated as unset.
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving || loading || !orgId}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}


function VocabColumn({
  accent, Icon, title, blurb, focus, tinted, children,
}: {
  accent: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  blurb: string;
  focus: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-6 p-6 ${tinted ? "bg-glass/20" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
            <Icon size={14} className={accent} />
            {title}
          </h3>
          <p className="text-[11px] text-muted-foreground">{blurb}</p>
        </div>
        <Link
          to="/tools"
          search={{ focus }}
          className="inline-flex items-center gap-1 rounded-full border border-glass-border bg-glass px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          Manage <ArrowRight size={10} />
        </Link>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

function ListGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="font-mono text-[10px] uppercase tracking-tighter text-muted-foreground/70">{label}</div>
      {children}
    </div>
  );
}

function PillList({ values, tone }: { values: string[]; tone: "primary" | "muted" }) {
  if (values.length === 0) {
    return <div className="text-[11px] text-muted-foreground/60">No items yet</div>;
  }
  const cls =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-glass-strong text-muted-foreground border-glass-border";
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.slice(0, 10).map((v) => (
        <span key={v} className={`rounded border px-2 py-0.5 font-mono text-[10px] ${cls}`}>
          {v}
        </span>
      ))}
      {values.length > 10 && (
        <span className="rounded border border-glass-border bg-glass px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          +{values.length - 10}
        </span>
      )}
    </div>
  );
}

function DotPillGrid({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <div className="text-[11px] text-muted-foreground/60">No items yet</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {values.slice(0, 8).map((v) => (
        <div
          key={v}
          className="flex items-center gap-2 rounded border border-emerald-500/15 bg-emerald-500/5 px-2 py-1"
        >
          <span className="size-1 rounded-full bg-emerald-400" />
          <span className="truncate font-mono text-[10px] text-emerald-300">{v}</span>
        </div>
      ))}
      {values.length > 8 && (
        <div className="flex items-center justify-center rounded border border-glass-border bg-glass px-2 py-1 font-mono text-[10px] text-muted-foreground">
          +{values.length - 8} more
        </div>
      )}
    </div>
  );
}

function TaxRow({
  dotClass, innerDotClass, label, preview,
}: { dotClass: string; innerDotClass: string; label: string; preview: string }) {
  return (
    <div className="relative flex items-start gap-4 pl-6">
      <div className={`absolute left-0 top-1.5 flex size-3.5 items-center justify-center rounded-full border ${dotClass}`}>
        <div className={`size-1 rounded-full ${innerDotClass}`} />
      </div>
      <div className="space-y-1">
        <span className="font-mono text-[10px] text-foreground">{label}</span>
        <p className="text-[11px] italic leading-relaxed text-muted-foreground">{preview}</p>
      </div>
    </div>
  );
}


// ───────────────────────── Account tab ─────────────────────────
function AccountTab({ email, fullName, orgName, signOut }: { email: string; fullName: string; orgName: string; signOut: () => Promise<void> }) {
  const primary = fullName || email || "Signed in";
  const secondary = fullName && email ? email : "";
  const initial = (primary || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-glass-strong font-display text-2xl text-foreground">
              {initial}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signed in as</div>
              <div className="mt-1 font-display text-xl">{primary}</div>
              {secondary && <div className="mt-0.5 font-mono text-xs text-muted-foreground">{secondary}</div>}
              <div className="mt-2 text-xs text-muted-foreground">
                Active organization: <span className="text-foreground">{orgName || "—"}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 text-sm hover:bg-glass-strong"
          >
            <IconLogout size={14} /> Sign out
          </button>
        </div>
      </GlassPanel>

      <GlassPanel className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Appearance</div>
          <div className="mt-2 font-display text-lg">Light or dark mode</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch the look of {BRAND.name}. Your choice is remembered on this device.
          </p>
        </div>
        <ThemeToggle />
      </GlassPanel>
    </div>
  );
}
