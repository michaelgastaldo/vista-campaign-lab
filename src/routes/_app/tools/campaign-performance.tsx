import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { NumberTicker } from "@/components/ui-custom/NumberTicker";
import {
  IconCampaign,
  IconArrowRight,
  IconChart,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { DemoDataBanner } from "@/components/ui-custom/DemoDataBanner";
import { listCrmCampaigns, listCrmCampaignAssets, getCrmStatus } from "@/lib/crm/index.functions";

export const Route = createFileRoute("/_app/tools/campaign-performance")({
  component: () => <CampaignPerformanceContent />,
});


type Campaign = Awaited<ReturnType<typeof listCrmCampaigns>>["campaigns"][number];
type Asset = Awaited<ReturnType<typeof listCrmCampaignAssets>>["assets"][number];

const ASSET_LABEL: Record<string, string> = {
  MARKETING_EMAIL: "Email",
  MARKETING_EVENT: "Event",
  AD_CAMPAIGN: "Ad",
  SOCIAL_POST: "Social",
  CTA: "CTA",
  FORM: "Form",
  LANDING_PAGE: "Landing page",
  BLOG_POST: "Blog",
  WORKFLOW: "Workflow",
  SEQUENCE: "Sequence",
  LIST: "List",
};

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function CampaignPerformanceSummary() {
  const fetchCampaigns = useServerFn(listCrmCampaigns);
  const fetchStatus = useServerFn(getCrmStatus);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getCrmStatus>> | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    (async () => {
      const [s, list] = await Promise.all([fetchStatus(), fetchCampaigns()]);
      setStatus(s);
      setCampaigns(list.campaigns);
    })();
  }, [fetchCampaigns, fetchStatus]);

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => ({
        sessions: acc.sessions + c.sessions,
        first: acc.first + c.new_contacts_first_touch,
        influenced: acc.influenced + c.influenced_contacts,
        revenue_cents: acc.revenue_cents + c.influenced_revenue_cents,
      }),
      { sessions: 0, first: 0, influenced: 0, revenue_cents: 0 },
    );
  }, [campaigns]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">

        <GlassPanel tier="strong" className="relative p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Influenced revenue
            </div>
            {status && !status.connected && (
              <DemoDataBanner variant="chip" />
            )}
          </div>
          <div className="mt-2 font-display text-4xl md:text-5xl leading-none">
            {money(totals.revenue_cents)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Across {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
          </div>
        </GlassPanel>
        <Kpi label="Sessions" value={totals.sessions} />
        <Kpi label="First-touch" value={totals.first} />
        <Kpi label="Influenced contacts" value={totals.influenced} />
      </div>
    </div>
  );
}

export function CampaignPerformanceContent({ hideHeader = false, hideSummary = false }: { hideHeader?: boolean; hideSummary?: boolean } = {}) {
  const fetchCampaigns = useServerFn(listCrmCampaigns);
  const fetchAssets = useServerFn(listCrmCampaignAssets);
  const fetchStatus = useServerFn(getCrmStatus);

  const [status, setStatus] = useState<Awaited<ReturnType<typeof getCrmStatus>> | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mocked, setMocked] = useState(false);
  const [assetsMocked, setAssetsMocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, list] = await Promise.all([fetchStatus(), fetchCampaigns()]);
        setStatus(s);
        setCampaigns(list.campaigns);
        setMocked(list.mocked);
        if (list.campaigns.length) setSelected(list.campaigns[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchCampaigns, fetchStatus]);

  useEffect(() => {
    if (!selected) return;
    setAssetsLoading(true);
    fetchAssets({ data: { campaign_id: selected } })
      .then((r) => { setAssets(r.assets); setAssetsMocked(r.mocked); })
      .finally(() => setAssetsLoading(false));
  }, [selected, fetchAssets]);

  const current = useMemo(() => campaigns.find((c) => c.id === selected) ?? null, [campaigns, selected]);

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => ({
        sessions: acc.sessions + c.sessions,
        first: acc.first + c.new_contacts_first_touch,
        last: acc.last + c.new_contacts_last_touch,
        influenced: acc.influenced + c.influenced_contacts,
        deals: acc.deals + c.influenced_deals,
        revenue_cents: acc.revenue_cents + c.influenced_revenue_cents,
        attendees: acc.attendees + c.attendees,
        no_shows: acc.no_shows + c.no_shows,
      }),
      { sessions: 0, first: 0, last: 0, influenced: 0, deals: 0, revenue_cents: 0, attendees: 0, no_shows: 0 },
    );
  }, [campaigns]);

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <PageHexBadge hue={200} icon={<IconChart size={26} />} aria-label="Performance" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/70">Performance</div>
              <h1 className="font-display text-3xl">Campaign performance</h1>
            </div>
          </div>
          {status && !status.connected && <DemoDataBanner variant="chip" />}
        </div>
      )}

      {mocked && <DemoDataBanner storageKey="campaign-performance" />}

      {!hideSummary && (
        <GlassPanel tier="strong" className="overflow-hidden p-0">
          <div className="grid divide-y divide-glass-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <SummaryStat
              label="Influenced revenue"
              value={money(totals.revenue_cents)}
              hint={`${campaigns.length} ${campaigns.length === 1 ? "campaign" : "campaigns"}`}
              accent
            />
            <SummaryStat label="Sessions" value={totals.sessions.toLocaleString()} />
            <SummaryStat label="First-touch" value={totals.first.toLocaleString()} />
            <SummaryStat label="Influenced contacts" value={totals.influenced.toLocaleString()} />
          </div>
        </GlassPanel>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <GlassPanel className="max-h-[640px] overflow-hidden p-0">
          <div className="border-b border-glass-border px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Campaigns · {campaigns.length}
            </div>
          </div>
          <div className="max-h-[580px] overflow-auto p-2">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : campaigns.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No campaigns.</div>
            ) : (
              <ul className="space-y-0.5">
                {campaigns.map((c) => {
                  const isActive = selected === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelected(c.id)}
                        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`h-8 w-[3px] shrink-0 rounded-full transition ${
                            isActive ? "bg-primary" : "bg-transparent group-hover:bg-glass-border"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium leading-tight">{c.name}</div>
                          <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] opacity-60">
                            {c.type ?? "—"} · {c.status ?? "—"}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </GlassPanel>

        <div className="space-y-4">
          {current ? (
            <>
              <GlassPanel tier="strong" className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                      {current.type ?? "Campaign"}
                    </div>
                    <h2 className="mt-1 font-display text-2xl leading-tight">{current.name}</h2>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {current.start_date ?? "?"} → {current.end_date ?? "?"}
                    </div>
                  </div>
                  {current.status && (
                    <span className="shrink-0 rounded-full border border-glass-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {current.status}
                    </span>
                  )}
                </div>

                <div className="mt-5 grid gap-px overflow-hidden rounded-xl bg-glass-border sm:grid-cols-3">
                  <MiniKpi label="Sessions" value={current.sessions} />
                  <MiniKpi label="First-touch" value={current.new_contacts_first_touch} />
                  <MiniKpi label="Last-touch" value={current.new_contacts_last_touch} />
                  <MiniKpi label="Influenced contacts" value={current.influenced_contacts} />
                  <MiniKpi label="Influenced deals" value={current.influenced_deals} />
                  <MiniKpi label="Influenced revenue" value={money(current.influenced_revenue_cents)} highlight />
                  {(current.attendees > 0 || current.no_shows > 0) && (
                    <>
                      <MiniKpi label="Attendees" value={current.attendees} />
                      <MiniKpi label="No-shows" value={current.no_shows} />
                    </>
                  )}
                </div>
              </GlassPanel>

              <GlassPanel className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Linked assets{assets.length ? ` · ${assets.length}` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    {assetsMocked && <DemoDataBanner variant="chip" />}
                    {assetsLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
                  </div>
                </div>
                <div className="mt-3 divide-y divide-glass-border">
                  {assets.length === 0 && !assetsLoading ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">No linked assets.</div>
                  ) : (
                    assets.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 py-2.5">
                        <span className="min-w-[68px] rounded-md bg-muted/40 px-2 py-0.5 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {ASSET_LABEL[a.type] ?? a.type}
                        </span>
                        <span className="flex-1 truncate text-sm">{a.name}</span>
                        {a.deep_link && a.deep_link !== "#" && (
                          <a
                            href={a.deep_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Open <IconArrowRight size={12} />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </GlassPanel>
            </>
          ) : (
            <GlassPanel className="p-8 text-center text-sm text-muted-foreground">
              Select a campaign on the left.
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 font-display leading-none tabular-nums ${
          accent ? "text-3xl md:text-4xl text-foreground" : "text-2xl md:text-3xl text-foreground/90"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Kpi({ label, value, format }: { label: string; value: number; format?: "money" }) {
  return (
    <GlassPanel className="p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">{label}</div>
      <div className="mt-2 font-display text-3xl">
        {format === "money" ? money(value) : <NumberTicker value={value} />}
      </div>
    </GlassPanel>
  );
}

function MiniKpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 ${highlight ? "bg-primary/10" : "bg-[color:var(--color-ink)]/60"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1.5 font-display tabular-nums leading-none text-xl ${highlight ? "text-primary" : "text-foreground/95"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

