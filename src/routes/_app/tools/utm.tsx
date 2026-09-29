import { createFileRoute } from "@tanstack/react-router";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useEffect, useMemo, useState } from "react";
import { useDraft } from "@/hooks/use-draft";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconUtm, IconCopy, IconCheck } from "@/components/ui-custom/CustomIcon";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { InfoTooltip } from "@/components/ui-custom/InfoTooltip";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TabHeaderSkeleton, FieldGridSkeleton, PanelSkeleton } from "@/components/ui-custom/TabSkeleton";
import { ReuseLastPill } from "@/components/app/ReuseLastPill";
import { pushPref } from "@/lib/preferences";
import QRCode from "qrcode";
import { checkUtmField, type UtmWarning } from "@/lib/utm-validation";
import { EditVocabDialog } from "@/components/app/EditVocabDialog";
import { UtmTemplatesMenu, type UtmTemplate } from "@/components/app/UtmTemplatesMenu";

const UTM_DEFAULTS = {
  sources: ["google", "facebook", "linkedin", "twitter", "newsletter", "partner", "direct"],
  mediums: ["cpc", "social", "email", "banner", "referral", "organic", "affiliate"],
  campaigns: ["spring-launch", "webinar", "product-launch", "retargeting"],
};

export const Route = createFileRoute("/_app/tools/utm")({
  component: UtmRoute,
});

function UtmRoute() {
  return <UtmBuilderContent />;
}

type Settings = { sources: string[]; mediums: string[]; campaigns: string[]; default_base_url: string | null };
type Mode = "single" | "bulk";

export function UtmBuilderContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [s, setS] = useState<Settings | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [form, setForm, { clearDraft: clearFormDraft }] = useDraft("tools/utm:single", {
    label: "",
    base_url: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
  });
  const [saving, setSaving] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Bulk mode state
  const [bulkUrls, setBulkUrls, { clearDraft: clearBulkUrlsDraft }] = useDraft("tools/utm:bulkUrls", "");
  const [bulkSource, setBulkSource] = useDraft("tools/utm:bulkSource", "");
  const [bulkMedium, setBulkMedium] = useDraft("tools/utm:bulkMedium", "");
  const [bulkCampaign, setBulkCampaign] = useDraft("tools/utm:bulkCampaign", "");
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!userId) return;
      const { data: p } = await supabase.from("profiles").select("default_org_id").eq("id", userId).single();
      if (!p?.default_org_id) return;
      setOrgId(p.default_org_id);
      const { data } = await supabase.from("utm_settings").select("*").eq("org_id", p.default_org_id).single();
      if (data) {
        const settings = data as unknown as Settings;
        setS(settings);
        setForm((f) => ({
          ...f,
          // only seed defaults if the user hasn't typed/restored a value yet
          base_url: f.base_url || settings.default_base_url || "",
          utm_source: f.utm_source || settings.sources[0] || "",
          utm_medium: f.utm_medium || settings.mediums[0] || "",
          utm_campaign: f.utm_campaign || settings.campaigns[0] || "",
        }));
        if (!bulkSource) setBulkSource(settings.sources[0] ?? "");
        if (!bulkMedium) setBulkMedium(settings.mediums[0] ?? "");
        if (!bulkCampaign) setBulkCampaign(settings.campaigns[0] ?? "");
      }
    })();
    // Fragile: depend on the scalar user id, not the auth user object. A token
    // refresh can replace the object and replay the defaults fetch/field seeding.
  }, [userId]);

  const finalUrl = useMemo(() => {
    if (!form.base_url) return "";
    try {
      const url = new URL(form.base_url);
      const set = (k: string, v: string) => v && url.searchParams.set(k, v);
      set("utm_source", form.utm_source);
      set("utm_medium", form.utm_medium);
      set("utm_campaign", form.utm_campaign);
      set("utm_term", form.utm_term);
      set("utm_content", form.utm_content);
      return url.toString();
    } catch {
      return "";
    }
  }, [form]);

  // Generate QR whenever finalUrl changes
  useEffect(() => {
    if (!finalUrl) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(finalUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#0a0a0f", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [finalUrl]);

  const save = async () => {
    if (!orgId || !user || !finalUrl || !form.label) {
      toast.error("Label and a valid URL are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("utm_links").insert({
      org_id: orgId,
      created_by: user.id,
      label: form.label,
      base_url: form.base_url,
      utm_source: form.utm_source,
      utm_medium: form.utm_medium,
      utm_campaign: form.utm_campaign,
      utm_term: form.utm_term || null,
      utm_content: form.utm_content || null,
      final_url: finalUrl,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await Promise.all([
      pushPref(user.id, "utm:source", form.utm_source),
      pushPref(user.id, "utm:medium", form.utm_medium),
      pushPref(user.id, "utm:campaign", form.utm_campaign),
      supabase.from("utm_generation_logs").insert({
        org_id: orgId,
        user_id: user.id,
        user_email: user.email ?? "",
        base_url: form.base_url,
        generated_url: finalUrl,
        utm_source: form.utm_source || null,
        utm_medium: form.utm_medium || null,
        utm_campaign: form.utm_campaign || null,
        utm_term: form.utm_term || null,
        utm_content: form.utm_content || null,
      }),

    ]);
    toast.success("URL saved");
    // record persisted — clear the local draft for label/term/content so
    // they reset for the next entry. Keep source/medium/campaign as sticky defaults.
    setForm((f) => ({ ...f, label: "", utm_term: "", utm_content: "", base_url: "" }));
    clearFormDraft();
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${form.label || "qr"}.png`;
    a.click();
  };

  // Bulk preview
  const bulkRows = useMemo(() => {
    if (!bulkUrls.trim()) return [];
    return bulkUrls
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((raw) => {
        try {
          const u = new URL(raw);
          if (bulkSource) u.searchParams.set("utm_source", bulkSource);
          if (bulkMedium) u.searchParams.set("utm_medium", bulkMedium);
          if (bulkCampaign) u.searchParams.set("utm_campaign", bulkCampaign);
          return { ok: true as const, raw, final: u.toString() };
        } catch {
          return { ok: false as const, raw, final: "" };
        }
      });
  }, [bulkUrls, bulkSource, bulkMedium, bulkCampaign]);

  const validRows = bulkRows.filter((r) => r.ok);

  const saveBulk = async () => {
    if (!orgId || !user || validRows.length === 0) return;
    setBulkSaving(true);
    const rows = validRows.map((r) => ({
      org_id: orgId,
      created_by: user.id,
      label: `Bulk · ${new URL(r.raw).hostname}`,
      base_url: r.raw,
      utm_source: bulkSource,
      utm_medium: bulkMedium,
      utm_campaign: bulkCampaign,
      final_url: r.final,
    }));
    const { error } = await supabase.from("utm_links").insert(rows);
    setBulkSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Saved ${rows.length} URLs`);
      setBulkUrls("");
      clearBulkUrlsDraft();
    }
  };

  const exportCsv = () => {
    if (validRows.length === 0) return;
    const csv =
      "original,final\n" +
      validRows.map((r) => `"${r.raw}","${r.final}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "utm-bulk.csv";
    a.click();
  };

  if (!s) {
    return (
      <div className="space-y-8">
        <TabHeaderSkeleton module="UTMs" accent="secondary" />
        <PanelSkeleton lines={2} />
        <FieldGridSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {(() => {
        const actions = (
          <>
            <UtmTemplatesMenu
              orgId={orgId}
              userId={user?.id ?? null}
              current={{
                base_url: form.base_url,
                utm_source: form.utm_source,
                utm_medium: form.utm_medium,
                utm_campaign: form.utm_campaign,
                utm_term: form.utm_term,
                utm_content: form.utm_content,
              }}
              onApply={(t: UtmTemplate) => {
                setForm((f) => ({
                  ...f,
                  base_url: t.base_url ?? f.base_url,
                  utm_source: t.utm_source ?? f.utm_source,
                  utm_medium: t.utm_medium ?? f.utm_medium,
                  utm_campaign: t.utm_campaign ?? f.utm_campaign,
                  utm_term: t.utm_term ?? "",
                  utm_content: t.utm_content ?? "",
                }));
                setBulkSource(t.utm_source ?? bulkSource);
                setBulkMedium(t.utm_medium ?? bulkMedium);
                setBulkCampaign(t.utm_campaign ?? bulkCampaign);
              }}
              onDefaultLoaded={(t) => {
                setForm((f) => {
                  const empty = !f.base_url && !f.label && !f.utm_term && !f.utm_content;
                  if (!empty) return f;
                  return {
                    ...f,
                    base_url: t.base_url ?? f.base_url,
                    utm_source: t.utm_source ?? f.utm_source,
                    utm_medium: t.utm_medium ?? f.utm_medium,
                    utm_campaign: t.utm_campaign ?? f.utm_campaign,
                    utm_term: t.utm_term ?? f.utm_term,
                    utm_content: t.utm_content ?? f.utm_content,
                  };
                });
              }}
            />
            <ReuseLastPill
              prefKeys={["utm:source", "utm:medium", "utm:campaign"]}
              onReuse={(vals) => {
                setForm((f) => ({
                  ...f,
                  utm_source: vals["utm:source"] ?? f.utm_source,
                  utm_medium: vals["utm:medium"] ?? f.utm_medium,
                  utm_campaign: vals["utm:campaign"] ?? f.utm_campaign,
                }));
                setBulkSource(vals["utm:source"] ?? bulkSource);
                setBulkMedium(vals["utm:medium"] ?? bulkMedium);
                setBulkCampaign(vals["utm:campaign"] ?? bulkCampaign);
                toast.success("Filled with your last values");
              }}
            />
            <div className="inline-flex rounded-full border border-glass-border bg-glass/30 p-0.5">
              {(["single", "bulk"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        );
        return hideHeader ? (
          <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : (
          <ToolHeader
            eyebrow="UTMs · tagged links"
            title="UTM"
            accent="builder."
            hue={275}
            icon={<IconUtm size={24} />}
            ariaLabel="UTM builder"
            description="Compose tagged URLs in one place — single or bulk. Templates, history, QR, and validation built in."
            actions={actions}
          />
        );
      })()}

      {mode === "single" ? (
        <>
          <GlassPanel tier="strong" glow className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground/85">Composed URL</div>
                <div className="mt-3 break-all font-mono text-sm text-foreground md:text-base tick-in" key={finalUrl}>
                  {finalUrl || "Add a base URL to compose"}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    disabled={!finalUrl}
                    onClick={() => {
                      copyToClipboard(finalUrl);
                      toast.success("Copied");
                    }}
                    className="inline-flex items-center gap-2 rounded-full glass border border-glass-border px-4 py-2 text-sm hover:bg-glass-strong disabled:opacity-50"
                  >
                    <IconCopy size={14} /> Copy
                  </button>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <IconCheck size={14} /> {saving ? "Saving…" : "Save link"}
                  </button>
                  {qrDataUrl && (
                    <button
                      onClick={downloadQR}
                      className="inline-flex items-center gap-2 rounded-full glass border border-glass-border px-4 py-2 text-sm hover:bg-glass-strong"
                    >
                      Download QR
                    </button>
                  )}
                </div>
              </div>
              {qrDataUrl && (
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <img
                    src={qrDataUrl}
                    alt="QR code"
                    className="size-32 rounded-xl border border-glass-border bg-white p-2"
                  />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Scan to test</span>
                </div>
              )}
            </div>
          </GlassPanel>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Name this link" hint="For your reference only" tip="A friendly name so you can find this link again later in your history. Not added to the URL.">
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Spring product launch"
                className="input"
              />
            </Field>
            <Field label="Destination URL" hint="Where the link sends people" tip="The page someone lands on after clicking. Paste the full URL, e.g. https://yoursite.com/pricing.">
              <input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://example.com/landing" className="input" />
            </Field>
            <Field label="Traffic source" hint="Where the click came from" tip="Where the click is coming from — the specific site, platform, or list. Examples: google, facebook, weekly-newsletter. (Sets utm_source)" action={<EditVocabDialog table="utm_settings" column="sources" orgId={orgId} label="Sources" help="utm_source values that show up in the dropdown." values={s.sources} defaults={UTM_DEFAULTS.sources} onSaved={(v) => setS({ ...s, sources: v })} />}>
              <ThemedSelect value={form.utm_source} onChange={(v) => setForm({ ...form, utm_source: v })} options={s.sources} />
            </Field>
            <Field label="Marketing channel" hint="Type of marketing" tip="The type of marketing this link belongs to. Examples: cpc (paid ads), email, social, organic, referral. (Sets utm_medium)" action={<EditVocabDialog table="utm_settings" column="mediums" orgId={orgId} label="Mediums" help="utm_medium values that show up in the dropdown." values={s.mediums} defaults={UTM_DEFAULTS.mediums} onSaved={(v) => setS({ ...s, mediums: v })} />}>
              <ThemedSelect value={form.utm_medium} onChange={(v) => setForm({ ...form, utm_medium: v })} options={s.mediums} />
            </Field>
            <Field label="Campaign" hint="Which campaign this belongs to" tip="The specific promotion or initiative driving the click. Examples: spring-launch, black-friday-2026, webinar-may. (Sets utm_campaign)" action={<EditVocabDialog table="utm_settings" column="campaigns" orgId={orgId} label="Campaigns" help="utm_campaign values you reuse often." values={s.campaigns} defaults={UTM_DEFAULTS.campaigns} onSaved={(v) => setS({ ...s, campaigns: v })} />}>
              <ThemedSelect value={form.utm_campaign} onChange={(v) => setForm({ ...form, utm_campaign: v })} options={s.campaigns} />
            </Field>
            <Field label="Keyword" hint="Optional · for paid search" tip="Optional. The paid-search keyword you bid on, e.g. marketing-automation. Leave blank if this isn't a paid-search link. (Sets utm_term)">
              <input value={form.utm_term} onChange={(e) => setForm({ ...form, utm_term: e.target.value })} placeholder="optional" className="input" />
            </Field>
            <Field label="Ad variant" hint="Optional · A/B test label" tip="Optional. Use this to A/B test or tell similar links apart, e.g. hero-button vs footer-link, or blue-cta vs green-cta. (Sets utm_content)">
              <input value={form.utm_content} onChange={(e) => setForm({ ...form, utm_content: e.target.value })} placeholder="optional" className="input" />
            </Field>
          </div>
          <UtmLint form={form} />
        </>
      ) : (
        <>
          <GlassPanel tier="strong" className="p-6 md:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/70">Bulk URLs</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste one URL per line (or comma-separated). We'll tag every URL with the parameters below and save them as one batch.
            </p>
            <textarea
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              rows={6}
              placeholder={"https://acme.com/launch\nhttps://acme.com/pricing\nhttps://acme.com/blog/announcement"}
              className="mt-4 w-full rounded-xl border border-glass-border bg-glass/30 p-4 font-mono text-sm placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="utm_source" action={<EditVocabDialog table="utm_settings" column="sources" orgId={orgId} label="Sources" values={s.sources} defaults={UTM_DEFAULTS.sources} onSaved={(v) => setS({ ...s, sources: v })} />}>
                <ThemedSelect value={bulkSource} onChange={setBulkSource} options={s.sources} />
              </Field>
              <Field label="utm_medium" action={<EditVocabDialog table="utm_settings" column="mediums" orgId={orgId} label="Mediums" values={s.mediums} defaults={UTM_DEFAULTS.mediums} onSaved={(v) => setS({ ...s, mediums: v })} />}>
                <ThemedSelect value={bulkMedium} onChange={setBulkMedium} options={s.mediums} />
              </Field>
              <Field label="utm_campaign" action={<EditVocabDialog table="utm_settings" column="campaigns" orgId={orgId} label="Campaigns" values={s.campaigns} defaults={UTM_DEFAULTS.campaigns} onSaved={(v) => setS({ ...s, campaigns: v })} />}>
                <ThemedSelect value={bulkCampaign} onChange={setBulkCampaign} options={s.campaigns} />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={saveBulk}
                disabled={bulkSaving || validRows.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <IconCheck size={14} /> {bulkSaving ? "Saving…" : `Save ${validRows.length} URLs`}
              </button>
              <button
                onClick={exportCsv}
                disabled={validRows.length === 0}
                className="inline-flex items-center gap-2 rounded-full glass border border-glass-border px-4 py-2 text-sm hover:bg-glass-strong disabled:opacity-50"
              >
                Export CSV
              </button>
              <span className="ml-auto self-center text-xs text-muted-foreground">
                {validRows.length} valid · {bulkRows.length - validRows.length} invalid
              </span>
            </div>
          </GlassPanel>

          {bulkRows.length > 0 && (
            <GlassPanel className="divide-y divide-glass-border overflow-hidden">
              {bulkRows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 text-xs font-mono">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${r.ok ? "bg-primary" : "bg-destructive"}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.raw}</span>
                  <span className="hidden md:inline min-w-0 flex-1 truncate text-foreground">{r.final || "invalid URL"}</span>
                  {r.ok && (
                    <button
                      onClick={() => {
                        copyToClipboard(r.final);
                        toast.success("Copied");
                      }}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <IconCopy size={12} />
                    </button>
                  )}
                </div>
              ))}
            </GlassPanel>
          )}
        </>
      )}

      <style>{`.input{position:relative;z-index:1;width:100%;border-radius:9999px;background:transparent;border:1px solid var(--glass-border);padding:.625rem 1rem;font-family:var(--font-mono);font-size:.875rem;color:var(--color-foreground);outline:none}.input:focus{border-color:oklch(0.84 0.18 158 / 0.5)}.input::placeholder{color:hsl(var(--muted-foreground)/.6)}`}</style>
    </div>
  );
}

function Field({ label, hint, tip, action, children }: { label: string; hint?: string; tip?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          {label}
          {tip && <InfoTooltip>{tip}</InfoTooltip>}
        </span>
        <span className="flex items-center gap-2">
          {hint && <span className="truncate text-[10px] text-muted-foreground">{hint}</span>}
          {action}
        </span>
      </div>
      <div className="focused-control-lens relative overflow-hidden rounded-full">
        {children}
      </div>
    </div>
  );
}

function ThemedSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full rounded-full glass border-glass-border bg-transparent px-4 py-2.5 font-mono text-sm h-auto focus:border-primary/60 focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="font-mono">
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function UtmLint({ form }: { form: { utm_source: string; utm_medium: string; utm_campaign: string; utm_term: string; utm_content: string } }) {
  const warnings: UtmWarning[] = [
    checkUtmField("source", form.utm_source),
    checkUtmField("medium", form.utm_medium),
    checkUtmField("campaign", form.utm_campaign),
    checkUtmField("term", form.utm_term),
    checkUtmField("content", form.utm_content),
  ].filter(Boolean) as UtmWarning[];
  if (!warnings.length) return null;
  return (
    <GlassPanel className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/70">Lint</div>
      <ul className="mt-2 space-y-1 text-sm">
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className={`mt-1 inline-block size-2 rounded-full ${
                w.level === "error" ? "bg-rose-400" : "bg-amber-400"
              }`}
            />
            <span className={w.level === "error" ? "text-rose-300" : "text-amber-300"}>{w.message}</span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
