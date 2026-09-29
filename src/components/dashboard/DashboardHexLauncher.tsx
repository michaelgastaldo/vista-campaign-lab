import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { HexToolsTree } from "@/components/tools/HexToolsTree";
import { HexToolsList } from "@/components/tools/HexToolsList";
import {
  FOCUSED_PRIMARY_IDS,
  FOCUSED_TOOLS,
  SATELLITE_TO_FOCUS_SLUG,
} from "@/components/tools/focused-tools";


// ─── Geometry — must match HexToolsTree exactly ───────────────────────────
// Pointy-top hex tessellation. Real tree uses these same constants, so
// every value below is duplicated verbatim so the SVG tile and column
// offsets line up with the live hexes.
const SQRT3 = Math.sqrt(3);
const S = 86;                     // circumradius
const W = SQRT3 * S;              // hex width  ≈ 148.96
const H = 2 * S;                  // hex height = 172
const STAGE_W = 1120;             // virtual stage width (matches HexToolsTree)
const STAGE_H = 720;              // virtual stage height
const CX = STAGE_W / 2;
const SHIFT_X = -0.25 * W;        // horizontal centering used by HexToolsTree

// Column-modulus offset of the real tree's hex columns inside the virtual
// stage. (CX + SHIFT_X) mod W ≈ 75.88. Using this as background-position-x
// aligns BOTH the col-offset-0 and col-offset-0.5 rows simultaneously
// because the tile's two rows are themselves offset by W/2.
const COL_X = ((CX + SHIFT_X) % W + W) % W;

// Tile: pointy-top hex tile covering two staggered rows.
//   tile width  = W
//   tile height = 3 * S   (one main row + one staggered row)
//   main row hex center      → (W/2, S)        col-offset 0.5
//   staggered row hex centers → (0, 2.5S) & (W, 2.5S)  col-offset 0
const TILE_W = W;
const TILE_H = 3 * S;

function poly(ox: number, oy: number, inset = 4) {
  const w = W - inset * 2;
  const h = H - inset * 2;
  const pts = [
    [ox + inset + w / 2, oy + inset],
    [ox + inset + w, oy + inset + h * 0.25],
    [ox + inset + w, oy + inset + h * 0.75],
    [ox + inset + w / 2, oy + inset + h],
    [ox + inset, oy + inset + h * 0.75],
    [ox + inset, oy + inset + h * 0.25],
  ];
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

const TILE_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_W}' height='${TILE_H}' viewBox='0 0 ${TILE_W} ${TILE_H}'>
  <g fill='none' stroke='currentColor' stroke-width='1.25' stroke-linejoin='round'>
    <polygon points='${poly(0, 0)}' />
    <polygon points='${poly(W / 2, 1.5 * S)}' />
    <polygon points='${poly(-W / 2, 1.5 * S)}' />
  </g>
</svg>
`.trim();

const TILE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(TILE_SVG)}")`;

// Virtual band heights (in stage-space px). Chosen to fit ~3 ghost rows
// above and below before fading out.
const VH_TOP = 380;
// Extended downward so the hex lattice bleeds well past the launcher and
// flows behind the Needs-you / Pacing panels — no visible seam.
const VH_BOTTOM = 900;

// bg-position-y solved so a hex row lands on the next real-tree row above
// (r=-2 at real-stage y=-23) and below (r=4 at real-stage y=751). These
// repeat every 1.5*S=129px, so the entire ghost lattice snaps to the real
// grid. Derivation in comments below — DO NOT change without redoing the
// math, or the ghost rows will drift out of alignment.
//
//   Top band: bottom edge meets real-stage top. Inside band coords
//   (y=0 top, y=VH bottom), a real-stage row at y_real maps to
//   band_y = VH + y_real. We want a col-offset-0 row (r=-2, y_real=-23)
//   to land at band_y = VH-23. Tile's col-offset-0 row sits at tile-y=215.
//   bg-position-y = (VH - 23 - 215) mod TILE_H = (VH - 238) mod 258.
const BG_Y_TOP = (((VH_TOP - 238) % TILE_H) + TILE_H) % TILE_H;
//
//   Bottom band: top edge meets real-stage bottom. band_y = y_real - STAGE_H.
//   r=4 at y_real = 235 + 4*129 = 751 → band_y = 31. Same col-offset-0 row.
//   bg-position-y = (31 - 215) mod TILE_H = -184 mod 258 = 74.
const BG_Y_BOTTOM = (((31 - 215) % TILE_H) + TILE_H) % TILE_H;

export function DashboardHexLauncher() {
  const navigate = useNavigate();


  const handleFocus = useCallback(
    (primaryId: string) => {
      const entry = Object.values(FOCUSED_TOOLS).find(
        (t) => t.primaryId === primaryId && !t.parentTitle,
      );
      if (!entry) return;
      navigate({ to: "/tools", search: { focus: entry.slug } });
    },
    [navigate],
  );

  const handleSatelliteFocus = useCallback(
    (_primaryId: string, satelliteId: string) => {
      const slug = SATELLITE_TO_FOCUS_SLUG[satelliteId];
      if (!slug) return false;
      navigate({ to: "/tools", search: { focus: slug } });
      return true;
    },
    [navigate],
  );

  const fillStyle: React.CSSProperties = {
    backgroundImage: TILE_URL,
    backgroundSize: `${TILE_W}px ${TILE_H}px`,
    backgroundRepeat: "repeat",
    backgroundPositionX: `${COL_X}px`,
  };

  return (
    <section aria-label="Jump into a tool" className="relative">
      <div className="relative z-10 flex items-end justify-between px-1">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Jump in
          </div>
          <h2 className="mt-1 font-display text-2xl">Marketing tools</h2>
        </div>
        <Link
          to="/tools"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Full command center →
        </Link>
      </div>

      {/* One-shot entrance shimmer — rendered OUTSIDE .dhl-stage because
          container-type creates a containing block that would trap
          position:fixed. Sibling of the stage = truly viewport-fixed. */}
      <div aria-hidden className="dhl-shimmer" />

      {/* Stage wrapper — owns the inline-size container context so the
          HexToolsTree scales with width. */}
      <div className="dhl-stage relative mt-2 left-1/2 right-1/2 -translate-x-1/2 w-screen max-w-none hidden md:block">
        <div className="relative z-10 dhl-tree">
          <HexToolsTree
            onFocus={handleFocus}
            focusablePrimaryIds={FOCUSED_PRIMARY_IDS}
            onSatelliteFocus={handleSatelliteFocus}
            fadeGhostEdges
          />
        </div>
      </div>

      {/* Narrow-viewport fallback — vertical list of primaries with
          satellites flowing to the right. Avoids hex clipping at edges. */}
      <div className="md:hidden mt-3">
        <HexToolsList
          onFocus={handleFocus}
          focusablePrimaryIds={FOCUSED_PRIMARY_IDS}
          onSatelliteFocus={handleSatelliteFocus}
        />
      </div>


      <style>{`
        .dhl-stage {
          container-type: inline-size;
          isolation: isolate;
        }

        /* Ghost fade now lives per shadow hex inside HexToolsTree, so live
           menu hexes and labels are never masked or dimmed. */


        /* Warm under-glow behind the live colored hexes — sits in the
           middle of the stage where the mask is fully opaque. */
        .dhl-tree::before {
          content: "";
          position: absolute;
          inset: 22% 14%;
          z-index: -1;
          pointer-events: none;
          background: radial-gradient(
            ellipse 60% 55% at 50% 55%,
            oklch(0.75 0.18 290 / 0.22) 0%,
            oklch(0.65 0.15 260 / 0.10) 45%,
            transparent 78%
          );
          filter: blur(50px);
        }

        /* Entrance shimmer — one clean sweep on mount, then settles into
           a very faint static sheen. Never loops. */
        .dhl-shimmer {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 5;
          background: linear-gradient(
            115deg,
            transparent 0%,
            oklch(0.95 0.01 270 / 0.025) 48%,
            oklch(0.98 0.005 270 / 0.035) 52%,
            transparent 60%
          );
          mix-blend-mode: screen;
          opacity: 1;
        }
        .dhl-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            115deg,
            transparent 0%,
            transparent 38%,
            oklch(0.95 0.01 270 / 0.09) 49%,
            oklch(0.98 0.005 270 / 0.12) 52%,
            oklch(0.92 0.02 290 / 0.09) 55%,
            transparent 66%,
            transparent 100%
          );
          background-size: 220% 100%;
          background-position: -120% 0;
          mix-blend-mode: screen;
          opacity: 0;
          animation: dhl-shimmer-sweep 2200ms cubic-bezier(0.22, 0.61, 0.36, 1) 300ms 1 forwards;
        }
        @keyframes dhl-shimmer-sweep {
          0%   { opacity: 0;    background-position: -120% 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { opacity: 0;    background-position: 220% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dhl-shimmer::after { animation: none; display: none; }
        }
      `}</style>
    </section>
  );
}
