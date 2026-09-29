import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  IconCampaign,
  IconImport,
  IconChevronLeft,
  IconArrowRight,
  IconSpark,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/tools/campaign-in-a-box")({
  component: () => <CampaignInABoxContent />,
  head: () => ({
    meta: [
      { title: `Campaign-in-a-box — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Create campaigns, import lists, and track performance in one ordered flow.",
      },
    ],
  }),
});

const MODULES = [
  {
    n: 1,
    to: "/tools",
    search: { focus: "campaign-creator" } as Record<string, string>,
    label: "Campaign Creator",
    desc: "Create and manage campaigns directly in your CRM with automated setup and tracking.",
    Icon: IconCampaign,
    soon: false,
  },
  {
    n: 2,
    to: "/tools",
    search: { focus: "campaign-import" } as Record<string, string>,
    label: "List Import",
    desc: "Upload post-event or campaign lists. Auto-parse, enrich, and import contacts with source attribution.",
    Icon: IconImport,
    soon: false,
  },
  {
    n: 3,
    to: "/tools",
    search: { focus: "campaign-performance" } as Record<string, string>,
    label: "Campaign Performance",
    desc: "Track and analyze campaign performance metrics across all channels.",
    Icon: IconCampaign,
    soon: false,
  },
] as const;

export function CampaignInABoxContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  return (
    <div className="space-y-8">
      {!hideHeader && (
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconChevronLeft size={14} /> Back to tools
        </Link>
      )}

      {!hideHeader && (
        <header className="flex items-start gap-4">
          <PageHexBadge hue={150} icon={<IconCampaign size={26} />} aria-label="Campaign-in-a-box" />
          <div>
            <h1 className="font-display text-3xl md:text-4xl">Campaign-in-a-box</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              End-to-end campaign workflow — from creation through list import and performance
              tracking.
            </p>
          </div>
        </header>
      )}

      <div className="space-y-3">
        {MODULES.map((m) => {
          const inner = (
            <GlassPanel
              className={`flex items-center gap-5 p-5 transition-all ${
                m.soon ? "opacity-60" : "hover:-translate-y-0.5 hover:border-primary/40"
              }`}
            >
              <div className="w-6 shrink-0 text-right text-xs font-bold text-muted-foreground/60">
                {m.n}
              </div>
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-glass-strong text-primary">
                <m.Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-display text-lg">
                  {m.label}
                  {m.soon && (
                    <span className="rounded border border-glass-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      In progress
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{m.desc}</div>
              </div>
              {!m.soon && (
                <IconArrowRight
                  size={18}
                  className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              )}
            </GlassPanel>
          );
          return m.soon ? (
            <div key={m.to} className="group block cursor-default">
              {inner}
            </div>
          ) : (
            <Link key={m.label} to={m.to} search={m.search} className="group block">
              {inner}
            </Link>
          );
        })}
      </div>

      <div className="flex justify-center pt-2">
        <Link
          to="/tools"
          search={{ focus: "campaign-list-cleaner" }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <IconSpark size={12} /> List cleaner
        </Link>
      </div>
    </div>
  );
}
