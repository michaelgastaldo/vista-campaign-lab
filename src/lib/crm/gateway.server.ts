/**
 * Server-only CRM gateway helpers. Picks the active provider from env
 * (HubSpot today) and returns typed results. Every feature calls these
 * via thin `createServerFn` wrappers — never directly from components.
 *
 * No vendor SDKs: everything goes through Lovable connector gateway.
 */

import type {
  CrmCampaignBundle,
  CrmCampaignSummary,
  CrmLinkedAsset,
  CrmProvider,
} from "./types";

const HUBSPOT_GATEWAY = "https://connector-gateway.lovable.dev/hubspot";

function activeProvider(): CrmProvider {
  if (process.env.HUBSPOT_API_KEY) return "hubspot";
  return "none";
}

function hubspotHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const hubspot = process.env.HUBSPOT_API_KEY;
  if (!lovable || !hubspot) {
    throw new Error("CRM not connected — connect a CRM under Connectors.");
  }
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": hubspot,
    "Content-Type": "application/json",
  };
}

export function getActiveProvider(): CrmProvider {
  return activeProvider();
}

export async function fetchConnectionStatus() {
  const provider = activeProvider();
  if (provider === "none") {
    return {
      provider,
      connected: false,
      account_label: null,
      reason: "No CRM connected. Connect a CRM to enable bundles, lists and performance data.",
    };
  }
  try {
    const r = await fetch(`${HUBSPOT_GATEWAY}/account-info/v3/details`, {
      headers: hubspotHeaders(),
    });
    if (!r.ok) {
      return {
        provider,
        connected: false,
        account_label: null,
        reason: `Your CRM rejected the call (${r.status}). Reconnect under Connectors.`,
      };
    }
    const j = (await r.json()) as { portalId?: number; uiDomain?: string };
    return {
      provider,
      connected: true,
      account_label: j.portalId ? `CRM · account ${j.portalId}` : "CRM connected",
    };
  } catch (e) {
    return {
      provider,
      connected: false,
      account_label: null,
      reason: e instanceof Error ? e.message : "Unknown CRM error",
    };
  }
}

/**
 * Create a linked campaign + marketing-event pair in the CRM. Returns
 * the canonical bundle so the caller can show deep links.
 */
export async function createCampaignBundle(input: {
  generated_name: string;
  campaign_type: string;
  audience: "b2b" | "b2c";
  brief_name: string;
  promotion_start: string;
  promotion_end: string;
  event_start: string | null;
  event_end: string | null;
  budget_cents: number;
  notes: string | null;
}): Promise<CrmCampaignBundle> {
  if (activeProvider() !== "hubspot") {
    return {
      campaign_id: `mock-${Date.now()}`,
      event_id: input.event_start ? `mock-evt-${Date.now()}` : null,
      generated_name: input.generated_name,
    };
  }
  const campaignRes = await fetch(`${HUBSPOT_GATEWAY}/marketing/v3/campaigns`, {
    method: "POST",
    headers: hubspotHeaders(),
    body: JSON.stringify({
      properties: {
        hs_name: input.generated_name,
        hs_notes: input.notes ?? "",
        hs_budget_total: input.budget_cents / 100,
        hs_audience: input.audience.toUpperCase(),
        hs_start_date: input.promotion_start,
        hs_end_date: input.promotion_end,
      },
    }),
  });
  const campaign = (await campaignRes.json()) as { id?: string };
  if (!campaign.id) throw new Error("CRM rejected campaign creation");

  let eventId: string | null = null;
  if (input.event_start && input.event_end) {
    const evt = await fetch(`${HUBSPOT_GATEWAY}/marketing/v3/marketing-events/events`, {
      method: "POST",
      headers: hubspotHeaders(),
      body: JSON.stringify({
        eventName: input.generated_name,
        eventType: input.campaign_type,
        startDateTime: input.event_start,
        endDateTime: input.event_end,
      }),
    });
    const evtJson = (await evt.json()) as { id?: string };
    eventId = evtJson.id ?? null;
  }
  return { campaign_id: campaign.id, event_id: eventId, generated_name: input.generated_name };
}

export async function fetchCampaigns(): Promise<{ mocked: boolean; campaigns: CrmCampaignSummary[] }> {
  if (activeProvider() !== "hubspot") {
    return { mocked: true, campaigns: mockCampaigns() };
  }
  const r = await fetch(`${HUBSPOT_GATEWAY}/marketing/v3/campaigns?limit=50`, {
    headers: hubspotHeaders(),
  });
  if (!r.ok) return { mocked: true, campaigns: mockCampaigns() };
  const j = (await r.json()) as {
    results: { id: string; properties: Record<string, string> }[];
  };
  const campaigns = (j.results ?? []).map((c) => ({
    id: c.id,
    name: c.properties.hs_name ?? "Untitled",
    type: c.properties.hs_campaign_type ?? null,
    status: c.properties.hs_status ?? null,
    start_date: c.properties.hs_start_date ?? null,
    end_date: c.properties.hs_end_date ?? null,
    sessions: Number(c.properties.hs_sessions ?? 0),
    new_contacts_first_touch: Number(c.properties.hs_num_contacts_first_touch ?? 0),
    new_contacts_last_touch: Number(c.properties.hs_num_contacts_last_touch ?? 0),
    influenced_contacts: Number(c.properties.hs_num_contacts_influenced ?? 0),
    influenced_deals: Number(c.properties.hs_num_deals_influenced ?? 0),
    influenced_revenue_cents: Number(c.properties.hs_revenue_influenced ?? 0) * 100,
    attendees: Number(c.properties.hs_attendees ?? 0),
    no_shows: Number(c.properties.hs_no_shows ?? 0),
  }));
  return { mocked: false, campaigns };
}

function mockCampaigns(): CrmCampaignSummary[] {
  const names = [
    "Q2 Product Launch — EMEA",
    "Customer Advocacy Webinar Series",
    "Field Tour — Berlin/Paris/London",
    "Always-On Demand Gen",
    "Annual User Conference",
  ];
  return names.map((name, i) => ({
    id: `mock-${i + 1}`,
    name,
    type: i % 2 === 0 ? "webinar" : "event",
    status: "ACTIVE",
    start_date: "2026-04-01",
    end_date: "2026-06-30",
    sessions: 4200 - i * 320,
    new_contacts_first_touch: 1100 - i * 90,
    new_contacts_last_touch: 720 - i * 60,
    influenced_contacts: 3400 - i * 220,
    influenced_deals: 64 - i * 6,
    influenced_revenue_cents: (840000 - i * 80000) * 100,
    attendees: i % 2 === 0 ? 0 : 220 - i * 18,
    no_shows: i % 2 === 0 ? 0 : 60 - i * 4,
  }));
}

export async function fetchCampaignAssets(campaignId: string): Promise<{ mocked: boolean; assets: CrmLinkedAsset[] }> {
  if (activeProvider() !== "hubspot" || campaignId.startsWith("mock-")) {
    return {
      mocked: true,
      assets: [
        { id: "a1", type: "MARKETING_EMAIL", name: "Launch announcement", deep_link: "#" },
        { id: "a2", type: "LANDING_PAGE", name: "Hero landing page", deep_link: "#" },
        { id: "a3", type: "FORM", name: "Demo request form", deep_link: "#" },
        { id: "a4", type: "WORKFLOW", name: "Lead nurture sequence", deep_link: "#" },
        { id: "a5", type: "AD_CAMPAIGN", name: "LinkedIn — EMEA", deep_link: "#" },
      ],
    };
  }
  const r = await fetch(`${HUBSPOT_GATEWAY}/marketing/v3/campaigns/${campaignId}/assets`, {
    headers: hubspotHeaders(),
  });
  if (!r.ok) return { mocked: false, assets: [] };
  const j = (await r.json()) as {
    results: { id: string; type: string; name: string }[];
  };
  const assets = (j.results ?? []).map((a) => ({
    id: a.id,
    type: a.type as CrmLinkedAsset["type"],
    name: a.name,
    deep_link: `https://app.hubspot.com/marketing/assets/${a.type.toLowerCase()}/${a.id}`,
  }));
  return { mocked: false, assets };
}
