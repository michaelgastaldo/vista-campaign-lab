/**
 * Integration recipes — this template is remixed by many teams, so we don't
 * pre-wire anyone's credentials. Instead, each card here gives the user a
 * copy-pasteable Lovable prompt + step-by-step setup guide they run in their
 * own remix.
 */

export type IntegrationCategory =
  | "crm"
  | "analytics"
  | "email"
  | "ads"
  | "comms"
  | "storage"
  | "events";

export type IntegrationRecipe = {
  id: string;
  name: string;
  category: IntegrationCategory;
  glyph: string;
  accent: string; // tailwind gradient, used for the tile
  oneLiner: string;
  valueProps: string[];
  prompt: string;
  steps: { title: string; body: string; link?: { label: string; href: string } }[];
  builds: string[];
  docsUrl?: string;
};

export const INTEGRATION_CATEGORIES: { id: IntegrationCategory; label: string }[] = [
  { id: "crm", label: "CRM" },
  { id: "analytics", label: "Analytics" },
  { id: "email", label: "Email" },
  { id: "ads", label: "Ads" },
  { id: "comms", label: "Comms" },
  { id: "storage", label: "Storage" },
  { id: "events", label: "Events" },
];

export const INTEGRATION_RECIPES: IntegrationRecipe[] = [
  {
    id: "hubspot",
    name: "CRM (HubSpot)",
    category: "crm",
    glyph: "H",
    accent: "from-[#FF7A59] to-[#FF9C7A]",
    oneLiner: "Pull campaigns, push lists, deep-link to CRM assets.",
    valueProps: [
      "Per-workspace CampaignPerformance KPI cards",
      "Push imported lists to your CRM as static lists",
      "Deep-link buttons jump straight to the CRM UI",
    ],
    prompt: `Add a CRM integration (HubSpot) to my marketing app.

Use the Lovable HubSpot connector (gateway URL: https://connector-gateway.lovable.dev/hubspot).

Build:
1. A server function \`crm_fetch_campaigns\` that fetches all CRM campaigns + assets, caches the JSON in a new table \`workspace_external_refs(org_id, integration_id, ref_key, payload, fetched_at)\`, refreshing every 30 minutes.
2. A new <CampaignPerformance/> card on the workspace detail page that shows opens / clicks / conversions per asset with deep-links to the CRM.
3. On the List Cleaner (/tools/import), add a "Push to CRM as static list" button calling \`crm_create_list\`.

Follow the existing TanStack server-fn pattern in src/lib/*.functions.ts and protect every fn with requireSupabaseAuth.`,
    steps: [
      {
        title: "Connect the HubSpot connector in Lovable",
        body: "In your remix, open Connectors → Add → HubSpot. Sign in with the account that owns your marketing portal.",
        link: { label: "Lovable Connectors", href: "https://docs.lovable.dev/integrations" },
      },
      {
        title: "Confirm scopes",
        body: "Marketing Hub Pro/Enterprise required for campaigns. Make sure these scopes are granted: crm.objects.contacts.read, crm.lists.write, marketing-email, marketing.campaigns.read.",
      },
      {
        title: "Paste the prompt above into Lovable",
        body: "Open chat, paste the prompt, and let it scaffold the server fns + UI. Review the migration before approving.",
      },
      {
        title: "Verify",
        body: "Open any workspace → CampaignPerformance card should populate within ~30s.",
      },
    ],
    builds: [
      "Server fn: crm_fetch_campaigns",
      "Server fn: crm_create_list",
      "Component: <CampaignPerformance/>",
      "Table: workspace_external_refs",
    ],
    docsUrl: "https://developers.hubspot.com/docs/api/overview",
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    category: "analytics",
    glyph: "G",
    accent: "from-[#F9AB00] to-[#E37400]",
    oneLiner: "Pull pageviews + conversions per UTM tag.",
    valueProps: [
      "Auto-fill workspace_kpis from real GA4 traffic",
      "Per-UTM conversion attribution",
      '"Last synced" chip with manual refresh',
    ],
    prompt: `Add Google Analytics 4 sync to my Marketing Command Center.

Use a service-account JSON stored in a new secret GA4_SERVICE_ACCOUNT_JSON, plus GA4_PROPERTY_ID.

Build:
1. Server fn \`ga4_sync_workspace(workspace_id)\` that calls the GA4 Data API runReport endpoint, filtering by every saved UTM tag for this workspace, and upserts results into workspace_kpis (channel, sent=sessions, clicks=engagedSessions, conversions=conversions).
2. A "Sync from GA4" button on the workspace Results section, plus a daily cron at /api/public/cron/ga4-sync that loops active workspaces.
3. Show a "Last synced 4m ago" chip on the Results header.`,
    steps: [
      {
        title: "Create a GA4 service account",
        body: "Google Cloud Console → IAM → Service Accounts → Create. Grant the JSON to your GA4 property as a Viewer (Admin → Account access management).",
        link: { label: "GA4 Data API quickstart", href: "https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries" },
      },
      {
        title: "Add secrets in Lovable",
        body: "Add GA4_SERVICE_ACCOUNT_JSON (paste the JSON) and GA4_PROPERTY_ID (e.g. 123456789).",
      },
      {
        title: "Paste the prompt above into Lovable",
        body: "Lovable will scaffold the server fn, button, and cron route.",
      },
    ],
    builds: [
      "Server fn: ga4_sync_workspace",
      "Cron route: /api/public/cron/ga4-sync",
      "UI: Sync button + last-synced chip",
    ],
  },
  {
    id: "plausible",
    name: "Plausible",
    category: "analytics",
    glyph: "P",
    accent: "from-[#5850EC] to-[#7B7AFF]",
    oneLiner: "Lightweight, privacy-friendly traffic per UTM.",
    valueProps: ["Simpler than GA4 — single API key", "Per-UTM stats in workspace_kpis"],
    prompt: `Add Plausible Analytics sync. Store PLAUSIBLE_SITE_ID and PLAUSIBLE_API_KEY as secrets.

Build a server fn \`plausible_sync_workspace\` that calls https://plausible.io/api/v2/query with filters on each saved UTM tag and upserts into workspace_kpis. Add a "Sync from Plausible" button on Results.`,
    steps: [
      {
        title: "Create an API key",
        body: "Plausible → Account Settings → API Keys → New Key (with Stats API access).",
        link: { label: "Plausible Stats API", href: "https://plausible.io/docs/stats-api" },
      },
      { title: "Add secrets", body: "Add PLAUSIBLE_SITE_ID and PLAUSIBLE_API_KEY in Lovable settings." },
      { title: "Paste the prompt", body: "Lovable will scaffold the server fn and the sync button." },
    ],
    builds: ["Server fn: plausible_sync_workspace", "UI: Sync button on Results"],
  },
  {
    id: "slack",
    name: "Slack",
    category: "comms",
    glyph: "S",
    accent: "from-[#4A154B] to-[#ECB22E]",
    oneLiner: "Notify on status changes, approvals, A/B winners.",
    valueProps: [
      "No code — uses existing webhook system",
      "Per-workspace channel routing",
      "Handles status_changed, asset.approved, variant.winner_picked events",
    ],
    prompt: `I want Slack notifications for my Marketing Command Center.

Webhook URL is already supported via /connectors. Build:
1. A "Notify Slack" toggle on each workspace (stored in user_preferences key 'slack-channel:{workspace_id}').
2. A pre-built Slack message template per event type with workspace name, actor, and a deep-link.
3. A "Test message" button next to each Slack connector card.`,
    steps: [
      {
        title: "Create a Slack incoming webhook",
        body: "https://api.slack.com/apps → Create App → Incoming Webhooks → Add → choose channel.",
        link: { label: "Slack Incoming Webhooks", href: "https://api.slack.com/messaging/webhooks" },
      },
      {
        title: "Paste the URL into Connectors",
        body: "Open /connectors → Slack → paste the hooks.slack.com URL. That's it — events will fire.",
      },
    ],
    builds: ["Already wired via webhook_subscriptions — just paste a URL"],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "email",
    glyph: "M",
    accent: "from-[#FFE01B] to-[#FFB347]",
    oneLiner: "Push imported lists straight to a Mailchimp audience.",
    valueProps: ["One-click sync from List Cleaner", "Tag contacts by source attribution"],
    prompt: `Add Mailchimp push to my List Cleaner.

Store MAILCHIMP_API_KEY (the key already encodes the data center, e.g. xxx-us21).

Build a server fn \`mailchimp_push_list(list_id)\` that batches contacts (500/req) into POST /3.0/lists/{audience_id}, tagging each with the source_attribution. Add a "Push to Mailchimp" dropdown on the List Cleaner detail view.`,
    steps: [
      {
        title: "Create an API key",
        body: "Mailchimp → Account → Extras → API keys → Create.",
        link: { label: "Mailchimp Marketing API", href: "https://mailchimp.com/developer/marketing/api/" },
      },
      { title: "Add secret", body: "Add MAILCHIMP_API_KEY in Lovable settings." },
      { title: "Paste the prompt", body: "Lovable adds the push button + server fn." },
    ],
    builds: ["Server fn: mailchimp_push_list", "UI: Push dropdown on List Cleaner"],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "storage",
    glyph: "S",
    accent: "from-[#0F9D58] to-[#34A853]",
    oneLiner: "Mirror workspaces + status to a Sheet for execs.",
    valueProps: ["No-code — Apps Script web app receives JSON", "Append-only audit trail"],
    prompt: `Wire workspace.status_changed events to a Google Sheet via the existing webhooks.

This is already supported — connect via /connectors → Google Sheets → paste the Apps Script Web App URL.`,
    steps: [
      {
        title: "Create the Apps Script",
        body: 'In any Sheet → Extensions → Apps Script → paste a doPost(e) handler that appends e.postData.contents to the active sheet → Deploy → Web app → Execute as: Me, Access: Anyone.',
        link: { label: "Apps Script Web Apps", href: "https://developers.google.com/apps-script/guides/web" },
      },
      { title: "Connect", body: "/connectors → Google Sheets → paste the script.google.com URL." },
    ],
    builds: ["Already wired via webhook_subscriptions"],
  },
  {
    id: "notion",
    name: "Notion",
    category: "storage",
    glyph: "N",
    accent: "from-[#FFFFFF] to-[#A0A0A0]",
    oneLiner: "Mirror brief + status to a Notion database.",
    valueProps: ["Bi-directional via Notion's API + your webhook receiver"],
    prompt: `Mirror workspace status changes to a Notion database.

Store NOTION_TOKEN (internal integration secret) and NOTION_DATABASE_ID.

Build a server fn \`notion_sync_workspace(workspace_id)\` that upserts a page in the database with properties: Name, Status, Goal, Owner, Channel. Trigger on every workspace update.`,
    steps: [
      {
        title: "Create a Notion integration",
        body: "https://www.notion.so/my-integrations → New integration → copy the Internal Integration Secret.",
        link: { label: "Notion API", href: "https://developers.notion.com/" },
      },
      {
        title: "Share the database with the integration",
        body: "Open the target database → ⋯ menu → Add connections → pick your integration. Copy the database ID from the URL.",
      },
      { title: "Add secrets + paste prompt", body: "Add NOTION_TOKEN, NOTION_DATABASE_ID, then run the prompt." },
    ],
    builds: ["Server fn: notion_sync_workspace", "Trigger on workspace UPDATE"],
  },
  {
    id: "meta-ads",
    name: "Meta Ads",
    category: "ads",
    glyph: "f",
    accent: "from-[#0866FF] to-[#1877F2]",
    oneLiner: "Pull spend back into workspace budget actuals.",
    valueProps: ["Auto-update workspace_budget_lines.actual_cents nightly"],
    prompt: `Pull Meta Ads spend into workspace budgets nightly.

Store META_ACCESS_TOKEN (long-lived) and META_AD_ACCOUNT_ID.

Build:
1. Server fn \`meta_pull_spend\` calling /v20.0/{ad-account}/insights with date range = current month, grouped by campaign name.
2. Match Meta campaign name to workspace_budget_lines.label (fuzzy) and update actual_cents.
3. Cron at /api/public/cron/meta-spend running daily.`,
    steps: [
      {
        title: "Get a long-lived token",
        body: "developers.facebook.com → your app → Tools → Graph API Explorer → exchange short-lived for 60-day token.",
        link: { label: "Marketing API", href: "https://developers.facebook.com/docs/marketing-apis" },
      },
      { title: "Add secrets", body: "META_ACCESS_TOKEN, META_AD_ACCOUNT_ID (e.g. act_1234567890)." },
      { title: "Paste the prompt", body: "Lovable adds the cron + matching logic." },
    ],
    builds: ["Server fn: meta_pull_spend", "Cron: /api/public/cron/meta-spend"],
  },
  {
    id: "google-ads",
    name: "Google Ads",
    category: "ads",
    glyph: "G",
    accent: "from-[#4285F4] to-[#34A853]",
    oneLiner: "Pull spend + clicks per UTM into KPIs and budget actuals.",
    valueProps: ["Match by utm_campaign", "Updates both budget actuals and KPIs"],
    prompt: `Pull Google Ads spend into workspace budgets nightly.

Store GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID, plus GOOGLE_ADS_REFRESH_TOKEN (OAuth).

Build a server fn \`google_ads_pull_spend\` querying the GAQL endpoint for campaign.name + metrics.cost_micros + metrics.clicks. Match campaign name to workspace_budget_lines.label and upsert actuals + workspace_kpis.`,
    steps: [
      {
        title: "Apply for Google Ads API access",
        body: "ads.google.com → Tools → API Center → request a developer token (basic access is enough for one account).",
        link: { label: "Google Ads API", href: "https://developers.google.com/google-ads/api/docs/start" },
      },
      { title: "Add secrets", body: "Developer token + customer ID + OAuth refresh token." },
      { title: "Paste the prompt", body: "Lovable wires the GAQL query + cron." },
    ],
    builds: ["Server fn: google_ads_pull_spend", "Cron: /api/public/cron/google-ads-spend"],
  },
  {
    id: "segment",
    name: "Segment",
    category: "events",
    glyph: "S",
    accent: "from-[#52BD95] to-[#3A8C72]",
    oneLiner: "Stream events into the Funnel Dashboard.",
    valueProps: ["One write key fits all", "Auto-populates funnel_events"],
    prompt: `Add a Segment webhook receiver to populate funnel_events.

Build a server route at /api/public/segment/webhook that:
1. Verifies HMAC with SEGMENT_SHARED_SECRET.
2. Maps event names ("Lead Captured" → stage 'lead', "Demo Booked" → 'mql', "Opportunity Created" → 'sql', "Closed Won" → 'won') configurable via a small JSON in user_preferences key 'segment-stage-map'.
3. Inserts into funnel_events with source = event.context.campaign.source.`,
    steps: [
      {
        title: "Add a Segment webhook destination",
        body: "Segment → Destinations → Add → Webhooks → URL: https://<your-app>/api/public/segment/webhook → Shared Secret.",
        link: { label: "Segment webhooks", href: "https://segment.com/docs/connections/destinations/catalog/webhooks/" },
      },
      { title: "Add SEGMENT_SHARED_SECRET secret", body: "Same value you set in Segment." },
      { title: "Paste the prompt", body: "Lovable scaffolds the receiver + signature check." },
    ],
    builds: ["Route: /api/public/segment/webhook", "Stage mapping in user_preferences"],
  },
  {
    id: "zapier",
    name: "Zapier / Make",
    category: "comms",
    glyph: "Z",
    accent: "from-[#FF4F00] to-[#FF8E2B]",
    oneLiner: "Generic webhook bridge to 6,000+ apps.",
    valueProps: ["Already supported via custom webhook in /connectors"],
    prompt: "Already supported — open /connectors → Custom webhook and paste your Zapier/Make trigger URL.",
    steps: [
      {
        title: "Create a Zap / Scenario",
        body: 'Trigger: "Webhooks → Catch Hook". Copy the URL.',
        link: { label: "Zapier Webhooks", href: "https://zapier.com/apps/webhook/integrations" },
      },
      { title: "Paste into Connectors", body: "/connectors → Custom webhook → paste the URL." },
    ],
    builds: ["Already wired"],
  },
];

export const RECIPES_BY_ID: Record<string, IntegrationRecipe> = Object.fromEntries(
  INTEGRATION_RECIPES.map((r) => [r.id, r]),
);
