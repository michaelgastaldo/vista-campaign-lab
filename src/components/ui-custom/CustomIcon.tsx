/**
 * Custom geometric icon system.
 * Strictly NO Lucide imports inside marketing surfaces. Hand-drawn SVGs
 * with thin strokes (1.5px), no rounded gimmicks, designed to feel like
 * instrument-panel glyphs.
 */
import { type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function IconCampaign({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 7v10l9 4V3z" />
      <path d="M12 8l8-3v14l-8-3" />
      <circle cx="6.5" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconAudience({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" opacity="0.5" />
      <circle cx="12" cy="12" r="11" opacity="0.25" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconImport({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
    </svg>
  );
}

export function IconUtm({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 15a4 4 0 0 0 5.66 0l3.34-3.34a4 4 0 1 0-5.66-5.66L11 7.34" />
      <path d="M15 9a4 4 0 0 0-5.66 0L6 12.34a4 4 0 1 0 5.66 5.66L13 16.66" />
    </svg>
  );
}

export function IconBolt({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

export function IconArrowRight({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconCheck({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

export function IconClose({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 6l12 12" />
      <path d="M6 18L18 6" />
    </svg>
  );
}

export function IconCopy({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </svg>
  );
}

export function IconLogo({ size = 32, ...p }: IconProps) {
  const uid = `mp-${size}`;
  // Pointy-top hexagon path, centered at (cx, cy) with circumradius r
  const hex = (cx: number, cy: number, r: number) => {
    const h = (r * Math.sqrt(3)) / 2;
    return `M${cx} ${cy - r} L${cx + h} ${cy - r / 2} L${cx + h} ${cy + r / 2} L${cx} ${cy + r} L${cx - h} ${cy + r / 2} L${cx - h} ${cy - r / 2} Z`;
  };
  // Uniform pointy-top hexagons in a tight 3/2/1 honeycomb pack.
  const r = 11;
  const h = (r * Math.sqrt(3)) / 2;            // half-width
  const cx = 32;                                // canvas center x
  const y1 = 11 + r;                            // top row center (top margin ~3.5)
  const y2 = y1 + r * 1.5;                      // middle row center
  const y3 = y2 + r * 1.5;                      // bottom row center
  // Colors lifted from the Marketing Command Center hexes
  const cells = [
    { d: hex(cx - 2 * h, y1, r), a: "oklch(0.48 0.20 268)", b: "oklch(0.30 0.16 268)" },
    { d: hex(cx,         y1, r), a: "oklch(0.58 0.13 195)", b: "oklch(0.34 0.10 200)" },
    { d: hex(cx + 2 * h, y1, r), a: "oklch(0.62 0.18 38)",  b: "oklch(0.38 0.14 38)"  },
    { d: hex(cx - h,     y2, r), a: "oklch(0.50 0.20 350)", b: "oklch(0.30 0.14 350)" },
    { d: hex(cx + h,     y2, r), a: "oklch(0.55 0.16 150)", b: "oklch(0.32 0.12 150)" },
    { d: hex(cx,         y3, r), a: "oklch(0.58 0.20 300)", b: "oklch(0.34 0.16 300)" },
  ];
  const glowId = `${uid}-glow`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" {...p}>
      <defs>
        {cells.map((_, i) => (
          <linearGradient key={i} id={`${uid}-g${i}`} x1="32" y1="2" x2="32" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={cells[i].a} />
            <stop offset="100%" stopColor={cells[i].b} />
          </linearGradient>
        ))}
        <radialGradient id={glowId} cx="50%" cy="18%" r="60%">
          <stop offset="0%" stopColor="oklch(1 0 0 / 0.25)" />
          <stop offset="100%" stopColor="oklch(1 0 0 / 0)" />
        </radialGradient>
      </defs>
      {cells.map((c, i) => (
        <g key={i}>
          <path d={c.d} fill={`url(#${uid}-g${i})`} />
          <path d={c.d} fill={`url(#${glowId})`} />
        </g>
      ))}
    </svg>
  );
}

export function IconSpark({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      <path d="M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" opacity="0.5" />
    </svg>
  );
}

export function IconSettings({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </svg>
  );
}

export function IconLogout({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M16 16l4-4-4-4" />
      <path d="M20 12H10" />
    </svg>
  );
}

export function IconHome({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 12l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function IconWorkspace({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="4" rx="1.5" />
      <rect x="13" y="10" width="8" height="10" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
    </svg>
  );
}

export function IconCommand({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 6V4.5A2.5 2.5 0 1 0 6.5 7H9m0 0v10m0-10h6m-6 10v1.5A2.5 2.5 0 1 1 6.5 17H9m6-10v10m0-10h1.5A2.5 2.5 0 1 0 14 4.5V7m0 10h2.5A2.5 2.5 0 1 1 14 19.5V17" />
    </svg>
  );
}

export function IconPlus({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconClock({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconSearch({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function IconCalendar({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <circle cx="8" cy="15" r="0.6" fill="currentColor" />
      <circle cx="12" cy="15" r="0.6" fill="currentColor" />
      <circle cx="16" cy="15" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconTemplate({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 9v12" />
    </svg>
  );
}

export function IconChevronDown({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconEdit({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </svg>
  );
}

export function IconTrash({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function IconChevronLeft({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function IconChevronRight({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconTrophy({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3" />
    </svg>
  );
}

export function IconBot({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 4v4" />
      <circle cx="9" cy="14" r="0.8" fill="currentColor" />
      <circle cx="15" cy="14" r="0.8" fill="currentColor" />
      <path d="M9 17h6" />
    </svg>
  );
}

export function IconScroll({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 4h11a3 3 0 0 1 3 3v1h-3" />
      <path d="M17 4a3 3 0 0 1 3 3" />
      <path d="M4 8h13v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8z" />
      <path d="M8 12h6M8 16h4" />
    </svg>
  );
}

export function IconReferral({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M17 8h4M19 6v4" />
    </svg>
  );
}

export function IconWarning({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 3 2 21h20L12 3z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </svg>
  );
}

export function IconChart({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 3v18h18" />
      <path d="M7 15l3-4 4 3 5-7" />
    </svg>
  );
}

export function IconFunnel({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 4h18l-7 9v6l-4 2v-8L3 4z" />
    </svg>
  );
}

export function IconList({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </svg>
  );
}

export function IconBusinessCard({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="1.5" />
      <circle cx="8" cy="11" r="2" />
      <path d="M6 16c.4-1.2 1.6-2 2-2h0c.4 0 1.6.8 2 2" />
      <path d="M13 10h6M13 13h5M13 16h4" />
    </svg>
  );
}
