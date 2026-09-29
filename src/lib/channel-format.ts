/**
 * Display formatters for stored slug-style values like "paid-social" or
 * "email_nurture". These are display-only — never mutate the underlying
 * stored value with these helpers.
 */

export function formatLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

type CategoryStyle = {
  /** Tailwind classes for a subtle pill: bg + text + border. */
  className: string;
  /** Short category label, used for tooltips/aria. */
  category: string;
};

const RULES: Array<{ test: RegExp; style: CategoryStyle }> = [
  { test: /paid|ads?|ppc|sem|display|programmatic|retarget/i, style: { className: "bg-amber-500/15 text-amber-500 border-amber-500/30", category: "Paid" } },
  { test: /email|newsletter|nurture|drip|crm/i, style: { className: "bg-sky-500/15 text-sky-400 border-sky-500/30", category: "Email" } },
  { test: /event|webinar|conference|booth|field/i, style: { className: "bg-purple-500/15 text-purple-400 border-purple-500/30", category: "Events" } },
  { test: /organic|seo|content|blog|social|community|influencer|pr|earned/i, style: { className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", category: "Organic" } },
  { test: /partner|referral|affiliate/i, style: { className: "bg-pink-500/15 text-pink-400 border-pink-500/30", category: "Partner" } },
  { test: /product|in-app|inapp|push|sms|lifecycle/i, style: { className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", category: "Lifecycle" } },
];

export function channelCategoryStyle(value: string | null | undefined): CategoryStyle {
  if (!value) return { className: "bg-muted/40 text-muted-foreground border-glass-border", category: "Other" };
  for (const r of RULES) if (r.test.test(value)) return r.style;
  return { className: "bg-muted/40 text-muted-foreground border-glass-border", category: "Other" };
}
