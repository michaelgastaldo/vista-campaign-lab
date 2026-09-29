import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import { PanelError } from "@/components/ui-custom/PanelError";

import { IconBolt, IconCheck, IconClose, IconCopy, IconPlus } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/connectors")({
  component: ConnectorsPage,
});

type Hook = {
  id: string;
  workspace_id: string | null;
  org_id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
};

const HOOK_COLS = "id,workspace_id,org_id,url,events,active,created_at";

type Preset = {
  id: string;
  name: string;
  blurb: string;
  events: string[];
  urlLabel: string;
  urlPlaceholder: string;
  helper: string;
  accent: string;
  glyph: string;
  match: (url: string) => boolean;
};

const PRESETS: Preset[] = [
  {
    id: "slack",
    name: "Slack",
    blurb: "Post a message in a channel when status changes, assets get approved, or A/B winners are picked.",
    events: ["workspace.status_changed", "asset.approved", "variant.winner_picked"],
    urlLabel: "Incoming webhook URL",
    urlPlaceholder: "https://hooks.slack.com/services/T000/B000/XXXX",
    helper: "Create one at api.slack.com/apps → Incoming Webhooks.",
    accent: "from-[#4A154B] to-[#ECB22E]",
    glyph: "S",
    match: (u) => /hooks\.slack\.com/i.test(u),
  },
  {
    id: "hubspot",
    name: "CRM (e.g. HubSpot)",
    blurb: "Push imported lists into your CRM as static contact lists via a workflow webhook.",
    events: ["list.created"],
    urlLabel: "Workflow webhook URL",
    urlPlaceholder: "https://api.hubapi.com/automation/v4/...",
    helper: "From a HubSpot Workflow → Webhook action.",
    accent: "from-[#FF7A59] to-[#FF9C7A]",
    glyph: "H",
    match: (u) => /hubapi\.com|hubspot/i.test(u),
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    blurb: "Send list.created events to Mailchimp via Mandrill or a Make/Zapier webhook.",
    events: ["list.created"],
    urlLabel: "Webhook URL",
    urlPlaceholder: "https://hooks.zapier.com/... or Make scenario URL",
    helper: "Use a Zapier/Make scenario that calls Mailchimp's API.",
    accent: "from-[#FFE01B] to-[#FFB347]",
    glyph: "M",
    match: (u) => /mailchimp|mandrillapp/i.test(u),
  },
  {
    id: "sheets",
    name: "Google Sheets",
    blurb: "Append a row to a Sheet for every workspace status change. Great for portfolio tracking.",
    events: ["workspace.status_changed"],
    urlLabel: "Apps Script web app URL",
    urlPlaceholder: "https://script.google.com/macros/s/.../exec",
    helper: "Deploy an Apps Script as a web app accepting POST.",
    accent: "from-[#0F9D58] to-[#34A853]",
    glyph: "G",
    match: (u) => /script\.google\.com/i.test(u),
  },
  {
    id: "notion",
    name: "Notion",
    blurb: "Mirror brief and status into a Notion database via an automation hub.",
    events: ["workspace.status_changed", "asset.approved"],
    urlLabel: "Webhook URL",
    urlPlaceholder: "https://api.notion.com/... or Make/Zapier URL",
    helper: "Use a Make/Zapier scenario that writes to Notion.",
    accent: "from-[#FFFFFF] to-[#A0A0A0]",
    glyph: "N",
    match: (u) => /notion/i.test(u),
  },
];

function ConnectorsPage() {
  const { user } = useAuth();
  const activeOrgId = useOrgId();
  const orgLoading = !activeOrgId;
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Preset | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("webhook_subscriptions")
        .select(HOOK_COLS)
        .eq("org_id", activeOrgId)
        .is("workspace_id", null)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setHooks([]);
      } else {
        setHooks((data as Hook[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, reloadKey]);


  const presetCounts = useMemo(() => {
    const map = new Map<string, Hook[]>();
    for (const p of PRESETS) map.set(p.id, []);
    map.set("custom", []);
    for (const h of hooks) {
      const p = PRESETS.find((x) => x.match(h.url));
      if (p) map.get(p.id)!.push(h);
      else map.get("custom")!.push(h);
    }
    return map;
  }, [hooks]);

  const addHook = async (url: string, events: string[]) => {
    if (!user || !activeOrgId) return;
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { data, error } = await supabase
      .from("webhook_subscriptions")
      .insert({
        workspace_id: null,
        org_id: activeOrgId,
        url: url.trim(),
        secret,
        events,
        created_by: user.id,
      })
      .select(HOOK_COLS)
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setHooks((cur) => [data as Hook, ...cur]);
    toast.success("Connector added");
  };

  const removeHook = async (id: string) => {
    const h = hooks.find((x) => x.id === id);
    if (!window.confirm(`Delete this webhook?\n\n${h?.url ?? ""}\n\nEvents will stop firing immediately.`)) return;
    setHooks((cur) => cur.filter((h) => h.id !== id));
    await supabase.from("webhook_subscriptions").delete().eq("id", id);
    toast.success("Connector removed");
  };

  const toggleHook = async (h: Hook) => {
    const next = !h.active;
    setHooks((cur) => cur.map((x) => (x.id === h.id ? { ...x, active: next } : x)));
    await supabase.from("webhook_subscriptions").update({ active: next }).eq("id", h.id);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={275} size={26} icon={<IconBolt size={22} />} aria-label="Automations" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Automations</div>
            <h1 className="mt-1 font-display text-4xl tracking-tight">Webhooks &amp; events</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Push campaign events into the rest of your stack via webhooks. Org-level automations fire for every workspace.
            </p>
          </div>
        </div>
        <button
          onClick={() => setCustomOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-glass-border bg-glass/40 px-3.5 py-2 text-sm hover:bg-glass-strong"
        >
          <IconPlus size={14} /> Custom webhook
        </button>
      </div>

      <CrmPromptsSection />



      {orgLoading || loading ? (
        <GlassSkeleton rows={4} />
      ) : loadError ? (
        <PanelError message="Couldn't load connectors" onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PRESETS.map((p) => {
            const matched = presetCounts.get(p.id) ?? [];
            const enabled = matched.some((h) => h.active);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <GlassPanel className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br ${p.accent} font-display text-lg text-black/80 shadow-inner`}
                    >
                      {p.glyph}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg">{p.name}</h3>
                        {enabled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                            <IconCheck size={10} /> Live
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.blurb}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {p.events.map((e) => (
                      <span
                        key={e}
                        className="rounded-md border border-glass-border bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {e}
                      </span>
                    ))}
                  </div>

                  {matched.length > 0 && (
                    <div className="space-y-1.5 border-t border-glass-border pt-3">
                      {matched.map((h) => (
                        <div key={h.id} className="flex items-center gap-2 text-xs">
                          <button
                            onClick={() => toggleHook(h)}
                            className={`size-2 shrink-0 rounded-full ${h.active ? "bg-primary" : "bg-muted-foreground/30"}`}
                            aria-label={h.active ? "Disable" : "Enable"}
                          />
                          <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{h.url}</span>
                          <button
                            onClick={() => removeHook(h.id)}
                            className="text-muted-foreground/50 hover:text-destructive"
                          >
                            <IconClose size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setSelected(p)}
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg border border-glass-border bg-glass/40 px-3 py-2 text-xs font-medium hover:bg-glass-strong"
                  >
                    <IconBolt size={12} /> {matched.length > 0 ? "Add another" : "Connect"}
                  </button>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Custom webhooks list */}
      {(presetCounts.get("custom")?.length ?? 0) > 0 && (
        <div>
          <h2 className="mb-3 font-display text-xl">Custom webhooks</h2>
          <GlassPanel className="divide-y divide-glass-border">
            {presetCounts.get("custom")!.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <button
                  onClick={() => toggleHook(h)}
                  className={`size-2 shrink-0 rounded-full ${h.active ? "bg-primary" : "bg-muted-foreground/30"}`}
                />
                <span className="min-w-0 flex-1 truncate font-mono">{h.url}</span>
                <span className="hidden text-muted-foreground sm:inline">{h.events.length} events</span>
                <button onClick={() => removeHook(h.id)} className="text-muted-foreground/50 hover:text-destructive">
                  <IconClose size={14} />
                </button>
              </div>
            ))}
          </GlassPanel>
        </div>
      )}

      <PresetDialog preset={selected} onClose={() => setSelected(null)} onAdd={addHook} />
      <CustomDialog open={customOpen} onClose={() => setCustomOpen(false)} onAdd={addHook} />
    </div>
  );
}

const ALL_EVENTS = [
  "workspace.status_changed",
  "asset.approved",
  "list.created",
  "variant.winner_picked",
];

function PresetDialog({
  preset,
  onClose,
  onAdd,
}: {
  preset: Preset | null;
  onClose: () => void;
  onAdd: (url: string, events: string[]) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preset) {
      setUrl("");
      setEvents(preset.events);
    }
  }, [preset]);

  const submit = async () => {
    if (!preset || !url.trim()) return;
    setBusy(true);
    await onAdd(url, events.length ? events : preset.events);
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open={!!preset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {preset?.name}</DialogTitle>
          <DialogDescription>{preset?.helper}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{preset?.urlLabel}</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={preset?.urlPlaceholder}
              className="font-mono text-xs"
            />
            {preset && url.trim() && !preset.match(url.trim()) && (
              <p className="text-[11px] text-amber-400">
                Heads up — that URL doesn't look like a {preset.name} endpoint. Double-check before saving.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Events to forward</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_EVENTS.map((e) => {
                const on = events.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() =>
                      setEvents((cur) => (on ? cur.filter((x) => x !== e) : [...cur, e]))
                    }
                    className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-colors ${
                      on
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-glass-border bg-black/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!url.trim() || busy}>
            {busy ? "Adding…" : "Add connector"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (url: string, events: string[]) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(ALL_EVENTS);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    await onAdd(url, events);
    setBusy(false);
    setUrl("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Custom webhook</DialogTitle>
          <DialogDescription>
            POST events with HMAC-SHA256 signature in the <code className="font-mono text-xs">X-Webhook-Signature</code> header.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Endpoint URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-service.example.com/hooks/command"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Events</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_EVENTS.map((e) => {
                const on = events.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() =>
                      setEvents((cur) => (on ? cur.filter((x) => x !== e) : [...cur, e]))
                    }
                    className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-colors ${
                      on
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-glass-border bg-black/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!url.trim() || busy}>
            {busy ? "Adding…" : "Add webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CRM_PROMPTS: { title: string; prompt: string }[] = [
  {
    title: "Wire up HubSpot",
    prompt:
      "Connect my HubSpot account: I've added HUBSPOT_API_KEY to my project secrets. Wire the existing CRM gateway so campaigns, lists, and performance data come from my portal instead of demo data.",
  },
  {
    title: "Swap in Salesforce",
    prompt:
      "Replace the CRM layer with Salesforce: keep the same gateway interface in src/lib/crm/ and implement the provider against the Salesforce REST API using a connected app token stored in project secrets.",
  },
  {
    title: "Use a different CRM",
    prompt:
      "I use a different CRM — ask me what it is, then implement a provider for it behind the existing src/lib/crm/ gateway interface, keeping demo data as the fallback when it's not configured.",
  },
];

function CrmPromptsSection() {
  return (
    <GlassPanel className="space-y-4 p-5">
      <div>
        <h2 className="font-display text-xl">Build your CRM connection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The template runs on labeled demo data until a CRM is connected. After remixing, paste one of these prompts into Lovable's chat to have the CRM gateway wired to your provider.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CRM_PROMPTS.map((p) => (
          <CrmPromptCard key={p.title} title={p.title} prompt={p.prompt} />
        ))}
      </div>
    </GlassPanel>
  );
}

function CrmPromptCard({ title, prompt }: { title: string; prompt: string }) {
  const { copy, copied } = useCopyToClipboard();
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-glass-border bg-black/20 p-4">
      <div className="font-display text-sm font-semibold">{title}</div>
      <blockquote className="flex-1 whitespace-pre-wrap rounded-lg border border-glass-border bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {prompt}
      </blockquote>
      <button
        type="button"
        onClick={() => {
          void copy(prompt).then((ok) => {
            if (ok) toast.success("Prompt copied");
          });
        }}
        className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-glass-border bg-glass/40 px-3 py-1.5 text-xs font-medium hover:bg-glass-strong"
      >
        <IconCopy size={12} /> {copied ? "Copied" : "Copy prompt"}
      </button>
    </div>
  );
}

