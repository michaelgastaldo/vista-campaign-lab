import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Cog } from "lucide-react";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  IconArrowRight,
  IconBolt,
  IconClose,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { useHiddenHexes, restoreAllHexes } from "@/lib/hex-overrides";
import { HexToolsTree } from "@/components/tools/HexToolsTree";
import { HexToolsList } from "@/components/tools/HexToolsList";
import { FocusedToolPanel } from "@/components/tools/FocusedToolPanel";
import { AddCustomHexDialog } from "@/components/tools/AddCustomHexDialog";
import { AuroraField } from "@/components/motion/AuroraField";
import { FadeInUp } from "@/components/motion/WordStagger";
import { BRAND } from "@/lib/brand";


import {
  FOCUSED_PRIMARY_IDS,
  FOCUSED_TOOLS,
  SATELLITE_TO_FOCUS_SLUG,
  getFocusedTool,
} from "@/components/tools/focused-tools";

const searchSchema = z.object({
  focus: z.string().optional(),
  workspace: z.string().optional(),
});

export const Route = createFileRoute("/_app/tools/")({
  component: ToolsHub,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Marketing tools — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Campaign-in-a-box, UTM Builder, Lead Referral, Funnel Dashboard, Agent Email Responder.",
      },
    ],
  }),
});

function ToolsHub() {
  const { focus, workspace } = Route.useSearch();
  const navigate = useNavigate();
  const tool = getFocusedTool(focus);
  const focusedPrimaryId = tool?.primaryId ?? null;
  // Reverse the satellite→slug map to find which satellite is active.
  const focusedSatelliteId =
    Object.entries(SATELLITE_TO_FOCUS_SLUG).find(([, slug]) => slug === focus)?.[0] ?? null;

  const handleFocus = useCallback(
    (primaryId: string) => {
      const entry = Object.values(FOCUSED_TOOLS).find(
        (t) => t.primaryId === primaryId && !t.parentTitle,
      );
      if (!entry) return;
      navigate({ to: "/tools", search: { focus: entry.slug, workspace }, replace: false });
    },
    [navigate, workspace],
  );

  const handleSatelliteFocus = useCallback(
    (_primaryId: string, satelliteId: string) => {
      const slug = SATELLITE_TO_FOCUS_SLUG[satelliteId];
      if (!slug) return false;
      navigate({ to: "/tools", search: { focus: slug, workspace }, replace: false });
      return true;
    },
    [navigate, workspace],
  );

  const handleClose = useCallback(() => {
    navigate({ to: "/tools", search: { workspace }, replace: false });
  }, [navigate, workspace]);

  const [addHexPrimary, setAddHexPrimary] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const hidden = useHiddenHexes();
  const hiddenCount = hidden.size;

  const badgeHue = tool?.parentHue ?? tool?.hue ?? 88;
  const badgeIcon = tool?.parentIcon ?? tool?.icon;
  const mainTitle = tool?.parentTitle ?? tool?.title;
  const subTitle = tool?.parentTitle ? tool.title : null;

  return (
    <div className={`relative flex min-h-[calc(100vh-3rem)] flex-col overflow-x-hidden pb-10 ${tool ? "space-y-3" : "space-y-8"}`}>
      {!tool && (
        <AuroraField
          hue={275}
          hue2={340}
          intensity={0.9}
          className="!top-[-40px] h-[60vh] [mask-image:linear-gradient(180deg,#000_0%,#000_55%,transparent_100%)]"
        />
      )}

      <header className="relative z-10 px-4 sm:px-6">
        {tool && (
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Tools</div>
        )}

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          {!tool && (
            <div className="flex items-start gap-4">
              <PageHexBadge hue={88} size={26} icon={<IconBolt size={22} />} aria-label="Marketing tools" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {BRAND.name} · Tools
                </div>
                <h1 className="mt-1 font-display text-4xl tracking-tight">
                  Campaign toolkit.
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  One orbit for every move you make — campaign names, UTM links, imports,
                  and events.
                </p>
              </div>
            </div>
          )}


          {!tool && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                aria-pressed={editMode}
                aria-label={editMode ? "Done editing hexes" : "Edit hexes"}
                title={editMode ? "Done" : "Edit hexes"}
                className={
                  editMode
                    ? "inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/25"
                    : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-glass-border bg-glass/40 text-muted-foreground transition hover:bg-glass-strong hover:text-foreground"
                }
              >
                {editMode ? (
                  <>
                    <IconClose size={12} />
                    Done
                  </>
                ) : (
                  <Cog size={16} strokeWidth={1.8} />
                )}
              </button>
              {editMode && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={restoreAllHexes}
                  className="rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-glass-strong hover:text-foreground"
                  title="Restore all hidden hexes"
                >
                  Restore {hiddenCount} hidden
                </button>
              )}
            </div>
          )}
        </div>

        {!tool && (
          <FadeInUp delay={0.7}>
            <p className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground">
              One orbit for every move you make — campaign names, UTM links, imports,
              and events. Every artifact lands on a{" "}
              <Link to="/campaigns" className="text-foreground underline decoration-primary/40 decoration-2 underline-offset-4 transition hover:decoration-primary">
                campaign
              </Link>
              , wired straight to your CRM.
            </p>
          </FadeInUp>
        )}
        {!tool && <hr className="spectrum-divider mt-8" />}

        {tool && (
          <FadeInUp delay={0.05} className="mt-2">
            <div className="relative flex flex-wrap items-center gap-3 sm:gap-4 pt-3">
              <div className="absolute inset-x-0 top-0 spectrum-divider" />
              <PageHexBadge hue={badgeHue} icon={badgeIcon} size={26} aria-label={mainTitle} />

              <div className="min-w-0 flex-1">
                <div className="text-eyebrow !text-[10px] opacity-70">
                  {subTitle ? (tool.parentTitle ?? "Sub-tool") : "Tool"}
                </div>
                <h2 className="font-display text-lg sm:text-xl md:text-2xl leading-tight truncate">
                  {subTitle ? subTitle : mainTitle}
                </h2>
              </div>

              <div className="flex items-center gap-2 pt-1 shrink-0">
                {tool.parentTitle && (() => {
                  const parent = Object.values(FOCUSED_TOOLS).find(
                    (t) => t.primaryId === tool.primaryId && !t.parentTitle,
                  );
                  if (!parent) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/tools", search: { focus: parent.slug, workspace }, replace: false })}
                      title={`Back to ${tool.parentTitle}`}
                      aria-label={`Back to ${tool.parentTitle}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-glass-strong hover:text-foreground"
                    >
                      <IconArrowRight size={12} className="rotate-180" />
                      <span className="hidden sm:inline">Back to {tool.parentTitle}</span>
                      <span className="sm:hidden">Back</span>
                    </button>
                  );
                })()}
                <Link
                  to={tool.fullRouteTo}
                  title="Open as full page"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-glass-strong hover:text-foreground"
                >
                  Open full <IconArrowRight size={12} />
                </Link>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close panel (Esc)"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-glass-border bg-glass/40 text-muted-foreground transition hover:bg-glass-strong hover:text-foreground"
                >
                  <IconClose size={14} />
                </button>
              </div>

            </div>
          </FadeInUp>
        )}
        {tool && (
          <button
            type="button"
            onClick={handleClose}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 transition hover:text-foreground"
          >
            <span aria-hidden="true">←</span> Marketing Tools
          </button>
        )}
      </header>

      <div className={tool ? "relative flex min-h-[calc(100vh-13rem)] flex-1 flex-col" : "relative"}>
        {!tool && (
          <>
            <div className="relative hidden md:block" data-tour="tools-stage">
              <HexToolsTree
                focusedId={focusedPrimaryId}
                focusedSatelliteId={focusedSatelliteId}
                onFocus={handleFocus}
                focusablePrimaryIds={FOCUSED_PRIMARY_IDS}
                onSatelliteFocus={handleSatelliteFocus}
                onBackgroundClick={handleClose}
                onAddCustomHex={(primaryId) => setAddHexPrimary(primaryId)}
                editMode={editMode}
              />
            </div>
            <div className="md:hidden px-4">
              <HexToolsList
                focusedId={focusedPrimaryId}
                focusedSatelliteId={focusedSatelliteId}
                onFocus={handleFocus}
                focusablePrimaryIds={FOCUSED_PRIMARY_IDS}
                onSatelliteFocus={handleSatelliteFocus}
                onAddCustomHex={(primaryId) => setAddHexPrimary(primaryId)}
              />
            </div>
          </>
        )}

        {/* Summary band — stays inside the content column, above the panel. */}
        {tool?.Summary && (
          <section className="relative z-20 px-4 sm:px-6">
            <tool.Summary />
          </section>
        )}

        {tool ? (
          <div className="relative z-30 flex min-h-0 min-w-0 flex-1">
            <div className="flex min-h-0 min-w-0 w-full flex-1">
              <FocusedToolPanel tool={tool} onClose={handleClose} />
            </div>
          </div>
        ) : (
          <FocusedToolPanel tool={tool} onClose={handleClose} />
        )}
      </div>




      {!tool && (
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-glass-border/60 px-4 sm:px-6 pt-3 text-[11px] text-muted-foreground/80">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Link to="/tools" search={{ focus: "campaign-hackathon" }} className="hover:text-foreground">Event request</Link>
            <span className="opacity-30">·</span>
            <Link to="/tools" search={{ focus: "campaign-list-cleaner" }} className="hover:text-foreground">List cleaner</Link>
            <span className="opacity-30">·</span>
            <Link to="/tools" search={{ focus: "utm-taxonomy" }} className="hover:text-foreground">Naming conventions</Link>
            <span className="opacity-30">·</span>
            <Link to="/tools" search={{ focus: "funnel-targets" }} className="hover:text-foreground">MQL / SQO targets</Link>
          </div>
          <Link to="/connectors" className="hover:text-foreground">Manage connectors →</Link>
        </footer>
      )}

      <AddCustomHexDialog
        open={addHexPrimary !== null}
        primaryId={addHexPrimary}
        onClose={() => setAddHexPrimary(null)}
      />
    </div>
  );
}
