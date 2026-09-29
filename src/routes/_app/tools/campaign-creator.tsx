import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useDraft } from "@/hooks/use-draft";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { Button } from "@/components/ui/button";
import { IconCampaign, IconCheck, IconWarning } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { useWorkspaceContext, WorkspaceBanner } from "@/hooks/use-workspace-context";
import { createCampaignBundleFn, getCrmStatus } from "@/lib/crm/index.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tools/campaign-creator")({
  validateSearch: (s: Record<string, unknown>) => ({
    workspace: typeof s.workspace === "string" ? s.workspace : undefined,
  }),
  component: CampaignCreatorContent,
});

type CampaignTypeRow = { id: string; category: string; value: string; label: string };

const MAX_BRIEF = 20;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BRIEF);
}

export function CampaignCreatorContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { user } = useAuth();
  const orgId = useOrgId();
  const ws = useWorkspaceContext("campaign-bundle");
  const createBundle = useServerFn(createCampaignBundleFn);
  const fetchStatus = useServerFn(getCrmStatus);

  const [types, setTypes] = useState<CampaignTypeRow[]>([]);
  const [crm, setCrm] = useState<{ provider: string; connected: boolean; account_label: string | null } | null>(
    null,
  );
  const [form, setForm, { clearDraft }] = useDraft("tools/campaign-creator:form", {
    category: "event" as "event" | "webinar" | "other",
    type: "",
    audience: "b2b" as "b2b" | "b2c",
    briefName: "",
    promotionStart: "",
    promotionEnd: "",
    eventStart: "",
    eventEnd: "",
    notes: "",
    budget: "",
  });
  const { category, type, audience, briefName, promotionStart, promotionEnd, eventStart, eventEnd, notes, budget } = form;
  const setCategory = (v: typeof form.category) => setForm((f) => ({ ...f, category: v }));
  const setType = (v: string) => setForm((f) => ({ ...f, type: v }));
  const setAudience = (v: typeof form.audience) => setForm((f) => ({ ...f, audience: v }));
  const setBriefName = (v: string) => setForm((f) => ({ ...f, briefName: v }));
  const setPromotionStart = (v: string) => setForm((f) => ({ ...f, promotionStart: v }));
  const setPromotionEnd = (v: string) => setForm((f) => ({ ...f, promotionEnd: v }));
  const setEventStart = (v: string) => setForm((f) => ({ ...f, eventStart: v }));
  const setEventEnd = (v: string) => setForm((f) => ({ ...f, eventEnd: v }));
  const setNotes = (v: string) => setForm((f) => ({ ...f, notes: v }));
  const setBudget = (v: string) => setForm((f) => ({ ...f, budget: v }));
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    fetchStatus().then(setCrm).catch(() => setCrm({ provider: "none", connected: false, account_label: null }));
  }, [fetchStatus]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("org_campaign_types")
        .select("id, category, value, label")
        .eq("org_id", orgId)
        .eq("archived", false)
        .order("position");
      if (!cancelled) setTypes((data as CampaignTypeRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const typesInCategory = useMemo(() => types.filter((t) => t.category === category), [types, category]);

  useEffect(() => {
    if (typesInCategory.length && !typesInCategory.find((t) => t.value === type)) {
      setType(typesInCategory[0].value);
    }
  }, [typesInCategory, type]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!type) e.push("Pick a campaign type.");
    if (!briefName.trim()) e.push("Enter a brief name.");
    if (briefName.length > MAX_BRIEF) e.push(`Brief name max ${MAX_BRIEF} characters.`);
    if (!promotionStart || !promotionEnd) e.push("Promotion dates are required.");
    if (promotionStart && promotionEnd && promotionStart > promotionEnd)
      e.push("Promotion end must be on or after promotion start.");
    if (category !== "other") {
      if (!eventStart || !eventEnd) e.push("Event dates are required for events and webinars.");
      if (eventStart && eventEnd && eventStart > eventEnd)
        e.push("Event end must be on or after event start.");
      if (eventStart && promotionStart && eventStart < promotionStart)
        e.push("Event start cannot be before promotion start.");
    }
    return e;
  }, [type, briefName, promotionStart, promotionEnd, eventStart, eventEnd, category]);

  const generatedName = useMemo(() => {
    if (!type || !briefName) return "";
    const t = types.find((x) => x.value === type);
    const yr = (promotionStart || new Date().toISOString().slice(0, 10)).slice(0, 4);
    const q = `Q${Math.ceil((Number((promotionStart || "2026-01").slice(5, 7)) || 1) / 3)}`;
    return [
      yr,
      q,
      audience.toUpperCase(),
      t ? t.value : type,
      slugify(briefName),
    ].join("-");
  }, [type, briefName, promotionStart, audience, types]);

  const submit = async () => {
    if (!orgId || !user) return;
    if (errors.length) {
      setAttempted(true);
      return;
    }
    setBusy(true);
    try {
      const bundle = await createBundle({
        data: {
          generated_name: generatedName,
          campaign_type: type,
          audience,
          brief_name: briefName.trim(),
          promotion_start: promotionStart,
          promotion_end: promotionEnd,
          event_start: category === "other" ? null : eventStart,
          event_end: category === "other" ? null : eventEnd,
          budget_cents: Math.round((Number(budget) || 0) * 100),
          notes: notes.trim() || null,
        },
      });
      const { error } = await supabase.from("campaigns").insert({
        org_id: orgId,
        created_by: user.id,
        name: generatedName,
        notes: notes.trim() || null,
        taxonomy_snapshot: {
          category,
          type,
          audience,
          brief_name: briefName,
          promotion: { start: promotionStart, end: promotionEnd },
          event: category === "other" ? null : { start: eventStart, end: eventEnd },
          budget_cents: Math.round((Number(budget) || 0) * 100),
          crm_campaign_id: bundle.campaign_id,
          crm_event_id: bundle.event_id,
        },
        ...ws.attach,
      });
      if (error) throw new Error(error.message);
      await ws.logActivity(orgId, "bundle_created", {
        name: generatedName,
        crm_campaign_id: bundle.campaign_id,
      });
      toast.success(crm?.connected ? "Campaign created in CRM" : "Saved locally — connect a CRM to sync");
      setBriefName("");
      setNotes("");
      clearDraft();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div className="flex items-center gap-4">
          <PageHexBadge hue={150} icon={<IconCampaign size={26} />} aria-label="Campaign Name Generator" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/70">Campaign</div>
            <h1 className="font-display text-3xl">Campaign Name Generator</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Structured brief → standardized campaign name. Saves locally; syncs to your CRM when connected.
            </p>
          </div>
        </div>
      )}

      <WorkspaceBanner
        workspaceId={ws.workspaceId}
        workspaceName={ws.workspaceName}
        onDetach={ws.detach}
      />

      {crm && !crm.connected && (
        <GlassPanel
          className="relative flex items-center gap-3 overflow-hidden p-3 pl-4 text-sm"
          style={{
            borderColor: "color-mix(in oklab, oklch(0.78 0.16 70) 28%, transparent)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[2px]"
            style={{ background: "oklch(0.78 0.16 70)" }}
          />
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "color-mix(in oklab, oklch(0.78 0.16 70) 14%, transparent)",
            }}
          >
            <IconWarning size={14} style={{ color: "oklch(0.85 0.16 75)" }} />
          </span>
          <div className="flex-1 leading-tight">
            <span className="font-medium" style={{ color: "oklch(0.92 0.06 80)" }}>CRM not connected</span>
            <span className="text-muted-foreground"> — bundles save locally only. </span>
            <Link to="/connectors" className="text-primary hover:underline">
              Connect your CRM →
            </Link>
          </div>
        </GlassPanel>
      )}

      <GlassPanel tier="strong" className="px-6 py-5 md:px-7">
        <div className="flex items-baseline justify-between gap-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/55">
            Generated name
          </div>
          {generatedName && (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
              preview
            </span>
          )}
        </div>
        <div className="mt-1.5 font-display text-2xl leading-tight text-foreground md:text-[28px]">
          {generatedName || (
            <span className="font-sans text-base italic text-muted-foreground/70">
              Fill the brief — your standardized name appears here.
            </span>
          )}
        </div>
      </GlassPanel>


      <GlassPanel className="p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <Label>Category</Label>
            <SegmentedToggle
              options={[
                { value: "event", label: "Event" },
                { value: "webinar", label: "Webinar" },
                { value: "other", label: "Other" },
              ]}
              value={category}
              onChange={(v) => setCategory(v as typeof category)}
            />
          </div>
          <div>
            <Label>Audience</Label>
            <SegmentedToggle
              options={[
                { value: "b2b", label: "B2B" },
                { value: "b2c", label: "B2C" },
              ]}
              value={audience}
              onChange={(v) => setAudience(v as typeof audience)}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Campaign type</Label>
            <div className="relative mt-1.5">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border/50 bg-background/40 px-3 py-2 pr-9 font-mono text-sm text-foreground transition-colors hover:border-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
              >
                {typesInCategory.map((t) => (
                  <option key={t.id} value={t.value} className="bg-card text-foreground">
                    {t.label}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                viewBox="0 0 12 12" fill="none"
              >
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Edit options in{" "}
              <Link to="/settings" className="text-primary hover:underline">
                Settings → Campaign taxonomy
              </Link>
              .
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Brief name</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {briefName.length}/{MAX_BRIEF}
              </span>
            </div>
            <input
              value={briefName}
              onChange={(e) => setBriefName(e.target.value.replace(/\s{2,}/g, " ").slice(0, MAX_BRIEF))}
              maxLength={MAX_BRIEF}
              placeholder="emea-launch"
              className="mt-1.5 w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 font-mono text-sm transition-colors hover:border-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DateField label="Promotion start" value={promotionStart} onChange={setPromotionStart} />
          <DateField label="Promotion end" value={promotionEnd} onChange={setPromotionEnd} />
          {category !== "other" && (
            <>
              <DateField label="Event start" value={eventStart} onChange={setEventStart} />
              <DateField label="Event end" value={eventEnd} onChange={setEventEnd} />
            </>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm transition-colors hover:border-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
            />
          </div>
          <div>
            <Label>Budget (USD)</Label>
            <input
              type="number"
              min={0}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 font-mono text-sm transition-colors hover:border-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
            />
          </div>
        </div>


        {attempted && errors.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-amber-300">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={submit} disabled={busy} className="btn-keystone gap-2">
            <IconCheck size={14} /> {busy ? "Creating…" : "Create campaign"}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/70">{children}</div>;
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 font-mono text-sm text-foreground transition-colors [color-scheme:dark] hover:border-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
      />
    </div>
  );
}

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-1.5 inline-flex rounded-xl border border-border/50 bg-background/40 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

