export type TourStep = {
  id: string;
  route?: string;
  /** CSS selector of the element to spotlight + ring */
  target?: string;
  /**
   * Optional broader region selector to keep visible (un-dimmed) while the
   * narrow `target` gets the focus ring. Use to keep nav/sidebar context.
   */
  context?: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Optional deep-link shown as "Open this →" inside the tooltip */
  openTo?: string;
  /** Preferred tooltip placement relative to target */
  placement?: "bottom" | "top" | "right" | "left" | "center";
  /** Force the sidebar's "Marketing tools" subtree open before resolving target */
  expandTools?: boolean;
};

const SIDEBAR = '[data-tour="sidebar"]';

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/dashboard",
    eyebrow: "2-minute tour",
    title: "Let's walk the whole app.",
    body: "I'll point at every menu item — top to bottom — and explain in one line what it does and when to open it. Use ← → to move, Esc to skip.",
    placement: "center",
  },

  // ── Primary nav ───────────────────────────────────────────────
  {
    id: "nav-dashboard",
    route: "/dashboard",
    target: '[data-tour="nav-/dashboard"]',
    context: SIDEBAR,
    openTo: "/dashboard",
    eyebrow: "This week",
    title: "Your Monday-morning screen.",
    body: "Live campaigns, pacing toward MQL/SQO targets, and the next action that needs you. Start every day here.",
    placement: "right",
  },
  {
    id: "nav-campaigns",
    route: "/dashboard",
    target: '[data-tour="nav-/campaigns"]',
    context: SIDEBAR,
    openTo: "/campaigns",
    eyebrow: "Campaigns",
    title: "Where every campaign lives.",
    body: "One row per workspace — brief, assets, checklist, results. Click \"New campaign\" to spin one up or generate one from a brief with AI.",
    placement: "right",
  },
  {
    id: "nav-tools",
    route: "/dashboard",
    target: '[data-tour="nav-/tools"]',
    context: SIDEBAR,
    openTo: "/tools",
    eyebrow: "Marketing tools",
    title: "Your toolbelt — 3 hubs.",
    body: "Campaign-in-a-box, Funnel, and UTM Builder. I'll open the menu so you can see each one.",
    placement: "right",
    expandTools: true,
  },

  // ── Tools submenu ─────────────────────────────────────────────
  {
    id: "tool-campaign",
    route: "/dashboard",
    target: '[data-tour="tool-campaign"]',
    context: SIDEBAR,
    openTo: "/tools?focus=campaign",
    eyebrow: "Tools › Campaign-in-a-box",
    title: "Launch a campaign end-to-end.",
    body: "Draft creative, import a list, and schedule events — all from one place. Use it when you're standing up a new push.",
    placement: "right",
    expandTools: true,
  },
  {
    id: "tool-funnel",
    route: "/dashboard",
    target: '[data-tour="tool-funnel"]',
    context: SIDEBAR,
    openTo: "/funnel",
    eyebrow: "Tools › Funnel",
    title: "Set targets, watch performance.",
    body: "MQL / SQO sets your monthly goals (org-wide or per workspace). Performance shows whether you're tracking against them. Open weekly.",
    placement: "right",
    expandTools: true,
  },
  {
    id: "tool-utm",
    route: "/dashboard",
    target: '[data-tour="tool-utm"]',
    context: SIDEBAR,
    openTo: "/tools/utm",
    eyebrow: "Tools › UTM Builder",
    title: "Consistent links, every time.",
    body: "Campaign Name generates canonical names, Naming conventions enforce your taxonomy, and All UTMs shows every link the team has built.",
    placement: "right",
    expandTools: true,
  },

  // ── Rest of primary nav ───────────────────────────────────────
  {
    id: "nav-calendar",
    route: "/dashboard",
    target: '[data-tour="nav-/calendar"]',
    context: SIDEBAR,
    openTo: "/calendar",
    eyebrow: "Calendar",
    title: "Every send, event, and launch.",
    body: "Month view of every campaign milestone, color-coded by type. Drag to reschedule. The single source of truth for \"what's going out when.\"",
    placement: "right",
  },
  {
    id: "nav-requests",
    route: "/dashboard",
    target: '[data-tour="nav-/requests"]',
    context: SIDEBAR,
    openTo: "/requests",
    eyebrow: "Requests",
    title: "Intake from the rest of the company.",
    body: "Sales, product, partners — anyone — can request a campaign via your public intake link. Triage, promote to workspace, or decline here.",
    placement: "right",
  },
  {
    id: "nav-templates",
    route: "/dashboard",
    target: '[data-tour="nav-/templates"]',
    context: SIDEBAR,
    openTo: "/templates",
    eyebrow: "Templates",
    title: "Reusable starting points.",
    body: "Brief templates, email layouts, checklist presets. Save anything that worked once so the next campaign starts at 50%.",
    placement: "right",
  },

  // ── Footer nav ────────────────────────────────────────────────
  {
    id: "nav-settings",
    route: "/dashboard",
    target: '[data-tour="nav-settings"]',
    context: SIDEBAR,
    openTo: "/settings",
    eyebrow: "Settings",
    title: "Org, team, taxonomy, brand.",
    body: "Invite teammates, set roles, edit the campaign-type vocabulary, and configure your brand. Visit once during setup, then rarely.",
    placement: "right",
  },
  {
    id: "nav-integrations",
    route: "/dashboard",
    target: '[data-tour="nav-integrations"]',
    context: SIDEBAR,
    openTo: "/integrations",
    eyebrow: "Integrations",
    title: "Connect your CRM, webhooks, and more.",
    body: "Without these, demo data fills in. Connect your CRM and inbox here to make every panel live. Do this on day one.",
    placement: "right",
  },

  // ── Top-right pill ────────────────────────────────────────────
  {
    id: "setup-pill",
    route: "/dashboard",
    target: '[data-tour="setup-pill"], [data-tour="onboarding-checklist"]',
    eyebrow: "Setup checklist",
    title: "Five 30-second wins.",
    body: "Follow the pill at the top-right to feel the app's value fast. You can replay this tour anytime from inside it.",
    placement: "bottom",
  },

  // ── Outro ─────────────────────────────────────────────────────
  {
    id: "done",
    route: "/dashboard",
    eyebrow: "You're set",
    title: "Go ship something.",
    body: "Press ⌘K anywhere to jump between tools. Replay this tour from the Setup pill if you need a refresher.",
    placement: "center",
  },
];

export const TOUR_PREF_KEY = "tour_v1";
