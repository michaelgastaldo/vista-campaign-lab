/**
 * FocusedToolPanel — focused tool surface that feels native to the Command
 * Center, not a sidebar.
 *
 * Desktop: a full-viewport dim layer drops behind the hexes (so the rest
 * of the page recedes), and the tool content floats on top with NO panel
 * background, NO column edge, NO chrome — just content directly on the
 * page's existing gradient mesh. Each tool can request its own width.
 *
 * Mobile (< md): full-bleed sheet from the bottom with a glass ink bg.
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FocusedTool } from "./focused-tools";


interface FocusedToolPanelProps {
  tool: FocusedTool | null;
  onClose: () => void;
}

export function FocusedToolPanel({ tool, onClose }: FocusedToolPanelProps) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!tool) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // Fragile: do not depend on `onClose`; search-param churn can replace the
    // callback and reattach this listener during navigation, adding paint work.
  }, [tool]);

  return (
    <AnimatePresence>
      {tool && (
        <>
          {/* Immersive backdrop — soft hue-tinted vignette behind the
              focused content. Stays decorative; doesn't trap clicks.
              Keyed by primaryId (not slug) so switching between satellites
              of the same tool doesn't trigger a full exit/enter cycle —
              that was reading as a page refresh. */}
          <motion.div
            key={`${tool.primaryId}-aura`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(90% 70% at 100% 20%,
                oklch(0.78 0.16 ${tool.hue} / 0.16) 0%,
                oklch(0.18 0.08 ${tool.hue} / 0.08) 40%,
                transparent 75%)`,
            }}
          />

          <motion.aside
            key="focused-tool-shell"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="focused-tool-aside relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col"
            style={{ ["--hex-hue" as string]: tool.hue }}
            aria-label={`${tool.title} panel`}
            role="region"
          >
            {/* Content flows in the page — no nested scroll container.
                The app's main scroll handles vertical overflow. */}
            <div
              className="focused-tool-scope relative z-10 mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col px-5 pb-16 pt-2 sm:px-7 md:px-9 lg:px-10 xl:px-12"
            >
              <style>{`
                .focused-tool-scope { pointer-events: auto; }
                .focused-tool-scope > :not(style) { flex: 1 1 auto; }
                .focused-tool-scope > :not(style),
                .focused-tool-scope > :not(style) > .focused-fill-canvas {
                  min-height: 100%;
                }
                @media (max-width: 1199px) {
                  .focused-tool-scope .grid.md\\:grid-cols-2,
                  .focused-tool-scope .grid.md\\:grid-cols-3 {
                    grid-template-columns: 1fr !important;
                  }
                }
                /* Tighten the inherited vertical rhythm so the form
                   doesn't read as a stretched-out column. */
                .focused-tool-scope .space-y-8 > * + * { margin-top: 1.25rem !important; }
                .focused-tool-scope .space-y-6 > * + * { margin-top: 1rem !important; }
                .focused-tool-scope .gap-6 { gap: 1rem !important; }
                .focused-tool-scope .gap-5 { gap: 0.875rem !important; }
                /* Collapse padding ONLY on actual GlassPanel divs — not
                   on form controls (selects/buttons) that also use the
                   glass class for their pill chrome. */
                .focused-tool-scope div.glass,
                .focused-tool-scope div.glass-strong {
                  background: transparent !important;
                  border-color: transparent !important;
                  box-shadow: none !important;
                  backdrop-filter: none !important;
                  -webkit-backdrop-filter: none !important;
                }
                /* Composed-URL block becomes a quiet inline summary, not a card. */
                .focused-tool-scope .tick-in {
                  font-size: 0.95rem !important;
                  line-height: 1.4 !important;
                }


                /* Liquid glass pill treatment for every form control inside
                   the focused tool. Inputs, selects, textareas and small
                   action buttons all become translucent rounded pills with
                   a subtle inner sheen so the panel reads as one cohesive
                   glassy surface. */
                /* ============================================================
                   LIQUID-GLASS HUD PILLS — high-end "video game UI" feel.
                   Heavy backdrop blur (so the hex grid behind blurs into
                   readability), hue-tinted sheen, chromatic rim highlight,
                   soft outer aura. Hover/focus lights up the active hue. */
                .focused-tool-scope :is(input, textarea, select),
                .focused-tool-scope [role="combobox"],
                .focused-tool-scope button[role="combobox"],
                .focused-tool-scope [data-slot="select-trigger"],
                .focused-tool-scope [data-slot="input"],
                .focused-tool-scope [data-slot="textarea"] {
                  background-color: transparent !important;
                  background-image:
                    linear-gradient(180deg,
                      oklch(1 0 0 / 0.12) 0%,
                      oklch(1 0 0 / 0.035) 44%,
                      oklch(0 0 0 / 0.14) 100%),
                    radial-gradient(130% 95% at 0% 0%,
                      oklch(0.78 0.16 var(--hex-hue, 275) / 0.13),
                      transparent 62%) !important;
                  background-clip: padding-box !important;
                  border: 1px solid oklch(1 0 0 / 0.09) !important;
                  border-radius: 9999px !important;
                  backdrop-filter: blur(64px) saturate(210%) contrast(1.08) !important;
                  -webkit-backdrop-filter: blur(64px) saturate(210%) contrast(1.08) !important;
                  isolation: isolate !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.16),
                    inset 0 -10px 26px -18px oklch(0 0 0 / 0.8),
                    0 10px 30px -16px oklch(0 0 0 / 0.5),
                    0 0 24px -10px oklch(0.78 0.16 var(--hex-hue, 275) / 0.18) !important;

                  color: oklch(0.98 0.01 240) !important;
                  font-family: var(--font-sans) !important;
                  font-feature-settings: "ss01", "cv11" !important;
                  letter-spacing: 0.005em !important;
                  padding: 0.7rem 1.15rem !important;
                  transition: border-color 0.25s ease, box-shadow 0.35s ease, background 0.3s ease, transform 0.2s ease !important;
                }
                .focused-tool-scope .focused-control-lens {
                  background-color: oklch(1 0 0 / 0.01) !important;
                  backdrop-filter: blur(72px) saturate(220%) contrast(1.1) !important;
                  -webkit-backdrop-filter: blur(72px) saturate(220%) contrast(1.1) !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.18),
                    inset 0 -18px 34px -24px oklch(0 0 0 / 0.85),
                    0 12px 30px -18px oklch(0 0 0 / 0.7) !important;
                }
                .focused-tool-scope .focused-control-lens::before {
                  content: "";
                  position: absolute;
                  inset: 0;
                  z-index: 0;
                  pointer-events: none;
                  border-radius: inherit;
                  background:
                    linear-gradient(180deg,
                      oklch(1 0 0 / 0.10),
                      oklch(1 0 0 / 0.025) 48%,
                      oklch(0 0 0 / 0.12)),
                    radial-gradient(120% 95% at 0% 0%,
                      oklch(0.78 0.16 var(--hex-hue, 275) / 0.12),
                      transparent 62%);
                }
                .focused-tool-scope .focused-control-lens > * {
                  position: relative;
                  z-index: 1;
                }
                .focused-tool-scope > *:has(.focused-control-lens),
                .focused-tool-scope > * > *:has(.focused-control-lens) {
                  animation: none !important;
                  opacity: 1 !important;
                  transform: none !important;
                }
                .focused-tool-scope textarea,
                .focused-tool-scope [data-slot="textarea"] {
                  border-radius: 22px !important;
                }
                .focused-tool-scope :is(input, textarea, select):hover,
                .focused-tool-scope [role="combobox"]:hover,
                .focused-tool-scope [data-slot="select-trigger"]:hover {
                  border-color: oklch(0.78 0.16 var(--hex-hue, 275) / 0.30) !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.10),
                    inset 0 -8px 24px -12px oklch(0 0 0 / 0.55),
                    0 10px 30px -16px oklch(0 0 0 / 0.7),
                    0 0 30px -8px oklch(0.78 0.16 var(--hex-hue, 275) / 0.35) !important;
                }
                .focused-tool-scope :is(input, textarea, select):focus,
                .focused-tool-scope :is(input, textarea, select):focus-visible,
                .focused-tool-scope [role="combobox"]:focus-visible,
                .focused-tool-scope [data-slot="select-trigger"]:focus-visible {
                  outline: none !important;
                  border-color: oklch(0.78 0.16 var(--hex-hue, 275) / 0.6) !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.12),
                    inset 0 -8px 24px -12px oklch(0 0 0 / 0.5),
                    0 0 0 3px oklch(0.78 0.16 var(--hex-hue, 275) / 0.20),
                    0 14px 36px -14px oklch(0.78 0.16 var(--hex-hue, 275) / 0.45),
                    0 0 40px -6px oklch(0.78 0.16 var(--hex-hue, 275) / 0.40) !important;
                }
                .focused-tool-scope :is(input, textarea)::placeholder {
                  color: oklch(0.78 0.02 240 / 0.5) !important;
                  letter-spacing: 0.01em !important;
                }
                /* Inline help/hint text (e.g. "For your reference only") — much quieter. */
                .focused-tool-scope .text-muted-foreground:not(label):not([data-slot="label"]),
                .focused-tool-scope [class*="text-muted-foreground"]:not(label):not([data-slot="label"]) {
                  opacity: 0.55 !important;
                }
                /* Form field labels — keep them legible and HUD-styled. */
                .focused-tool-scope label,
                .focused-tool-scope [data-slot="label"] {
                  color: oklch(0.96 0.01 240) !important;
                  opacity: 0.82 !important;
                  font-size: 0.68rem !important;
                  text-transform: uppercase !important;
                  letter-spacing: 0.12em !important;
                  font-weight: 500 !important;
                }
                /* "Manage" / chip buttons — HUD language, smaller scale. */
                .focused-tool-scope button.rounded-full:not([class*="bg-primary"]):not(.is-active) {
                  background-color: transparent !important;
                  background-image:
                    linear-gradient(180deg,
                      oklch(1 0 0 / 0.12),
                      oklch(1 0 0 / 0.035) 58%,
                      oklch(0 0 0 / 0.14)) !important;
                  border: 1px solid oklch(1 0 0 / 0.12) !important;
                  backdrop-filter: blur(46px) saturate(200%) contrast(1.06) !important;
                  -webkit-backdrop-filter: blur(46px) saturate(200%) contrast(1.06) !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.20),
                    inset 0 -4px 12px -8px oklch(0 0 0 / 0.4),
                    0 6px 18px -10px oklch(0 0 0 / 0.55) !important;
                  transition: box-shadow 0.25s ease, transform 0.15s ease, border-color 0.2s ease !important;
                }
                .focused-tool-scope button.rounded-full:not([class*="bg-primary"]):not(.is-active):hover {
                  border-color: oklch(0.78 0.16 var(--hex-hue, 275) / 0.45) !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.24),
                    0 8px 22px -10px oklch(0 0 0 / 0.55),
                    0 0 22px -6px oklch(0.78 0.16 var(--hex-hue, 275) / 0.4) !important;
                  transform: translateY(-1px) !important;
                }
                /* Primary action pills — restrained hue-glow HUD buttons.
                   Lower chroma than the hover state so they read as a
                   confident action, not a candy bar. */
                .focused-tool-scope button[class*="bg-primary"] {
                  background:
                    linear-gradient(180deg,
                      oklch(0.7 0.11 var(--hex-hue, 275)) 0%,
                      oklch(0.52 0.13 var(--hex-hue, 275)) 100%) !important;
                  border: 1px solid oklch(1 0 0 / 0.18) !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.32),
                    inset 0 -6px 14px -8px oklch(0 0 0 / 0.4),
                    0 6px 18px -10px oklch(0.52 0.13 var(--hex-hue, 275) / 0.5),
                    0 0 18px -8px oklch(0.7 0.13 var(--hex-hue, 275) / 0.35) !important;
                  color: oklch(0.15 0 0) !important;
                  text-shadow: 0 1px 0 oklch(1 0 0 / 0.25) !important;
                  transition: transform 0.15s ease, box-shadow 0.25s ease, filter 0.2s ease !important;
                }
                .focused-tool-scope button[class*="bg-primary"] * {
                  color: oklch(0.15 0 0) !important;
                }
                .focused-tool-scope button[class*="bg-primary"]:hover {
                  filter: brightness(1.1) saturate(1.15) !important;
                  transform: translateY(-1px) !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.4),
                    0 10px 24px -10px oklch(0.52 0.15 var(--hex-hue, 275) / 0.7),
                    0 0 30px -6px oklch(0.7 0.15 var(--hex-hue, 275) / 0.5) !important;
                }
                /* Segmented tab pills (Single/Bulk, Audience queries/UTM generations). */
                .focused-tool-scope [role="tablist"],
                .focused-tool-scope [data-slot="tabs-list"] {
                  background: linear-gradient(180deg,
                    oklch(1 0 0 / 0.05),
                    oklch(0 0 0 / 0.22)) !important;
                  border: 1px solid oklch(1 0 0 / 0.08) !important;
                  border-radius: 9999px !important;
                  backdrop-filter: blur(20px) saturate(170%) !important;
                  -webkit-backdrop-filter: blur(20px) saturate(170%) !important;
                  padding: 4px !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.08),
                    inset 0 -4px 10px -6px oklch(0 0 0 / 0.4) !important;
                }
                .focused-tool-scope [role="tab"][data-state="active"],
                .focused-tool-scope [data-slot="tabs-trigger"][data-state="active"] {
                  background: linear-gradient(180deg,
                    oklch(0.82 0.18 var(--hex-hue, 275)),
                    oklch(0.6 0.20 var(--hex-hue, 275))) !important;
                  color: oklch(1 0 0) !important;
                  border-radius: 9999px !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.5),
                    0 6px 18px -8px oklch(0.6 0.20 var(--hex-hue, 275) / 0.7),
                    0 0 20px -4px oklch(0.78 0.18 var(--hex-hue, 275) / 0.55) !important;
                }
                /* Criteria/value chips (small inline badges like
                   "geos: emea", "industries: saas"). Blurred translucent
                   pills so coloured text stays readable over the hex bg. */
                .focused-tool-scope [class*="rounded-full"]:is(span, div):not([role]):not([class*="bg-primary"]) {
                  backdrop-filter: blur(12px) saturate(160%) !important;
                  -webkit-backdrop-filter: blur(12px) saturate(160%) !important;
                  box-shadow:
                    inset 0 1px 0 oklch(1 0 0 / 0.10),
                    0 2px 8px -4px oklch(0 0 0 / 0.4) !important;
                }


                /* Stagger slide-in for the first panel mount only. Do not key
                   the shell by tool slug or replay this animation between
                   Agent/UTM subtools — that looked like a route remount/flash. */
                .focused-tool-aside > header,
                .focused-tool-scope > *,
                .focused-tool-scope > * > * {
                  opacity: 1;
                }
                @media (prefers-reduced-motion: reduce) {
                  .focused-tool-aside > header,
                  .focused-tool-scope > *,
                  .focused-tool-scope > * > * {
                    opacity: 1;
                  }
                }
              `}</style>
              <tool.Component hideHeader hideSummary={!!tool.Summary} />
            </div>
          </motion.aside>
        </>
      )}

    </AnimatePresence>
  );
}
