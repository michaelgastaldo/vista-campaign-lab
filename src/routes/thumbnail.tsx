/**
 * /thumbnail — a static 1600x900 composition of the app's signature visuals,
 * built for capturing the template listing thumbnail. Not linked from nav.
 *
 * Stage scales to fit smaller viewports for previewing; at exactly 1600x900
 * (the capture viewport) it renders 1:1.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { AuroraField } from "@/components/motion/AuroraField";
import { BrandHexLogo } from "@/components/app/BrandHexLogo";
import { BRAND } from "@/lib/brand";
import {
  IconUtm,
  IconFunnel,
  IconCampaign,
  IconScroll,
  IconChart,
} from "@/components/ui-custom/CustomIcon";

export const Route = createFileRoute("/thumbnail")({
  component: ThumbnailPage,
  head: () => ({
    meta: [
      { title: `Thumbnail stage — ${BRAND.name}` },
      { name: "description", content: "Static 1600x900 composition of the template's signature visuals for the listing thumbnail." },
      { property: "og:title", content: `Thumbnail stage — ${BRAND.name}` },
      { property: "og:description", content: "Composition page used to capture the template thumbnail." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

// ─── Stage constants ───────────────────────────────────────────────────────
const STAGE_W = 1600;
const STAGE_H = 900;
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

// ─── Hex cluster geometry (pointy-top axial, matches HexToolsTree) ────────
const S = 56; // circumradius
const HW = Math.sqrt(3) * S; // ≈ 97
const HH = 2 * S; // 112
const STEP_Y = 1.5 * S;

function axial(cx: number, cy: number, q: number, r: number) {
  return { x: cx + (q + r / 2) * HW, y: cy + r * STEP_Y };
}

// ─── Funnel geometry — smooth mirrored bezier silhouette ──────────────────
const FUNNEL_STAGES = [
  { label: "Leads", value: "4,820", hex: "#a78bfa" },
  { label: "MQLs", value: "1,940", hex: "#818cf8" },
  { label: "SQLs", value: "861", hex: "#60a5fa" },
  { label: "SQOs", value: "512", hex: "#2dd4bf" },
  { label: "Won", value: "208", hex: "#34d399" },
];
const F_VB_W = 400;
const F_CX = F_VB_W / 2;
const F_TOP = 4;
const F_BAND = 88;
const F_R = 16; // bottom corner radius
// half-widths at the 6 stage boundaries
const HWS = [186, 150, 118, 90, 68, 50];
const F_BOTTOM = F_TOP + FUNNEL_STAGES.length * F_BAND;
const F_VB_H = F_BOTTOM + 8;

function funnelPath(): string {
  const n = FUNNEL_STAGES.length;
  let d = `M ${F_CX - HWS[0]} ${F_TOP} L ${F_CX + HWS[0]} ${F_TOP}`;
  // right side, down
  for (let i = 0; i < n; i++) {
    const yTop = F_TOP + i * F_BAND;
    const yBot = yTop + F_BAND;
    const x0 = F_CX + HWS[i];
    const x1 = F_CX + HWS[i + 1];
    const yEnd = i === n - 1 ? yBot - F_R : yBot;
    d += ` C ${x0} ${yTop + F_BAND * 0.45}, ${x1} ${yTop + F_BAND * 0.6}, ${x1} ${yEnd}`;
  }
  // rounded bottom
  const xr = F_CX + HWS[n];
  const xl = F_CX - HWS[n];
  d += ` Q ${xr} ${F_BOTTOM}, ${xr - F_R} ${F_BOTTOM}`;
  d += ` L ${xl + F_R} ${F_BOTTOM}`;
  d += ` Q ${xl} ${F_BOTTOM}, ${xl} ${F_BOTTOM - F_R}`;
  // left side, up
  for (let i = n - 1; i >= 0; i--) {
    const yTop = F_TOP + i * F_BAND;
    const x0 = F_CX - HWS[i];
    const x1 = F_CX - HWS[i + 1];
    const yStart = i === n - 1 ? F_BOTTOM - F_R : yTop + F_BAND;
    void yStart;
    d += ` C ${x1} ${yTop + F_BAND * 0.6}, ${x0} ${yTop + F_BAND * 0.45}, ${x0} ${yTop}`;
  }
  d += " Z";
  return d;
}

const F_PATH = funnelPath();

function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H, 1));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

// ─── Static hex ────────────────────────────────────────────────────────────
interface HexProps {
  x: number;
  y: number;
  hue?: number;
  ghost?: boolean;
  ghostOpacity?: number;
  children?: ReactNode;
}

function Hex({ x, y, hue = 275, ghost, ghostOpacity = 0.5, children }: HexProps) {
  return (
    <div
      className={`tn-hex${ghost ? " tn-hex-ghost" : ""}`}
      style={{
        left: x,
        top: y,
        width: HW,
        height: HH,
        ["--hue" as string]: hue,
        opacity: ghost ? ghostOpacity : 1,
      }}
    >
      {!ghost && <span className="tn-hex-sheen" aria-hidden />}
      {children && (
        <span className="relative z-[2] flex h-full w-full flex-col items-center justify-center gap-1 text-center">
          {children}
        </span>
      )}
    </div>
  );
}

function PrimaryHexContent({ tier, name, hue, icon }: { tier: string; name: string; hue: number; icon: ReactNode }) {
  return (
    <>
      <span style={{ color: `oklch(0.9 0.12 ${hue})` }}>{icon}</span>
      <span
        className="mt-1 h-px w-10"
        style={{ background: `linear-gradient(90deg, transparent, oklch(0.8 0.14 ${hue} / 0.8), transparent)` }}
      />
      <span
        className="text-[9px] uppercase tracking-[0.2em]"
        style={{ color: `oklch(0.82 0.13 ${hue})` }}
      >
        {tier}
      </span>
      <span className="px-3 font-display text-[13px] leading-tight">{name}</span>
    </>
  );
}

function SatHexContent({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <>
      <span className="text-foreground/80">{icon}</span>
      <span className="px-3 text-[10px] leading-tight text-foreground/70">{label}</span>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
function ThumbnailPage() {
  const scale = useFitScale();

  // Hex cluster anchor
  const CX = 815;
  const CY = 360;
  const p = (q: number, r: number) => axial(CX, CY, q, r);

  const ghosts: Array<{ q: number; r: number; o: number }> = [
    { q: 0, r: 0, o: 0.7 },
    { q: -3, r: 0, o: 0.3 },
    { q: 3, r: 0, o: 0.3 },
    { q: -2, r: 1, o: 0.5 },
    { q: -1, r: 1, o: 0.65 },
    { q: 1, r: 1, o: 0.65 },
    { q: 2, r: 1, o: 0.45 },
    { q: -1, r: -1, o: 0.5 },
    { q: 0, r: -1, o: 0.55 },
    { q: 1, r: -1, o: 0.5 },
    { q: 2, r: -1, o: 0.3 },
    { q: -2, r: 2, o: 0.4 },
    { q: 0, r: 2, o: 0.45 },
    { q: 1, r: 2, o: 0.3 },
  ];

  const conversions = [
    { i: 1, text: "40% from Leads", amber: true },
    { i: 2, text: "44% from MQLs", amber: false },
    { i: 3, text: "59% from SQLs", amber: false },
  ];

  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-[color:var(--color-ink)]">
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        <GradientMesh />
        <AuroraField hue={275} hue2={340} intensity={0.85} />

        {/* ── Left column: brand lockup ── */}
        <div className="absolute left-[88px] top-1/2 z-10 w-[440px] -translate-y-1/2">
          <BrandHexLogo size={88} />
          <p className="mt-7 text-[12px] uppercase tracking-[0.32em] text-muted-foreground">
            {BRAND.tagline}
          </p>
          <h1 className="mt-3 font-display text-[46px] font-semibold leading-[1.08] tracking-tight">
            {BRAND.name}
          </h1>
          <p className="mt-4 max-w-[400px] text-[15px] leading-relaxed text-muted-foreground">
            Launch checklists, standardized campaign names, UTM tracking links,
            and performance dashboards in one shared workspace.
          </p>

          {/* UTM pill */}
          <div className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-glass-border bg-glass-strong px-4 py-2.5">
            <IconUtm size={14} />
            <span className="font-mono text-[11.5px] text-foreground/80">
              utm_source=linkedin&utm_campaign=q3-launch
            </span>
          </div>

          {/* Stage pills */}
          <div className="mt-4 flex items-center gap-2">
            {[
              { label: "Planning", hue: 275 },
              { label: "Live", hue: 340 },
              { label: "Complete", hue: 165 },
            ].map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px]"
                style={{
                  borderColor: `oklch(0.78 0.18 ${s.hue} / 0.35)`,
                  background: `oklch(0.7 0.16 ${s.hue} / 0.12)`,
                  color: `oklch(0.88 0.12 ${s.hue})`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: `oklch(0.78 0.22 ${s.hue})` }}
                />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Middle: hex tool cluster ── */}
        <div className="absolute inset-0 z-[5]" aria-hidden>
          {ghosts.map((g) => {
            const pos = p(g.q, g.r);
            return <Hex key={`${g.q},${g.r}`} x={pos.x} y={pos.y} ghost ghostOpacity={g.o} />;
          })}
          <Hex {...p(-1, 0)} hue={275}>
            <PrimaryHexContent tier="Tracking" name="UTM Builder" hue={275} icon={<IconUtm size={28} />} />
          </Hex>
          <Hex {...p(1, 0)} hue={200}>
            <PrimaryHexContent tier="Analytics" name="Funnel" hue={200} icon={<IconFunnel size={28} />} />
          </Hex>
          <Hex {...p(0, 1)} hue={150}>
            <PrimaryHexContent tier="Workflow" name="Campaign-in-a-box" hue={150} icon={<IconCampaign size={28} />} />
          </Hex>
          <Hex {...p(-2, 0)} hue={275}>
            <SatHexContent label="All UTMs" icon={<IconScroll size={18} />} />
          </Hex>
          <Hex {...p(2, 0)} hue={200}>
            <SatHexContent label="Performance" icon={<IconChart size={18} />} />
          </Hex>
          {/* under-glow */}
          <div
            className="absolute -z-10"
            style={{
              left: CX - 260,
              top: CY - 160,
              width: 520,
              height: 400,
              background:
                "radial-gradient(ellipse 60% 55% at 50% 50%, oklch(0.75 0.18 290 / 0.2) 0%, oklch(0.65 0.15 260 / 0.09) 45%, transparent 78%)",
              filter: "blur(46px)",
            }}
          />
        </div>

        {/* ── Floating tiles under the cluster ── */}
        <div className="absolute left-[583px] top-[668px] z-10 flex items-stretch gap-4">
          <div className="w-[248px] rounded-2xl border border-glass-border bg-glass-strong p-4 backdrop-blur-md" style={{ boxShadow: "var(--shadow-glass)" }}>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              MQLs this month
            </div>
            <div className="mt-1 flex items-end justify-between">
              <div className="font-display text-[30px] font-semibold leading-none">1,940</div>
              <span className="mb-0.5 inline-flex items-center rounded-full border border-[oklch(0.72_0.17_165_/_0.4)] bg-[oklch(0.7_0.15_165_/_0.14)] px-2 py-0.5 text-[11px] text-[oklch(0.85_0.14_165)]">
                +12%
              </span>
            </div>
            <svg viewBox="0 0 200 36" className="mt-2 h-8 w-full" aria-hidden>
              <defs>
                <linearGradient id="tn-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.2 275)" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="oklch(0.72 0.2 275)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 30 L25 26 L50 28 L75 20 L100 22 L125 14 L150 16 L175 8 L200 5 L200 36 L0 36 Z"
                fill="url(#tn-spark)"
              />
              <path
                d="M0 30 L25 26 L50 28 L75 20 L100 22 L125 14 L150 16 L175 8 L200 5"
                fill="none"
                stroke="oklch(0.78 0.18 275)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="w-[216px] rounded-2xl border border-glass-border bg-glass-strong p-4 backdrop-blur-md" style={{ boxShadow: "var(--shadow-glass)" }}>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Launch checklist
            </div>
            <div className="mt-1 font-display text-[30px] font-semibold leading-none">
              9<span className="font-sans text-[15px] font-normal text-muted-foreground"> of 12</span>
            </div>
            <div className="mt-3.5 h-1.5 w-full rounded-full bg-[oklch(1_0_0_/_0.08)]">
              <div
                className="h-full w-3/4 rounded-full"
                style={{ background: "linear-gradient(90deg, oklch(0.72 0.2 275), oklch(0.78 0.18 340))" }}
              />
            </div>
            <div className="mt-2.5 text-[11px] text-muted-foreground">Next: schedule launch email</div>
          </div>
        </div>

        {/* ── Right: funnel panel ── */}
        <div
          className="absolute right-[64px] top-[136px] z-10 h-[628px] w-[464px] rounded-3xl border border-glass-border bg-glass p-7 backdrop-blur-xl"
          style={{ boxShadow: "var(--shadow-glass)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <IconFunnel size={18} />
              <span className="font-display text-[18px]">Funnel</span>
            </div>
            <span className="rounded-full border border-glass-border bg-glass-strong px-3 py-1 text-[11px] text-muted-foreground">
              This quarter
            </span>
          </div>

          <div className="relative mt-5">
            <svg viewBox={`0 0 ${F_VB_W} ${F_VB_H}`} className="w-[300px]" aria-hidden>
              <defs>
                <clipPath id="tn-funnel-clip">
                  <path d={F_PATH} />
                </clipPath>
                {FUNNEL_STAGES.map((s) => (
                  <linearGradient key={s.label} id={`tn-fg-${s.label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.hex} stopOpacity="0.30" />
                    <stop offset="45%" stopColor={s.hex} stopOpacity="0.85" />
                    <stop offset="100%" stopColor={s.hex} stopOpacity="0.72" />
                  </linearGradient>
                ))}
                <linearGradient id="tn-fsheen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0.2" />
                  <stop offset="18%" stopColor="oklch(1 0 0)" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="oklch(1 0 0)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g clipPath="url(#tn-funnel-clip)">
                {FUNNEL_STAGES.map((s, i) => (
                  <rect
                    key={s.label}
                    x="0"
                    y={F_TOP + i * F_BAND}
                    width={F_VB_W}
                    height={F_BAND}
                    fill={`url(#tn-fg-${s.label})`}
                  />
                ))}
                {FUNNEL_STAGES.slice(1).map((s, i) => (
                  <line
                    key={s.label}
                    x1="0"
                    x2={F_VB_W}
                    y1={F_TOP + (i + 1) * F_BAND}
                    y2={F_TOP + (i + 1) * F_BAND}
                    stroke="oklch(1 0 0 / 0.14)"
                    strokeWidth="1"
                  />
                ))}
                <rect x="0" y={F_TOP} width={F_VB_W} height="70" fill="url(#tn-fsheen)" />
              </g>
              <path d={F_PATH} fill="none" stroke="oklch(1 0 0 / 0.14)" strokeWidth="1.5" />
              {FUNNEL_STAGES.map((s, i) => {
                const yTop = F_TOP + i * F_BAND;
                return (
                  <g key={s.label} style={{ fontFamily: "var(--font-display)" }}>
                    <text
                      x={F_CX}
                      y={yTop + 38}
                      textAnchor="middle"
                      fill="oklch(0.16 0.03 270 / 0.85)"
                      style={{ fontSize: 11, letterSpacing: "0.18em", fontWeight: 700, textTransform: "uppercase" }}
                    >
                      {s.label.toUpperCase()}
                    </text>
                    <text
                      x={F_CX}
                      y={yTop + 62}
                      textAnchor="middle"
                      fill="oklch(0.12 0.03 270)"
                      style={{ fontSize: 21, fontWeight: 700 }}
                    >
                      {s.value}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* conversion pills — float right of the narrowing silhouette */}
            {conversions.map((c) => {
              const svgScale = 300 / F_VB_W;
              const y = (F_TOP + c.i * F_BAND) * svgScale;
              const x = (F_CX + HWS[c.i]) * svgScale + 16;
              return (
                <div
                  key={c.i}
                  className="absolute -translate-y-1/2 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] backdrop-blur-md"
                  style={{
                    left: x,
                    top: y,
                    borderColor: c.amber ? "oklch(0.86 0.14 88 / 0.5)" : "var(--glass-border)",
                    background: c.amber ? "oklch(0.86 0.14 88 / 0.12)" : "var(--glass-strong)",
                    color: c.amber ? "oklch(0.9 0.13 88)" : "oklch(0.9 0.01 260)",
                    boxShadow: c.amber ? "0 0 22px -4px oklch(0.86 0.14 88 / 0.45)" : undefined,
                  }}
                >
                  {c.text}
                </div>
              );
            })}
          </div>

          {/* Q3 pacing — anchored to panel bottom */}
          <div className="absolute inset-x-7 bottom-7">
            <div className="h-px w-full bg-[oklch(1_0_0_/_0.08)]" />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Q3 target pacing
              </span>
              <span className="text-[12px] text-foreground/85">82%</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-[oklch(1_0_0_/_0.08)]">
              <div
                className="h-full w-[82%] rounded-full"
                style={{ background: "linear-gradient(90deg, oklch(0.72 0.2 275), oklch(0.78 0.18 340))" }}
              />
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">1,940 of 2,350 MQLs this quarter</div>
          </div>
        </div>

        <style>{`
          .tn-hex {
            position: absolute;
            transform: translate(-50%, -50%);
            color: oklch(0.97 0.005 240);
          }
          .tn-hex::before {
            content: '';
            position: absolute;
            inset: 3px;
            clip-path: ${HEX_CLIP};
            background: oklch(0.78 0.16 var(--hue, 88) / 0.6);
          }
          .tn-hex::after {
            content: '';
            position: absolute;
            inset: 4.5px;
            clip-path: ${HEX_CLIP};
            background: linear-gradient(160deg,
              oklch(0.34 0.13 var(--hue, 290) / 0.97) 0%,
              oklch(0.20 0.09 var(--hue, 320) / 0.97) 55%,
              oklch(0.10 0.03 270 / 1) 100%);
            box-shadow:
              inset 0 0 36px oklch(0.72 0.2 var(--hue, 275) / 0.22),
              inset 0 2px 0 oklch(1 0 0 / 0.1),
              inset 0 -2px 0 oklch(0 0 0 / 0.45),
              0 18px 44px -12px oklch(0.06 0.02 270 / 0.95);
          }
          .tn-hex-sheen {
            position: absolute;
            inset: 4.5px;
            clip-path: ${HEX_CLIP};
            background: radial-gradient(ellipse 70% 32% at 50% 10%,
              oklch(1 0 0 / 0.16),
              transparent 70%);
            pointer-events: none;
            z-index: 1;
          }
          .tn-hex-ghost::before {
            background: oklch(1 0 0 / 0.07);
          }
          .tn-hex-ghost::after {
            background: oklch(0.1 0.014 250 / 0.72);
            box-shadow: none;
          }
        `}</style>
      </div>
    </div>
  );
}
