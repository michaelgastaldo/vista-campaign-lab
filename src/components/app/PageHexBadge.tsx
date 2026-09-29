/**
 * PageHexBadge — single branded hex badge used to the left of page titles.
 *
 * Mirrors the silhouette + border + glow treatment of the primary hexes in
 * HexToolsTree (the Marketing Command Center honeycomb) so every page header
 * across the app reads as part of the same visual system. Hue is per-page so
 * the badge color matches the tool family's hex in the launcher
 * (UTM=275, Funnel=200, Lead Referral=340, Campaign-in-a-box=150,
 * Agent Responder=55, default gold=88).
 */

import { type ReactNode } from "react";

interface PageHexBadgeProps {
  icon: ReactNode;
  /** OKLCH hue 0..360. Defaults to gold (88). */
  hue?: number;
  /** px circumradius (badge height = 2*size). Defaults to 28. */
  size?: number;
  className?: string;
  "aria-label"?: string;
}

export function PageHexBadge({
  icon,
  hue = 88,
  size = 28,
  className,
  "aria-label": ariaLabel,
}: PageHexBadgeProps) {
  const w = Math.sqrt(3) * size;
  const h = 2 * size;
  return (
    <span
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={`mp-phb${className ? ` ${className}` : ""}`}
      style={{
        width: w,
        height: h,
        ["--hex-hue" as string]: hue,
      }}
    >
      <style>{CSS_TEXT}</style>
      <span className="mp-phb-sheen" aria-hidden />
      <span className="mp-phb-inner">{icon}</span>
    </span>
  );
}

const HEX_CLIP =
  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const FACE_INSET = "1.5px";

const CSS_TEXT = `
.mp-phb {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: oklch(0.97 0.005 240);
  transition: filter 0.3s ease;
}
.mp-phb::before {
  content: '';
  position: absolute;
  inset: 0;
  clip-path: ${HEX_CLIP};
  background: oklch(0.78 0.16 var(--hex-hue, 88) / 0.6);
  transition: background 0.35s ease;
}
.mp-phb::after {
  content: '';
  position: absolute;
  inset: ${FACE_INSET};
  clip-path: ${HEX_CLIP};
  background: linear-gradient(160deg,
    oklch(0.34 0.13 var(--hex-hue, 290) / 0.97) 0%,
    oklch(0.20 0.09 var(--hex-hue, 320) / 0.97) 55%,
    oklch(0.10 0.03 270 / 1) 100%);
  box-shadow:
    inset 0 0 14px oklch(0.72 0.2 var(--hex-hue, 275) / 0.28),
    inset 0 1px 0 oklch(1 0 0 / 0.12),
    inset 0 -1px 0 oklch(0 0 0 / 0.45),
    0 8px 22px -8px oklch(0.06 0.02 270 / 0.95),
    0 0 18px -4px oklch(0.82 0.18 var(--hex-hue, 88) / 0.35);
  transition: box-shadow 0.35s ease, background 0.35s ease;
}
.mp-phb-sheen {
  position: absolute;
  inset: ${FACE_INSET};
  clip-path: ${HEX_CLIP};
  background: radial-gradient(ellipse 70% 32% at 50% 10%,
    oklch(1 0 0 / 0.22),
    transparent 70%);
  pointer-events: none;
  z-index: 1;
}
.mp-phb-inner {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: oklch(0.97 0.04 var(--hex-hue, 88));
  filter: drop-shadow(0 0 6px oklch(0.82 0.18 var(--hex-hue, 88) / 0.4));
}
.mp-phb:hover::after {
  box-shadow:
    inset 0 0 18px oklch(0.82 0.18 var(--hex-hue, 88) / 0.45),
    inset 0 1px 0 oklch(1 0 0 / 0.18),
    inset 0 -1px 0 oklch(0 0 0 / 0.5),
    0 10px 26px -8px oklch(0.06 0.02 270 / 0.95),
    0 0 28px -4px oklch(0.82 0.18 var(--hex-hue, 88) / 0.55);
}
`;
