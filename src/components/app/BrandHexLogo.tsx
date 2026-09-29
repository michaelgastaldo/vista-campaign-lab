/**
 * BrandHexLogo — the gradient-border hex monogram from the auth screen,
 * extracted so the sidebar/header use the same mark as /login.
 */
import { BRAND } from "@/lib/brand";

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

interface BrandHexLogoProps {
  /** Height in px. Width is auto (sqrt(3)/2 * height). */
  size?: number;
  className?: string;
}

export function BrandHexLogo({ size = 42, className }: BrandHexLogoProps) {
  const h = size;
  const w = Math.round((Math.sqrt(3) / 2) * h * 10) / 10;
  const mono = Math.round(h * 0.42);
  return (
    <span
      className={`group relative grid place-items-center shrink-0${className ? ` ${className}` : ""}`}
      style={{ height: h, width: w }}
      aria-label={BRAND.name}
    >
      {/* Outer glow */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-70 blur-md transition-opacity duration-500 group-hover:opacity-100"
        style={{
          clipPath: HEX_CLIP,
          background:
            "conic-gradient(from 140deg, oklch(0.72 0.2 275), oklch(0.78 0.18 340), oklch(0.86 0.14 88), oklch(0.72 0.2 275))",
        }}
      />
      {/* Gradient border hex */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: HEX_CLIP,
          background:
            "linear-gradient(140deg, oklch(0.78 0.2 275), oklch(0.82 0.18 340) 50%, oklch(0.88 0.14 88))",
        }}
      />
      {/* Inner dark hex face */}
      <span
        aria-hidden
        className="absolute inset-[1.5px]"
        style={{
          clipPath: HEX_CLIP,
          background:
            "linear-gradient(155deg, oklch(0.18 0.02 270) 0%, oklch(0.1 0.015 270) 100%)",
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.12)",
        }}
      />
      {/* Specular sheen */}
      <span
        aria-hidden
        className="absolute inset-[1.5px] opacity-60"
        style={{
          clipPath: HEX_CLIP,
          background:
            "linear-gradient(160deg, oklch(1 0 0 / 0.18) 0%, transparent 45%)",
        }}
      />
      {/* Monogram M */}
      <svg
        viewBox="0 0 24 24"
        className="relative"
        style={{ height: mono, width: mono }}
        aria-hidden
      >
        <defs>
          <linearGradient id="brand-hex-m-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.92 0.05 275)" />
            <stop offset="100%" stopColor="oklch(0.88 0.12 340)" />
          </linearGradient>
        </defs>
        <path
          d="M4 19V6.5c0-.5.6-.8 1-.5L12 11l7-5c.4-.3 1 0 1 .5V19"
          fill="none"
          stroke="url(#brand-hex-m-grad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
