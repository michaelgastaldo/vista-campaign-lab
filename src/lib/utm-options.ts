/**
 * Curated UTM vocabularies — used to power autocomplete in the UTM tool
 * when an org hasn't customized utm_settings yet.
 */

export const UTM_SOURCE_PRESETS = [
  "google",
  "bing",
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
  "reddit",
  "newsletter",
  "partner",
  "podcast",
  "webinar",
  "direct",
  "email",
];

export const UTM_MEDIUM_PRESETS = [
  "cpc",
  "cpm",
  "social",
  "social-paid",
  "social-organic",
  "email",
  "newsletter",
  "banner",
  "referral",
  "organic",
  "affiliate",
  "video",
  "qr",
  "print",
];

export const UTM_CAMPAIGN_PREFIXES_BY_INDUSTRY: Record<string, string[]> = {
  saas: ["product-launch", "feature-launch", "free-trial", "demo-request", "webinar", "case-study"],
  ecommerce: ["holiday-sale", "back-in-stock", "abandoned-cart", "vip-launch", "clearance"],
  agency: ["new-client-pitch", "thought-leadership", "rebrand", "case-study", "event-sponsorship"],
  nonprofit: ["annual-appeal", "giving-tuesday", "matching-gift", "volunteer-drive", "newsletter"],
  default: ["product-launch", "webinar", "newsletter", "spring-launch", "retargeting"],
};

export function suggestCampaign(industry: string | null | undefined): string[] {
  const key = (industry ?? "default").toLowerCase();
  return UTM_CAMPAIGN_PREFIXES_BY_INDUSTRY[key] ?? UTM_CAMPAIGN_PREFIXES_BY_INDUSTRY.default;
}
