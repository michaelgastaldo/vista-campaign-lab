/**
 * Registry of tools that can open INLINE inside the Tools hub as a focused
 * side panel (driven by ?focus=<slug>) instead of routing to a full page.
 *
 * Each entry maps to a primary hex's `id` in HexToolsTree so the click on a
 * primary opens its panel and the same hex stays highlighted on the left.
 *
 * Satellite tools share their parent's primaryId so the hex tree keeps the
 * parent hex highlighted, and they expose a `parentTitle` so the page
 * header can show the parent name big with the satellite name as a
 * subtitle below it.
 */

import type { ComponentType, ReactNode } from "react";
import { UtmBuilderContent } from "@/routes/_app/tools/utm";

import { AllUtmsContent } from "@/routes/_app/tools/all-utms";
import { TaxonomyContent } from "@/routes/_app/tools/taxonomy";
import { FunnelPageContent } from "@/routes/_app/funnel";
import { FunnelTargetsContent } from "@/routes/_app/tools/funnel-targets";
import { CampaignInABoxContent } from "@/routes/_app/tools/campaign-in-a-box";
import { CampaignCreatorContent } from "@/routes/_app/tools/campaign-creator";
import { ListImportContent } from "@/routes/_app/tools/import";
import { CampaignPerformanceContent, CampaignPerformanceSummary } from "@/routes/_app/tools/campaign-performance";
import { EventsContent } from "@/routes/_app/tools/events";
import { HackathonRequestContent } from "@/routes/_app/tools/event-intake";
import { ListCleanerContent } from "@/routes/_app/tools/list-cleaner";
import {
  IconUtm,
  IconSpark,
  IconScroll,
  IconCampaign,
  IconFunnel,
  IconChart,
  IconImport,
  IconCalendar,
  IconTrophy,
} from "@/components/ui-custom/CustomIcon";


export type FocusedTool = {
  /** URL search-param slug. Also the canonical key. */
  slug: string;
  /** Must match a `Primary.id` in HexToolsTree so the parent hex stays bright. */
  primaryId: string;
  title: string;
  /** Same hue scale as the hex tree primary (oklch hue 0..360). */
  hue: number;
  icon: ReactNode;
  /** Full-route fallback for "open in full page" link. */
  fullRouteTo: string;
  /** Body component, rendered headerless inside the panel. */
  Component: ComponentType<{ hideHeader?: boolean; hideSummary?: boolean }>;
  /** Optional full-width "summary band" rendered above the hex+panel split. */
  Summary?: ComponentType;
  /** Optional desktop width override (any CSS width value). */
  width?: string;
  /** When set, header renders parent big and this tool's title as subtitle. */
  parentTitle?: string;
  /** Parent hue for the badge when this is a sub-tool. */
  parentHue?: number;
  /** Parent icon for the badge when this is a sub-tool. */
  parentIcon?: ReactNode;
};

export const FOCUSED_TOOLS: Record<string, FocusedTool> = {
  utm: {
    slug: "utm",
    primaryId: "utm",
    title: "UTM Builder",
    hue: 275,
    icon: <IconUtm size={22} />,
    fullRouteTo: "/tools/utm",
    Component: UtmBuilderContent,
  },
  // Satellites of the UTM Builder — open in the same right-side panel
  // and read as part of the UTM Builder family in the header.
  // Legacy alias — "New UTM" now opens the main UTM Builder.
  "utm-campaign-name": {
    slug: "utm-campaign-name",
    primaryId: "utm",
    title: "UTM Builder",
    hue: 275,
    icon: <IconUtm size={22} />,
    fullRouteTo: "/tools/utm",
    Component: UtmBuilderContent,
  },
  "utm-taxonomy": {
    slug: "utm-taxonomy",
    primaryId: "utm",
    title: "Naming conventions",
    hue: 275,
    icon: <IconSpark size={22} />,
    fullRouteTo: "/tools/taxonomy",
    Component: TaxonomyContent,
    parentTitle: "UTM Builder",
    parentHue: 275,
    parentIcon: <IconUtm size={22} />,
  },
  "utm-all": {
    slug: "utm-all",
    primaryId: "utm",
    title: "All UTMs",
    hue: 275,
    icon: <IconScroll size={22} />,
    fullRouteTo: "/tools/all-utms",
    Component: AllUtmsContent,
    parentTitle: "UTM Builder",
    parentHue: 275,
    parentIcon: <IconUtm size={22} />,
  },
  funnel: {
    slug: "funnel",
    primaryId: "funnel",
    title: "Funnel",
    hue: 200,
    icon: <IconFunnel size={22} />,
    fullRouteTo: "/tools/funnel-targets",
    Component: FunnelPageContent,
  },
  campaign: {
    slug: "campaign",
    primaryId: "campaign",
    title: "Campaign-in-a-box",
    hue: 150,
    icon: <IconCampaign size={22} />,
    fullRouteTo: "/tools/campaign-in-a-box",
    Component: CampaignInABoxContent,
  },
  "funnel-performance": {
    slug: "funnel-performance",
    primaryId: "funnel",
    title: "Performance",
    hue: 200,
    icon: <IconChart size={22} />,
    fullRouteTo: "/tools/campaign-performance",
    Component: CampaignPerformanceContent,
    Summary: CampaignPerformanceSummary,
    parentTitle: "Funnel",
    parentHue: 200,
    parentIcon: <IconFunnel size={22} />,
  },
  "funnel-targets": {
    slug: "funnel-targets",
    primaryId: "funnel",
    title: "MQL / SQO targets",
    hue: 200,
    icon: <IconSpark size={22} />,
    fullRouteTo: "/tools/funnel-targets",
    Component: FunnelTargetsContent,
    parentTitle: "Funnel",
    parentHue: 200,
    parentIcon: <IconFunnel size={22} />,
  },
  "campaign-creator": {
    slug: "campaign-creator",
    primaryId: "campaign",
    title: "Campaign Name Generator",
    hue: 150,
    icon: <IconCampaign size={22} />,
    fullRouteTo: "/tools/campaign-creator",
    Component: CampaignCreatorContent,
    parentTitle: "Campaign-in-a-box",
    parentHue: 150,
    parentIcon: <IconCampaign size={22} />,
  },
  "campaign-import": {
    slug: "campaign-import",
    primaryId: "campaign",
    title: "List Import",
    hue: 150,
    icon: <IconImport size={22} />,
    fullRouteTo: "/tools/import",
    Component: ListImportContent,
    parentTitle: "Campaign-in-a-box",
    parentHue: 150,
    parentIcon: <IconCampaign size={22} />,
  },
  "campaign-events": {
    slug: "campaign-events",
    primaryId: "campaign",
    title: "Events",
    hue: 150,
    icon: <IconCalendar size={22} />,
    fullRouteTo: "/tools/events",
    Component: EventsContent,
    parentTitle: "Campaign-in-a-box",
    parentHue: 150,
    parentIcon: <IconCampaign size={22} />,
  },
  "campaign-performance": {
    slug: "campaign-performance",
    primaryId: "campaign",
    title: "Performance",
    hue: 150,
    icon: <IconChart size={22} />,
    fullRouteTo: "/tools/campaign-performance",
    Component: CampaignPerformanceContent,
    Summary: CampaignPerformanceSummary,
    parentTitle: "Campaign-in-a-box",
    parentHue: 150,
    parentIcon: <IconCampaign size={22} />,
  },
  "campaign-hackathon": {
    slug: "campaign-hackathon",
    primaryId: "campaign",
    title: "Event request",
    hue: 150,
    icon: <IconTrophy size={22} />,
    fullRouteTo: "/tools/event-intake",
    Component: HackathonRequestContent,
    parentTitle: "Campaign-in-a-box",
    parentHue: 150,
    parentIcon: <IconCampaign size={22} />,
  },
  "campaign-list-cleaner": {
    slug: "campaign-list-cleaner",
    primaryId: "campaign",
    title: "List cleaner",
    hue: 150,
    icon: <IconSpark size={22} />,
    fullRouteTo: "/tools/list-cleaner",
    Component: ListCleanerContent,
    parentTitle: "Campaign-in-a-box",
    parentHue: 150,
    parentIcon: <IconCampaign size={22} />,
  },
};

export function getFocusedTool(slug: string | undefined | null): FocusedTool | null {
  if (!slug) return null;
  return FOCUSED_TOOLS[slug] ?? null;
}

/** Map of satellite hex id (from HexToolsTree) → focused-tool slug. */
export const SATELLITE_TO_FOCUS_SLUG: Record<string, string> = {
  name: "utm",
  "utm-all": "utm-all",
  tax: "utm-taxonomy",
  perf2: "funnel-performance",
  targets: "funnel-targets",
  events: "campaign-events",
  creator: "campaign-creator",
  import: "campaign-import",
};


/** Set of primary hex ids that should open in panel instead of navigating. */
export const FOCUSED_PRIMARY_IDS = new Set(
  Object.values(FOCUSED_TOOLS).map((t) => t.primaryId),
);
