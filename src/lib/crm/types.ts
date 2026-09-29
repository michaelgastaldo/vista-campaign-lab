/**
 * Generic CRM adapter contract. Every CRM-touching feature uses these
 * types — never an SDK or vendor-specific shape directly. This keeps the
 * door open for Salesforce/Pipedrive without rewriting features.
 */

export type CrmProvider = "hubspot" | "salesforce" | "none";

export type CrmConnectionStatus = {
  provider: CrmProvider;
  connected: boolean;
  /** Human label for UI ("HubSpot · Acme Workspace"). */
  account_label: string | null;
  /** Reason when not connected — surfaced as a CTA. */
  reason?: string;
};

export type CrmContact = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  /** Stored as a free-text role bucket. */
  seniority: string | null;
  /** Industry tag from the CRM. */
  industry: string | null;
  num_employees: number | null;
};


export type CrmCampaignBundle = {
  campaign_id: string;
  event_id: string | null;
  generated_name: string;
};

export type CrmCampaignSummary = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  sessions: number;
  new_contacts_first_touch: number;
  new_contacts_last_touch: number;
  influenced_contacts: number;
  influenced_deals: number;
  influenced_revenue_cents: number;
  attendees: number;
  no_shows: number;
};

export type CrmLinkedAsset = {
  id: string;
  type:
    | "MARKETING_EMAIL"
    | "MARKETING_EVENT"
    | "AD_CAMPAIGN"
    | "SOCIAL_POST"
    | "CTA"
    | "FORM"
    | "LANDING_PAGE"
    | "BLOG_POST"
    | "WORKFLOW"
    | "SEQUENCE"
    | "LIST";
  name: string;
  deep_link: string;
};
