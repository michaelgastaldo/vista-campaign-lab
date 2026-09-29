/**
 * Unified integrations catalog.
 *
 * Every external service falls into ONE of four setup methods — each requires
 * very different scaffolding, so the UI surfaces them as primary tabs:
 *
 *   1. "connector"  – Lovable manages OAuth via the connector gateway.
 *                     One click. No API key. Builder-account scope.
 *   2. "api-key"    – Paste a long-lived API key as a Lovable secret.
 *                     Server-side fetch, no OAuth.
 *   3. "oauth-app"  – Each END-USER signs in with their own account.
 *                     Requires a real OAuth app in the provider console.
 *   4. "webhook"    – Inbound events. Public route + signature verification.
 *
 * The `prompt` field on each entry is generated method-aware (see
 * buildPromptFor) so what users paste into Lovable chat actually produces
 * correct code for this stack (TanStack Start + server functions + Lovable
 * Cloud).
 */

export type IntegrationMethod = "connector" | "api-key" | "oauth-app" | "webhook";

export type IntegrationCat =
  | "CRM"
  | "Email"
  | "Analytics"
  | "Ads"
  | "Comms"
  | "Storage"
  | "Productivity"
  | "Data"
  | "AI"
  | "Events";

export type IntegrationEntry = {
  id: string;
  name: string;
  /** simpleicons.org slug — drives the logo */
  slug?: string;
  category: IntegrationCat;
  method: IntegrationMethod;
  blurb: string;
  /** Used inside generated prompts to describe the use case. */
  useCase: string;
  /** Where it should show up in the app, used inside generated prompts. */
  placement?: string;
  /** Optional link out to provider's API/OAuth docs. */
  docsUrl?: string;
  /** Optional recipe id in src/data/integration-recipes.ts for the rich dialog. */
  recipeId?: string;

  // method-specific knobs:
  /** connector_id for the Lovable connector picker. */
  connectorId?: string;
  /**
   * Whether this connector proxies through `connector-gateway.lovable.dev`.
   * A few connectors (ElevenLabs, Perplexity, Firecrawl) expose a direct API
   * and the injected env var IS the real provider API key — call the provider
   * directly in that case. Defaults to true for connector-method entries.
   */
  gateway?: boolean;
  /** For non-gateway connectors: provider's REST base URL. */
  directApiBase?: string;
  /** For non-gateway connectors: auth header pattern, e.g. `xi-api-key: <key>`. */
  directAuthHeader?: string;
  /** Scope hint surfaced in the prompt so the agent requests them up front. */
  scopes?: string;
  /** Env var name the gateway injects for this connection. */
  envVar?: string;

  /** For api-key method — where to generate the key. */
  dashboardUrl?: string;
  /** REST base URL (no trailing slash). */
  apiBase?: string;
  /** Auth header pattern (e.g. `Authorization: Bearer <key>` or `X-Api-Key: <key>`). */
  authHeader?: string;
  /** A safe/cheap endpoint we can hit to validate the key. */
  testEndpoint?: string;

  /** For oauth-app method — provider name (e.g. "Google", "Meta"). */
  provider?: string;
};

export const METHOD_META: Record<
  IntegrationMethod,
  { label: string; short: string; description: string; tone: string }
> = {
  connector: {
    label: "One-click connectors",
    short: "1-click",
    description:
      "Lovable handles the OAuth handshake — no API keys, no developer console. Best for connecting your own workspace account to power features.",
    tone: "from-primary/30 to-primary/0 text-primary",
  },
  "api-key": {
    label: "API key",
    short: "API key",
    description:
      "Paste a long-lived API key once, stored as a Lovable secret. Best for server-to-server calls where a single account is fine.",
    tone: "from-amber-400/30 to-amber-400/0 text-amber-300",
  },
  "oauth-app": {
    label: "Per-user OAuth",
    short: "OAuth",
    description:
      "Each end-user signs in with their own account. Requires a real OAuth app in the provider's developer console — heavier setup but unavoidable when users need their own data.",
    tone: "from-sky-400/30 to-sky-400/0 text-sky-300",
  },
  webhook: {
    label: "Webhooks",
    short: "Webhook",
    description:
      "Inbound events from external services. A public, signed endpoint in your app receives and verifies the payload.",
    tone: "from-emerald-400/30 to-emerald-400/0 text-emerald-300",
  },
};

export const CATEGORIES: IntegrationCat[] = [
  "CRM",
  "Email",
  "Analytics",
  "Ads",
  "Comms",
  "Storage",
  "Productivity",
  "Data",
  "AI",
  "Events",
];

export const INTEGRATIONS: IntegrationEntry[] = [
  // ============= ONE-CLICK CONNECTORS (Lovable-managed OAuth) =============
  {
    id: "hubspot",
    name: "CRM (HubSpot)",
    slug: "hubspot",
    category: "CRM",
    method: "connector",
    connectorId: "hubspot",
    envVar: "HUBSPOT_API_KEY",
    recipeId: "hubspot",
    blurb: "Pull CRM campaigns + contacts, push imported lists, deep-link contacts.",
    useCase: "pull CRM campaigns and push imported lists from this app",
    placement: "the Campaigns page, behind the generic CRM adapter in src/lib/crm/*",
    scopes: "crm.objects.contacts.read, crm.objects.contacts.write, crm.lists.read, crm.lists.write",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    slug: "googlecalendar",
    category: "Productivity",
    method: "connector",
    connectorId: "google_calendar",
    envVar: "GOOGLE_CALENDAR_API_KEY",
    blurb: "Sync campaign send dates + milestones to a shared team calendar.",
    useCase: "push campaign milestones (kickoff, send-date, retro) to a Google Calendar as events, and pull existing events into the Calendar page",
    placement: "the Calendar page (/calendar) as an overlay on top of campaign spans",
    scopes: "calendar.events",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    slug: "googlesheets",
    category: "Productivity",
    method: "connector",
    connectorId: "google_sheets",
    envVar: "GOOGLE_SHEETS_API_KEY",
    blurb: "Mirror campaign list + status into a Sheet for execs to view.",
    useCase: "export my campaigns list to a Google Sheet the user picks, and re-sync on demand",
    placement: 'an "Export to Sheets" action on the Campaigns page',
    scopes: "spreadsheets, drive.file",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    slug: "googledrive",
    category: "Storage",
    method: "connector",
    connectorId: "google_drive",
    envVar: "GOOGLE_DRIVE_API_KEY",
    blurb: "Attach briefs, decks and assets from Drive into a campaign.",
    useCase: "let me browse and attach Google Drive files to a campaign's assets list",
    placement: "the campaign detail Assets panel",
    scopes: "drive.file, drive.readonly",
  },
  {
    id: "google_docs",
    name: "Google Docs",
    slug: "googledocs",
    category: "Productivity",
    method: "connector",
    connectorId: "google_docs",
    envVar: "GOOGLE_DOCS_API_KEY",
    blurb: "Generate a campaign brief Doc and keep it linked for live editing.",
    useCase: "create a Google Doc from the campaign brief template and link it on the campaign",
    placement: 'the campaign Brief tab with a "Open in Docs" button',
    scopes: "documents, drive.file",
  },
  {
    id: "google_slides",
    name: "Google Slides",
    slug: "googleslides",
    category: "Productivity",
    method: "connector",
    connectorId: "google_slides",
    envVar: "GOOGLE_SLIDES_API_KEY",
    blurb: "Generate a launch deck from a campaign and refresh it on demand.",
    useCase: "generate a Slides deck from a campaign and re-render it when the campaign data changes",
    placement: 'the campaign Plan tab as a "Generate launch deck" action',
    scopes: "presentations, drive.file",
  },
  {
    id: "slack",
    name: "Slack",
    slug: "slack",
    category: "Comms",
    method: "connector",
    connectorId: "slack",
    envVar: "SLACK_API_KEY",
    recipeId: "slack",
    blurb: "Notify channels on status changes, approvals, and A/B winners.",
    useCase: "post messages to a Slack channel I pick when a campaign changes status or gets approved",
    placement: "the campaign detail page + a workspace-level Slack settings card",
    scopes: "chat:write, channels:read",
  },
  {
    id: "microsoft_teams",
    name: "Microsoft Teams",
    slug: "microsoftteams",
    category: "Comms",
    method: "connector",
    connectorId: "microsoft_teams",
    envVar: "MICROSOFT_TEAMS_API_KEY",
    blurb: "Pipe approvals and launch alerts into a Teams channel.",
    useCase: "post Microsoft Teams messages to a channel I pick on campaign status changes",
    placement: "the same hook as Slack notifications, behind a generic notifier",
  },
  {
    id: "notion",
    name: "Notion",
    slug: "notion",
    category: "Productivity",
    method: "connector",
    connectorId: "notion",
    envVar: "NOTION_API_KEY",
    recipeId: "notion",
    blurb: "Mirror briefs and status to a Notion database for the wider org.",
    useCase: "mirror my campaign list to a Notion database I pick, two-way",
    placement: "a workspace-level Notion settings card + auto-sync on campaign save",
  },
  {
    id: "linear",
    name: "Linear",
    slug: "linear",
    category: "Productivity",
    method: "connector",
    connectorId: "linear",
    envVar: "LINEAR_API_KEY",
    blurb: "Turn campaign checklist items into Linear issues with the right project + labels.",
    useCase: "create Linear issues from a campaign's checklist into a project I pick, and reflect issue status back on the checklist",
    placement: "the campaign Plan tab checklist items",
  },
  {
    id: "asana",
    name: "Asana",
    slug: "asana",
    category: "Productivity",
    method: "connector",
    connectorId: "asana",
    envVar: "ASANA_API_KEY",
    blurb: "Push campaign checklists into an Asana project as tasks.",
    useCase: "create Asana tasks from a campaign's checklist in a project I pick",
    placement: "the campaign Plan tab checklist items (mirrors the Linear path)",
  },
  {
    id: "airtable",
    name: "Airtable",
    slug: "airtable",
    category: "Data",
    method: "connector",
    connectorId: "airtable",
    envVar: "AIRTABLE_API_KEY",
    blurb: "Two-way sync campaigns with an Airtable base for reporting.",
    useCase: "two-way sync my campaigns list with an Airtable base + table I pick",
    placement: "a workspace-level Airtable settings card",
  },
  {
    id: "resend",
    name: "Resend",
    slug: "resend",
    category: "Email",
    method: "connector",
    connectorId: "resend",
    envVar: "RESEND_API_KEY",
    blurb: "Send branded transactional email from your own domain.",
    useCase: "send transactional emails (campaign approvals, weekly digest) via Resend",
    placement: "a notifications layer behind a generic mailer interface",
  },
  {
    id: "mailgun",
    name: "Mailgun",
    slug: "mailgun",
    category: "Email",
    method: "connector",
    connectorId: "mailgun",
    envVar: "MAILGUN_API_KEY",
    blurb: "Transactional email with EU region support.",
    useCase: "send transactional emails (campaign approvals, weekly digest) via Mailgun",
    placement: "the same generic mailer interface as Resend, swappable",
  },
  {
    id: "brevo",
    name: "Brevo",
    slug: "brevo",
    category: "Email",
    method: "connector",
    connectorId: "brevo",
    envVar: "BREVO_API_KEY",
    blurb: "Send email + SMS and sync contact lists.",
    useCase: "send emails and sync my audience list to Brevo",
    placement: "the Audience tool + the generic mailer interface",
  },
  {
    id: "twilio",
    name: "Twilio",
    slug: "twilio",
    category: "Comms",
    method: "connector",
    connectorId: "twilio",
    envVar: "TWILIO_API_KEY",
    blurb: "Trigger SMS alerts when a campaign goes live or stalls.",
    useCase: "send SMS alerts via Twilio when a campaign changes status",
    placement: "the campaign status-change hook (next to Slack/Teams notifiers)",
  },
  {
    id: "telegram",
    name: "Telegram",
    slug: "telegram",
    category: "Comms",
    method: "connector",
    connectorId: "telegram",
    envVar: "TELEGRAM_API_KEY",
    blurb: "Post campaign updates to a Telegram channel via the Bot API.",
    useCase: "post campaign updates to a Telegram chat I pick",
    placement: "the same status-change hook as Slack",
  },
  {
    id: "aws_s3",
    name: "AWS S3",
    slug: "amazons3",
    category: "Storage",
    method: "connector",
    connectorId: "aws_s3",
    envVar: "AWS_S3_API_KEY",
    blurb: "Store and serve campaign assets from your own S3 bucket.",
    useCase: "upload and read campaign asset files from an S3 bucket I pick",
    placement: "the campaign Assets panel (replaces local-only uploads)",
  },
  {
    id: "bigquery",
    name: "BigQuery",
    slug: "googlebigquery",
    category: "Data",
    method: "connector",
    connectorId: "bigquery",
    envVar: "BIGQUERY_API_KEY",
    blurb: "Query warehouse data to power funnel + revenue rollups.",
    useCase: "query BigQuery for funnel and revenue rollups",
    placement: "the Funnel dashboard cards",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    slug: "snowflake",
    category: "Data",
    method: "connector",
    connectorId: "snowflake",
    envVar: "SNOWFLAKE_API_KEY",
    blurb: "Pull from Snowflake for unified attribution + revenue rollups.",
    useCase: "query Snowflake for unified attribution and revenue rollups",
    placement: "the Funnel dashboard cards",
  },
  {
    id: "semrush",
    name: "Semrush",
    slug: "semrush",
    category: "AI",
    method: "connector",
    connectorId: "semrush",
    envVar: "SEMRUSH_API_KEY",
    blurb: "Pull keyword + competitor data into campaign briefs.",
    useCase: "pull Semrush keyword and competitor data into the campaign brief tool",
    placement: "the Campaign-in-a-box brief step",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    slug: "perplexity",
    category: "AI",
    method: "connector",
    connectorId: "perplexity",
    envVar: "PERPLEXITY_API_KEY",
    gateway: false,
    directApiBase: "https://api.perplexity.ai",
    directAuthHeader: "Authorization: Bearer <key>",
    blurb: "Ground campaign research with live web answers + citations.",
    useCase: "answer market-research questions inside the brief tool with cited sources",
    placement: "the Campaign-in-a-box research step",
    docsUrl: "https://docs.perplexity.ai/",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    slug: "elevenlabs",
    category: "AI",
    method: "connector",
    connectorId: "elevenlabs",
    envVar: "ELEVENLABS_API_KEY",
    gateway: false,
    directApiBase: "https://api.elevenlabs.io",
    directAuthHeader: "xi-api-key: <key>",
    blurb: "Generate VO for ad reads and short-form video scripts.",
    useCase: "turn campaign copy into spoken VO audio I can download",
    placement: 'a "Generate VO" button on the campaign Assets panel',
    docsUrl: "https://elevenlabs.io/docs/api-reference",
  },

  // ============= API KEY (paste-a-secret) =============
  {
    id: "plausible",
    name: "Plausible",
    slug: "plausibleanalytics",
    category: "Analytics",
    method: "api-key",
    recipeId: "plausible",
    dashboardUrl: "https://plausible.io/settings/api-keys",
    apiBase: "https://plausible.io/api/v2",
    authHeader: "Authorization: Bearer <key>",
    testEndpoint: "/query (a minimal aggregate query for the site)",
    blurb: "Lightweight, privacy-friendly traffic per UTM. Single workspace key.",
    useCase: "fetch pageviews + conversions per UTM and render them next to campaign KPIs",
    placement: "the Funnel dashboard's traffic source cards",
    docsUrl: "https://plausible.io/docs/stats-api",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    slug: "mailchimp",
    category: "Email",
    method: "api-key",
    recipeId: "mailchimp",
    dashboardUrl: "https://admin.mailchimp.com/account/api/",
    apiBase: "https://<dc>.api.mailchimp.com/3.0 (the <dc> data-center prefix is the suffix on the API key, e.g. us21)",
    authHeader: "Authorization: Basic <base64('anystring:<key>')>",
    testEndpoint: "GET /ping",
    blurb: "Push imported lists straight to a Mailchimp audience.",
    useCase: "push an audience I built in the Audience tool to a Mailchimp list I pick",
    placement: 'a "Push to Mailchimp" action on the Audience tool',
    docsUrl: "https://mailchimp.com/developer/marketing/api/",
  },
  {
    id: "posthog",
    name: "PostHog",
    slug: "posthog",
    category: "Analytics",
    method: "api-key",
    dashboardUrl: "https://app.posthog.com/project/settings (or the self-hosted URL)",
    apiBase: "https://app.posthog.com (or the configured PostHog host)",
    authHeader: "Authorization: Bearer <personal-api-key>",
    testEndpoint: "GET /api/projects/",
    blurb: "Query product analytics for funnel rollups + feature-flag state.",
    useCase: "query PostHog funnels per campaign and read feature-flag state",
    placement: "the Funnel dashboard funnel cards",
    docsUrl: "https://posthog.com/docs/api",
  },

  // ============= PER-USER OAUTH (each end-user authorizes) =============
  {
    id: "ga4",
    name: "Google Analytics 4",
    slug: "googleanalytics",
    category: "Analytics",
    method: "oauth-app",
    provider: "Google",
    recipeId: "ga4",
    scopes: "https://www.googleapis.com/auth/analytics.readonly",
    blurb: "Each user connects their own GA4 property — no shared service account.",
    useCase: "pull pageviews + conversions per UTM from the signed-in user's GA4 property",
    placement: "the Funnel dashboard, scoped per user",
    docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    slug: "googleads",
    category: "Ads",
    method: "oauth-app",
    provider: "Google",
    recipeId: "google-ads",
    scopes: "https://www.googleapis.com/auth/adwords",
    blurb: "Per-user OAuth — pull spend + clicks per UTM into KPI cards.",
    useCase: "pull spend and clicks per UTM from the signed-in user's Google Ads account",
    placement: "the campaign KPI cards + Funnel dashboard",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    slug: "meta",
    category: "Ads",
    method: "oauth-app",
    provider: "Meta",
    recipeId: "meta-ads",
    scopes: "ads_read, ads_management, business_management",
    blurb: "Per-user Facebook/Instagram ads spend back into workspace actuals.",
    useCase: "pull Meta Ads spend + results into campaign KPI cards for the signed-in user",
    placement: "the campaign KPI cards + Funnel dashboard",
    docsUrl: "https://developers.facebook.com/docs/marketing-apis/",
  },
  {
    id: "linkedin_ads",
    name: "LinkedIn Ads",
    slug: "linkedin",
    category: "Ads",
    method: "oauth-app",
    provider: "LinkedIn",
    scopes: "r_ads, r_ads_reporting",
    blurb: "Per-user pull of LinkedIn campaign spend + impressions.",
    useCase: "pull LinkedIn Ads spend + impressions into campaign KPI cards for the signed-in user",
    placement: "the campaign KPI cards",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
  },

  // ============= WEBHOOK (inbound events) =============
  {
    id: "zapier",
    name: "Zapier / Make",
    slug: "zapier",
    category: "Events",
    method: "webhook",
    recipeId: "zapier",
    blurb: "Generic webhook bridge to 6,000+ apps for inbound campaign events.",
    useCase: "receive arbitrary events from Zapier/Make and route them into the Funnel dashboard",
    placement: "the Funnel events stream",
  },
  {
    id: "segment",
    name: "Segment",
    slug: "segment",
    category: "Events",
    method: "webhook",
    recipeId: "segment",
    blurb: "Stream Segment events into the Funnel dashboard via HTTP destination.",
    useCase: "ingest Segment track/identify events and map them to campaign UTMs",
    placement: "the Funnel events stream",
    docsUrl: "https://segment.com/docs/connections/destinations/catalog/webhooks/",
  },
  {
    id: "customerio",
    name: "Customer.io",
    slug: "customerio",
    category: "Events",
    method: "webhook",
    blurb: "Inbound reporting webhooks for sends, opens, clicks, bounces.",
    useCase: "ingest Customer.io reporting webhooks and attribute them to campaigns by UTM",
    placement: "the Funnel events stream",
    docsUrl: "https://www.customer.io/docs/journeys/reporting-webhooks/",
  },
  {
    id: "stripe_events",
    name: "Stripe events",
    slug: "stripe",
    category: "Events",
    method: "webhook",
    blurb: "Capture checkout / subscription events as revenue actuals.",
    useCase: "ingest Stripe checkout.session.completed and invoice.paid events as revenue actuals",
    placement: "campaign revenue actuals + Funnel dashboard",
    docsUrl: "https://docs.stripe.com/webhooks",
  },
];

/* -------------------------------------------------------------------------- */
/* Prompt builder — method-aware, accurate to this stack                      */
/* -------------------------------------------------------------------------- */

const APP_HOST_HINT = "your project's stable URL (project--<id>.lovable.app)";

export function buildPromptFor(entry: IntegrationEntry): string {
  switch (entry.method) {
    case "connector": {
      const usesGateway = entry.gateway !== false;
      const callingRules = usesGateway
        ? [
            `3. All API calls MUST go through the gateway: \`https://connector-gateway.lovable.dev/${entry.connectorId}/...\` with headers \`Authorization: Bearer \${process.env.LOVABLE_API_KEY}\` and \`X-Connection-Api-Key: \${process.env.${entry.envVar}}\`. Hitting ${entry.name}'s API directly will always fail — do NOT use the official ${entry.name} SDK.`,
          ]
        : [
            `3. This connector does NOT use the gateway. \`process.env.${entry.envVar}\` is the real ${entry.name} API key. Call ${entry.name}'s API directly at \`${entry.directApiBase}\` with header \`${entry.directAuthHeader}\`. Do NOT route through \`connector-gateway.lovable.dev\` — that will 404.`,
          ];
      return [
        `Add a "${entry.name}" integration to my Marketing Command Center using Lovable's managed connector.`,
        ``,
        `Setup:`,
        `1. Use the Lovable "${entry.name}" connector (connector_id: \`${entry.connectorId}\`). ${usesGateway ? "The OAuth flow is handled by Lovable" : "Lovable stores the API key for me"} — do NOT ask me to paste a key.`,
        entry.scopes
          ? `2. Request these scopes up front so I'm not re-prompted later: ${entry.scopes}.`
          : `2. Request the scopes/permissions you need up front so I'm not re-prompted later.`,
        ...callingRules,
        ``,
        `Build:`,
        `1. A TanStack server function at \`src/lib/${entry.connectorId}.functions.ts\` that wraps the calls needed for: ${entry.useCase}. Validate inputs with Zod. Surface 401/403 as a friendly "Reconnect ${entry.name}" CTA.`,
        `2. A small "${entry.name}" status card on /integrations showing connected / not connected, with a Reconnect button that re-runs the connector picker.`,
        `3. Surface the feature where it naturally belongs: ${entry.placement ?? "wherever it fits in the current UI"}. Don't just leave the API behind a settings toggle.`,
        ``,
        `When the connector picker opens, click "Connect" and pick or create the ${entry.name} connection.`,
      ].join("\n");
    }

    case "api-key":
      return [
        `Add a "${entry.name}" integration to my Marketing Command Center using a direct API key (no OAuth).`,
        ``,
        `Setup:`,
        `1. Generate an API key at ${entry.dashboardUrl ?? "the provider's dashboard"}.`,
        `2. Ask me to store it via Lovable's \`add_secret\` flow as \`${entry.id.toUpperCase()}_API_KEY\`. Do NOT hardcode it, do NOT commit it, and do NOT prefix with \`VITE_\` — it must stay server-only.`,
        ``,
        `Build:`,
        `1. A TanStack server function at \`src/lib/${entry.id}.functions.ts\` that calls ${entry.name}'s REST API (base: \`${entry.apiBase ?? "see docs"}\`) using \`process.env.${entry.id.toUpperCase()}_API_KEY\` and the right auth header (\`${entry.authHeader ?? "see docs"}\`). Validate all inputs with Zod.`,
        `2. Handle 401 (bad key), 403 (insufficient scope), and 429 (rate limit) as typed errors and surface them in the UI — don't swallow them.`,
        `3. Add a "${entry.name}" settings card on /integrations with a "Test connection" button that calls ${entry.testEndpoint ?? "a cheap read-only endpoint"} and shows "Connected" / error inline.`,
        `4. Hook the result into: ${entry.useCase}. Surface it at ${entry.placement ?? "the relevant page"}.`,
        entry.docsUrl ? `\nProvider docs: ${entry.docsUrl}` : "",
      ].filter(Boolean).join("\n");

    case "oauth-app":
      return [
        `Add a "${entry.name}" integration where EACH end-user signs in with their own ${entry.provider} account.`,
        `This is per-user OAuth — NOT a Lovable connector (that would only connect MY account), and NOT an API key.`,
        ``,
        `Setup (walk me through it):`,
        `1. Create an OAuth app in the ${entry.provider} developer console.`,
        `   - Authorized redirect URI: \`https://${APP_HOST_HINT}/api/${entry.id}/callback\``,
        `   - Required scopes: ${entry.scopes ?? "see provider docs"}`,
        `2. Ask me to store the OAuth Client ID and Client Secret via \`add_secret\` as \`${entry.id.toUpperCase()}_OAUTH_CLIENT_ID\` and \`${entry.id.toUpperCase()}_OAUTH_CLIENT_SECRET\`.`,
        ``,
        `Build:`,
        `1. A \`${entry.id}_connections\` table (user_id uuid, access_token text, refresh_token text, expires_at timestamptz, scope text, account_label text). Enable RLS — users can only see/modify their own row.`,
        `2. Server routes:`,
        `   - \`GET /api/${entry.id}/connect\` — kicks off the OAuth flow with state + PKCE.`,
        `   - \`GET /api/${entry.id}/callback\` — exchanges the code, upserts tokens for \`auth.uid()\`, redirects back to /integrations.`,
        `   - A token-refresh helper used by every downstream call — refresh proactively when \`expires_at\` is within 60s.`,
        `3. Server functions for ${entry.useCase} that read the *current user's* tokens via \`requireSupabaseAuth\` middleware. Never share tokens across users.`,
        `4. On /integrations, replace the static "${entry.name}" card with a real "Connect my ${entry.name}" button when not connected, and "Connected as {account_label} — Disconnect" when connected.`,
        entry.docsUrl ? `\nProvider docs: ${entry.docsUrl}` : "",
      ].filter(Boolean).join("\n");

    case "webhook":
      return [
        `Add a "${entry.name}" inbound webhook to my Marketing Command Center.`,
        ``,
        `Setup:`,
        `1. In ${entry.name}, configure the webhook to POST to \`https://${APP_HOST_HINT}/api/public/webhooks/${entry.id}\`.`,
        `2. Ask me to store the signing secret via \`add_secret\` as \`${entry.id.toUpperCase()}_WEBHOOK_SECRET\`.`,
        ``,
        `Build:`,
        `1. A public TanStack server route at \`app/routes/api/public/webhooks/${entry.id}.ts\` with a POST handler that:`,
        `   - Reads the RAW request body (not pre-parsed JSON) — needed for signature verification.`,
        `   - Verifies the signature header with \`crypto.timingSafeEqual\` against \`process.env.${entry.id.toUpperCase()}_WEBHOOK_SECRET\`. Reject with 401 if mismatched. NEVER skip this.`,
        `   - Validates the parsed payload with Zod (min/max string lengths, enums where possible).`,
        `2. A migration adding \`webhook_events(id uuid pk, source text, event_type text, payload jsonb, received_at timestamptz default now())\`. Insert via the admin client.`,
        `3. Route the event into ${entry.useCase}. Surface at ${entry.placement ?? "the relevant page"}.`,
        `4. On /integrations, show the last 10 events for this source with received_at + event_type, so I can confirm wiring works.`,
        entry.docsUrl ? `\nProvider docs: ${entry.docsUrl}` : "",
      ].filter(Boolean).join("\n");
  }
}
