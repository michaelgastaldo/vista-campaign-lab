/**
 * HexToolsTree — premium honeycomb skill-tree launcher for the Tools hub.
 *
 * All hexes (primary + satellite) share the same size and the same solid
 * border treatment so the grid reads as one intentional system. Layout is
 * driven by true axial coordinates (pointy-top) so satellites snap into
 * neighbor cells with zero overlap. No connector lines — the honeycomb
 * adjacency does the talking.
 */

import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState, type PointerEvent, type ReactNode } from "react";
import {
  IconCampaign,
  IconUtm,
  IconImport,
  IconScroll,
  IconSpark,
  IconFunnel,
  IconChart,
  IconPlus,
  IconCalendar,
  IconClose,
} from "@/components/ui-custom/CustomIcon";
import {
  hideHex,
  reorderSatellite,
  satKey,
  useHiddenHexes,
  useSatelliteOrders,
} from "@/lib/hex-overrides";

// ─── Hex geometry (pointy-top, exact tessellation) ────────────────────────
// For pointy-top hexes with circumradius `size`:
//   width  = sqrt(3) * size
//   height = 2 * size
//   neighbor step x = sqrt(3) * size       (= width)
//   neighbor step y = 1.5 * size           (= 3/4 of height)
// Visual breathing room between cells comes from an inner inset on the
// hex face (::after) — NOT from spacing centers apart — so neighbors
// remain on a true honeycomb grid.
const SQRT3 = Math.sqrt(3);
const HEX_SIZE = 86; // circumradius
const HEX_W = SQRT3 * HEX_SIZE; // ≈ 148.96
const HEX_H = 2 * HEX_SIZE; // 172
const STEP_X = HEX_W;
const STEP_Y = 1.5 * HEX_SIZE; // 129

// Keystone (center on hover): grows UPWARD only, bottom edge stays put.
const KEYSTONE_H = Math.round(HEX_H * 1.42); // ≈ 244

const STAGE_W = 1120;
const STAGE_H = 720;
const CX = STAGE_W / 2;
// First primary row sits below a top buffer large enough that the
// r=-1 ghost row above it is fully visible (and the keystone has room
// to grow upward on hover without clipping).
const CY = 235;
// The 2-on-top / 3-on-bottom honeycomb has an inherent 0.5-step
// horizontal stagger between its rows. This shift re-centers the
// composite visual midpoint on CX.
const SHIFT_X = -0.25 * (SQRT3 * HEX_SIZE);

/** Axial (q,r) → centered pixel coords on a true pointy-top honeycomb. */
function axial(q: number, r: number) {
  return {
    x: CX + SHIFT_X + (q + r / 2) * STEP_X,
    y: CY + r * STEP_Y,
  };
}

/** ─── Edit-mode layout ──────────────────────────────────────────────
 *  Edit mode uses a completely different, dedicated layout: each primary
 *  gets its own honeycomb band stacked vertically, with its satellites
 *  fanning to the right. This lets the user see EVERY hex (primary + sub)
 *  at once without overlap or clipping. */
const EDIT_STAGE_W = 760;
const EDIT_STAGE_H = 1400;
const EDIT_CX = 130;
const EDIT_CY = 120;

function editAxial(q: number, r: number) {
  return {
    x: EDIT_CX + (q + r / 2) * STEP_X,
    y: EDIT_CY + r * STEP_Y,
  };
}

/** Place primary band k so all primaries share the same x. */
function editPrimaryPos(bandIndex: number) {
  return editAxial(-bandIndex, 2 * bandIndex);
}

/** Satellite offsets relative to a primary — fan to the right and below
 *  in honeycomb-adjacent cells so the whole band reads as one continuous
 *  tessellated honeycomb. Order matches "natural reading flow". */
const EDIT_SAT_OFFSETS: ReadonlyArray<{ dq: number; dr: number }> = [
  { dq: 1, dr: 0 },
  { dq: 0, dr: 1 },
  { dq: 1, dr: 1 },
  { dq: 2, dr: 0 },
  { dq: 2, dr: 1 },
  { dq: 3, dr: 0 },
  { dq: 3, dr: 1 },
];

function editSatPos(bandIndex: number, offsetIdx: number) {
  const off =
    EDIT_SAT_OFFSETS[offsetIdx] ??
    EDIT_SAT_OFFSETS[EDIT_SAT_OFFSETS.length - 1];
  return editAxial(-bandIndex + off.dq, 2 * bandIndex + off.dr);
}



type Cell = { q: number; r: number };
type Satellite = Cell & {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
};
type Primary = Cell & {
  id: string;
  name: string;
  tier: string;
  to: string;
  icon: ReactNode;
  hue: number;
  satellites: Satellite[];
};

// ─── Layout ───────────────────────────────────────────────────────────────
// Four honeycomb rows (r = 0..3):
//   r=0  →  2 primaries with one ghost cell between them
//   r=1  →  ghost row / satellite landing zone
//   r=2  →  3 primaries with one ghost cell between each pair
//   r=3  →  ghost row / satellite landing zone below
//
// CRITICAL: every satellite coordinate below must exist in GHOST_CELLS
// so the reveal animation reads as "the empty slot fills in" — the
// satellite hex visually REPLACES the ghost it lands on.
// Fill order around a primary: Left → Bottom-Left → Bottom-Right → Right,
// then keep extending OUTWARD along the row below (alternating left/right of
// the bottom-left and bottom-right slots). We deliberately avoid the two
// top-row neighbors because those overlap the primary row above and the
// keystone-on-hover growth zone. The row below has unlimited horizontal
// runway, so satellites 5+ tile sideways instead of stacking on top.
const NEIGHBOR_OFFSETS: ReadonlyArray<{ dq: number; dr: number }> = [
  { dq: -1, dr: 0 },  // left
  { dq: -1, dr: 1 },  // bottom-left
  { dq: 0, dr: 1 },   // bottom-right
  { dq: 1, dr: 0 },   // right
  { dq: -2, dr: 1 },  // far bottom-left (left of bottom-left)
  { dq: 1, dr: 1 },   // far bottom-right (right of bottom-right)
  { dq: -3, dr: 1 },  // farther bottom-left
  { dq: 2, dr: 1 },   // farther bottom-right
];

type SatelliteSpec = Omit<Satellite, "q" | "r">;

function withNeighborPositions(
  primary: { q: number; r: number },
  sats: SatelliteSpec[],
): Satellite[] {
  // The "+" hex trails the real tools so it always sits at the end of the
  // satellite fan. Pull it out, append it after the rest, and fan into the
  // neighbor offsets in order.
  const addSat = sats.find((s) => s.id === ADD_SATELLITE_ID);
  const rest = sats.filter((s) => s.id !== ADD_SATELLITE_ID);
  const ordered = addSat ? [...rest, addSat] : rest;
  return ordered.slice(0, NEIGHBOR_OFFSETS.length).map((s, i) => ({
    ...s,
    q: primary.q + NEIGHBOR_OFFSETS[i].dq,
    r: primary.r + NEIGHBOR_OFFSETS[i].dr,
  }));
}

// Special satellite id reserved for the "+" hex that opens the
// AddCustomHexDialog instead of navigating anywhere. It's appended to
// every primary so users can always extend the section they're in.
export const ADD_SATELLITE_ID = "add";
const ADD_SAT: SatelliteSpec = {
  id: ADD_SATELLITE_ID,
  label: "Add",
  to: "",
  icon: <IconPlus size={22} />,
};

export const PRIMARIES: Primary[] = (() => {
  const defs: Array<Omit<Primary, "satellites"> & { sats: SatelliteSpec[] }> = [
    {
      id: "utm",
      name: "UTM Builder",
      tier: "Tracking",
      to: "/tools/utm",
      q: -1,
      r: 0,
      hue: 275,
      icon: <IconUtm size={34} />,
      sats: [
        { id: "name", label: "New UTM", to: "/tools/utm", icon: <IconSpark size={20} /> },
        { id: "utm-all", label: "All UTMs", to: "/tools/all-utms", icon: <IconScroll size={20} /> },
        { id: "tax", label: "Naming conventions", to: "/tools/taxonomy", icon: <IconSpark size={20} /> },
        ADD_SAT,
      ],
    },
    {
      id: "funnel",
      name: "Funnel",
      tier: "Analytics",
      to: "/funnel",
      q: 1,
      r: 0,
      hue: 200,
      icon: <IconFunnel size={34} />,
      sats: [
        { id: "targets", label: "MQL / SQO", to: "/tools/funnel-targets", icon: <IconSpark size={20} /> },
        { id: "perf2", label: "Performance", to: "/tools/campaign-performance", icon: <IconChart size={20} /> },
        ADD_SAT,
      ],
    },
    {
      id: "campaign",
      name: "Campaign-in-a-box",
      tier: "Workflow",
      to: "/tools/campaign-in-a-box",
      q: -1,
      r: 2,
      hue: 150,
      icon: <IconCampaign size={34} />,
      sats: [
        { id: "creator", label: "Name Generator", to: "/tools/campaign-creator", icon: <IconCampaign size={20} /> },
        { id: "import", label: "List Import", to: "/tools/import", icon: <IconImport size={20} /> },
        { id: "events", label: "Events", to: "/tools/events", icon: <IconCalendar size={20} /> },
        ADD_SAT,
      ],
    },
  ];
  return defs.map(({ sats, ...p }) => ({ ...p, satellites: withNeighborPositions(p, sats) }));
})();

// Muted "ghost" cells — the resting honeycomb mass. We start from a
// hand-tuned aesthetic footprint, then UNION in every neighbor of every
// primary so any satellite slot (current or future) always has a matching
// ghost underneath it. Add a satellite to any primary and the ghost layer
// keeps up automatically.
const GHOST_CELLS: Cell[] = (() => {
  const primarySet = new Set(PRIMARIES.map((p) => `${p.q},${p.r}`));
  const cells = new Map<string, Cell>();
  const add = (q: number, r: number) => cells.set(`${q},${r}`, { q, r });
  // Wide horizontal flood — generate enough cells per row that the
  // honeycomb visually runs off both edges of the content area. The
  // .mp-htt-root clips overflow so extras never bleed under the sidebar.
  const FLOOD_MIN_Q = -16;
  const FLOOD_MAX_Q = 15;
  // Extended vertical range so the dashboard launcher has enough rows
  // above and below to fade gradually to zero — no visible hard edge.
  for (let r = -4; r <= 6; r++) {
    for (let q = FLOOD_MIN_Q; q <= FLOOD_MAX_Q; q++) add(q, r);
  }
  // Dynamic union: ensure every neighbor of every primary exists as a
  // ghost slot so satellite reveals always "replace" a ghost.
  for (const p of PRIMARIES) {
    for (const o of NEIGHBOR_OFFSETS) add(p.q + o.dq, p.r + o.dr);
  }
  for (const key of primarySet) cells.delete(key);
  return Array.from(cells.values());
})();

function ghostFadeFor(x: number, y: number) {
  const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  const dx = Math.abs(x - CX);
  const dy = Math.abs(y - (CY + STEP_Y));
  // Symmetric fade on all four edges. Outer ghost rows stay visible
  // (~0.2 opacity) so the lattice dissolves rather than vanishes —
  // matches the left/right falloff.
  // Very wide fade band — ramps from full opacity near the live primaries
  // out to zero over ~500px. Avoids any visible cutoff line at the edge.
  const xFade = 1 - smooth((dx - 280) / 520);
  const yFade = 1 - smooth((dy - 40) / 540);
  return Math.max(0, Math.min(xFade, yFade));
}

// ─── Component ────────────────────────────────────────────────────────────
interface HexToolsTreeProps {
  /** When set, that primary id stays bright while everything else dims and
   *  the whole stage shifts left so a right-side panel can host its UI. */
  focusedId?: string | null;
  /** Currently focused satellite id (relative to focused primary) — used to
   *  highlight which sub-tab is open. */
  focusedSatelliteId?: string | null;
  /** If provided AND a clicked primary's id is in `focusablePrimaryIds`,
   *  this is called instead of navigating, so the parent can open a panel. */
  onFocus?: (primaryId: string) => void;
  /** Primary ids that should open via `onFocus` instead of navigating. */
  focusablePrimaryIds?: ReadonlySet<string>;
  /** Called when a satellite of the focused primary is clicked. Return true
   *  to indicate the satellite click was handled (open in panel) and skip
   *  the default route navigation. */
  onSatelliteFocus?: (primaryId: string, satelliteId: string) => boolean;
  /** Called when the user clicks the empty stage background while focused,
   *  so the parent can close the panel and return to the hub. */
  onBackgroundClick?: () => void;
  /** Called when the user clicks the "+" satellite on a primary, so the
   *  parent can open the AddCustomHexDialog scoped to that section. */
  onAddCustomHex?: (primaryId: string) => void;
  /** When true, the grid enters "edit hexes" mode: hexes wiggle, each one
   *  gains a hide (✕) button, and clicks no longer navigate. */
  editMode?: boolean;
  /** Applies a strong edge dissolve to ghost cells for the dashboard launcher. */
  fadeGhostEdges?: boolean;
}

/** Inline SVG hex-shaped dashed ring used to mark editable hexes. The hex
 *  silhouette is clip-path on the parent, so a CSS outline would render
 *  rectangular — drawing the polygon as SVG keeps the dashes following the
 *  hex edges. `vector-effect="non-scaling-stroke"` keeps stroke width even
 *  when the SVG is stretched to non-square hex proportions. */
function hexPoints(inset: number) {
  const w = HEX_W;
  const h = HEX_H;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const points = [
    [inset + innerW / 2, inset],
    [inset + innerW, inset + innerH * 0.25],
    [inset + innerW, inset + innerH * 0.75],
    [inset + innerW / 2, inset + innerH],
    [inset, inset + innerH * 0.75],
    [inset, inset + innerH * 0.25],
  ];
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

const EDIT_RING_POINTS = hexPoints(6.5);

type SatelliteDragState = {
  primaryId: string;
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

function EditRing() {
  return (
    <svg
      className="mp-htt-edit-ring"
      viewBox={`0 0 ${HEX_W} ${HEX_H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon
        points={EDIT_RING_POINTS}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="6 5"
        strokeDashoffset="0.5"
        strokeLinecap="butt"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function HexToolsTree({
  focusedId = null,
  focusedSatelliteId = null,
  onFocus,
  focusablePrimaryIds,
  onSatelliteFocus,
  onBackgroundClick,
  onAddCustomHex,
  editMode = false,
  fadeGhostEdges = false,
}: HexToolsTreeProps = {}) {
  const navigate = useNavigate();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tapRevealed, setTapRevealed] = useState<string | null>(null);
  const [draggingSat, setDraggingSat] = useState<SatelliteDragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ primaryId: string; id: string } | null>(null);
  const hidden = useHiddenHexes();
  const satelliteOrders = useSatelliteOrders();

  const go = useCallback((to: string) => navigate({ to }), [navigate]);

  const orderedEditableSatellites = useCallback(
    (primary: Primary) => {
      const defaults = primary.satellites.filter((s) => s.id !== ADD_SATELLITE_ID);
      const order = satelliteOrders[primary.id] ?? [];
      const byId = new Map(defaults.map((s) => [s.id, s]));
      return [
        ...order.map((id) => byId.get(id)).filter((s): s is Satellite => Boolean(s)),
        ...defaults.filter((s) => !order.includes(s.id)),
      ];
    },
    [satelliteOrders],
  );

  const orderedSatellites = useCallback(
    (primary: Primary) => {
      const add = primary.satellites.find((s) => s.id === ADD_SATELLITE_ID);
      const ordered = orderedEditableSatellites(primary);
      const all = add ? [...ordered, add] : ordered;
      return all.slice(0, NEIGHBOR_OFFSETS.length).map((s, i) => ({
        ...s,
        q: primary.q + NEIGHBOR_OFFSETS[i].dq,
        r: primary.r + NEIGHBOR_OFFSETS[i].dr,
      }));
    },
    [orderedEditableSatellites],
  );

  const dropTargetFromPoint = (x: number, y: number) => {
    if (typeof document === "undefined") return null;
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-primary-id][data-sat-id]");
    if (!el) return null;
    return { primaryId: el.dataset.primaryId ?? "", id: el.dataset.satId ?? "" };
  };

  const handleSatellitePointerDown = (
    e: PointerEvent<HTMLDivElement>,
    primaryId: string,
    satelliteId: string,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingSat({ primaryId, id: satelliteId, startX: e.clientX, startY: e.clientY, x: 0, y: 0 });
  };

  const handleSatellitePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingSat) return;
    e.preventDefault();
    const next = { ...draggingSat, x: e.clientX - draggingSat.startX, y: e.clientY - draggingSat.startY };
    setDraggingSat(next);
    const target = dropTargetFromPoint(e.clientX, e.clientY);
    setDropTarget(target?.primaryId === next.primaryId && target.id !== next.id ? target : null);
  };

  const handleSatellitePointerUp = (e: PointerEvent<HTMLDivElement>, primary: Primary) => {
    const dragged = draggingSat;
    const target = dropTargetFromPoint(e.clientX, e.clientY) ?? dropTarget;
    setDraggingSat(null);
    setDropTarget(null);
    if (!dragged || target?.primaryId !== primary.id || dragged.id === target.id) return;
    reorderSatellite(primary.id, dragged.id, target.id, orderedEditableSatellites(primary).map((s) => s.id));
  };

  const isFocusMode = focusedId != null;

  const handlePrimaryClick = (p: Primary) => {
    // In edit mode, clicks reveal satellites (so users can hide them too)
    // instead of navigating anywhere.
    if (editMode) {
      setHoverId((cur) => (cur === p.id ? null : p.id));
      setTapRevealed(p.id);
      return;
    }
    // Focus-mode aware: if the primary is panel-eligible, open the panel
    // instead of routing — even when no satellites exist.
    if (onFocus && focusablePrimaryIds?.has(p.id)) {
      onFocus(p.id);
      return;
    }
    if (p.satellites.length === 0) return go(p.to);
    const isTouch =
      typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches;
    if (isTouch) {
      if (tapRevealed === p.id) return go(p.to);
      setTapRevealed(p.id);
      setHoverId(p.id);
      return;
    }
    go(p.to);
  };

  // Hover-driven satellite reveal is suppressed in focus mode — focused
  // primary's satellites render from the focus branch below instead.
  const activePrimary =
    isFocusMode || editMode ? null : PRIMARIES.find((p) => p.id === hoverId) ?? null;

  // ─── Focus glide ──────────────────────────────────────────────────────
  // When a tool is focused, translate the focused primary (and its
  // satellites) to a fixed axial slot on the ghost grid so the cluster
  // snaps perfectly onto the honeycomb shadows behind it. Same target for
  // every focusable primary — UTM, Funnel, etc. all land in the same slot
  // so the side panel reads as one consistent docked surface.
  const FOCUS_TARGET_Q = -3;
  const FOCUS_TARGET_R = 2;
  const focusedPrimary =
    isFocusMode ? PRIMARIES.find((p) => p.id === focusedId) ?? null : null;
  const focusDelta = (() => {
    if (!focusedPrimary) return { dx: 0, dy: 0 };
    const base = axial(focusedPrimary.q, focusedPrimary.r);
    const target = axial(FOCUS_TARGET_Q, FOCUS_TARGET_R);
    return { dx: target.x - base.x, dy: target.y - base.y };
  })();


  return (
    <div
      className={`mp-htt-root${isFocusMode ? " is-focus-mode" : ""}${editMode ? " is-edit-mode" : ""}`}
      onMouseLeave={() => {
        setHoverId(null);
        setTapRevealed(null);
      }}
    >
      <style>{CSS_TEXT}</style>

      {/* Outer scaler: shrinks the fixed-pixel stage to fit narrow
          containers without distorting any geometry. */}
      <div className="mp-htt-scaler" style={{ width: editMode ? EDIT_STAGE_W : STAGE_W, height: editMode ? EDIT_STAGE_H : STAGE_H }}>
        <div
          className="mp-htt-stage"
          role="navigation"
          aria-label="Marketing tools"
          style={{ width: editMode ? EDIT_STAGE_W : STAGE_W, height: editMode ? EDIT_STAGE_H : STAGE_H }}
          onClick={(e) => {
            // Close focus when the user clicks the empty stage background —
            // not on a hex button. Lets them snap back to the hub by
            // clicking off to the upper-left, as requested.
            if (!isFocusMode || !onBackgroundClick) return;
            if (e.target === e.currentTarget) onBackgroundClick();
          }}
        >

          <div className="mp-htt-stars" aria-hidden />

          {/* Ghost honeycomb — hidden in edit mode where the layout differs */}
          {!editMode && (
            <div className="mp-htt-ghost-layer" aria-hidden>
              {GHOST_CELLS.filter((c) => fadeGhostEdges || (c.r >= -1 && c.r <= 3)).map((c) => {
                const pos = axial(c.q, c.r);
                const ghostFade = fadeGhostEdges ? ghostFadeFor(pos.x, pos.y) : 1;
                return (
                  <div
                    key={`ghost-${c.q}-${c.r}`}
                    className="mp-htt-hex mp-htt-ghost"
                    style={{ left: pos.x, top: pos.y, width: HEX_W, height: HEX_H, "--mp-ghost-fade": ghostFade } as React.CSSProperties}
                  />
                );
              })}
            </div>
          )}

          {/* Primaries */}
          {PRIMARIES.map((p) => {
            // Filter out user-hidden primaries — never render them in any mode.
            if (hidden.has(p.id)) return null;
            const isActive = activePrimary?.id === p.id;
            const isFocusedPrimary = focusedId === p.id;
            // In focus mode, hide all non-focused primaries entirely.
            if (isFocusMode && !isFocusedPrimary) return null;
            const dimmed = isFocusMode
              ? !isFocusedPrimary
              : !editMode && activePrimary !== null && !isActive;
            // In edit mode, primaries use a vertical band layout (one per row);
            // otherwise the original axial grid.
            const editBandIndex = editMode
              ? PRIMARIES.filter((q) => !hidden.has(q.id)).findIndex(
                  (q) => q.id === p.id,
                )
              : -1;
            const pos =
              editMode && editBandIndex >= 0
                ? editPrimaryPos(editBandIndex)
                : axial(p.q, p.r);
            // Suppress the dramatic keystone grow in edit mode so the ✕
            // overlay sits at a predictable spot.
            const useKeystone = !editMode && !isFocusMode && (isActive || isFocusedPrimary);
            const height = useKeystone ? KEYSTONE_H : HEX_H;
            // Grow UPWARD only: bottom edge stays pinned at pos.y + HEX_H/2.
            const baseCenterY = useKeystone
              ? pos.y + HEX_H / 2 - KEYSTONE_H / 2
              : pos.y;
            const leftPx = isFocusedPrimary ? pos.x + focusDelta.dx : pos.x;
            const topPx = isFocusedPrimary
              ? baseCenterY + focusDelta.dy
              : baseCenterY;

            return (
              <button
                key={p.id}
                type="button"
                className={`mp-htt-hex mp-htt-primary${isActive || isFocusedPrimary ? " is-active" : ""}${useKeystone ? " is-keystone" : ""}${dimmed ? " is-dimmed" : ""}${isFocusedPrimary ? " is-focused" : ""}${editMode ? " is-editable" : ""}`}
                style={{
                  left: leftPx,
                  top: topPx,
                  width: HEX_W,
                  height,
                  ["--hex-hue" as string]: p.hue,
                }}
                onMouseEnter={() => !isFocusMode && !editMode && setHoverId(p.id)}
                onFocus={() => !isFocusMode && !editMode && setHoverId(p.id)}
                onClick={() => handlePrimaryClick(p)}
                aria-label={editMode ? `Edit ${p.name}` : `${p.name}${p.satellites.length ? ` — ${p.satellites.length} shortcut${p.satellites.length === 1 ? "" : "s"}` : ""}`}
                aria-pressed={isFocusedPrimary || undefined}
              >
                <span className="mp-htt-sheen" aria-hidden />
                <span className="mp-htt-inner">
                  <span className="mp-htt-icon">{p.icon}</span>
                  <span className="mp-htt-name">{p.name}</span>
                  <span className="mp-htt-rule" aria-hidden />
                  <span className="mp-htt-tier">{p.tier}</span>
                </span>
                {editMode && <EditRing />}
                {editMode && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="mp-htt-remove"
                    aria-label={`Hide ${p.name}`}
                    title={`Hide ${p.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      hideHex(p.id);
                      if (hoverId === p.id) setHoverId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        hideHex(p.id);
                      }
                    }}
                  >
                    <IconClose size={12} />
                  </span>
                )}
              </button>
            );
          })}

          {/* Edit-mode: show satellites of ALL visible primaries at once so
              users can hide any submenu hex without having to expand each
              parent. Click-to-nav is disabled; only ✕ is interactive. */}
          {editMode && !isFocusMode &&
            PRIMARIES.filter((p) => !hidden.has(p.id)).flatMap((p, bandIdx) => {
              const visible = orderedEditableSatellites(p).filter(
                (s) => !hidden.has(satKey(p.id, s.id)),
              );
              const baseOrder = visible.map((s) => s.id);

              // iPhone-style live preview: while dragging within this primary
              // and hovering a sibling, compute the order as if the drop
              // happened now. Non-dragged hexes spring to their new slots;
              // the dragged hex stays anchored at its original slot (and is
              // visually offset by the cursor translate) so layout animation
              // doesn't fight the pointer.
              let previewOrder = baseOrder;
              const draggingThis = draggingSat?.primaryId === p.id ? draggingSat : null;
              const targetThis =
                draggingThis && dropTarget?.primaryId === p.id && dropTarget.id !== draggingThis.id
                  ? dropTarget
                  : null;
              if (draggingThis && targetThis) {
                const from = baseOrder.indexOf(draggingThis.id);
                const to = baseOrder.indexOf(targetThis.id);
                if (from >= 0 && to >= 0) {
                  const next = baseOrder.slice();
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  previewOrder = next;
                }
              }

              return visible.map((s) => {
                const isDragging = draggingThis?.id === s.id;
                const slotIndex = isDragging
                  ? baseOrder.indexOf(s.id)
                  : previewOrder.indexOf(s.id);
                const pos = editSatPos(bandIdx, slotIndex);
                const slotX = pos.x;
                const slotY = pos.y;

                return (
                  <motion.div
                    key={`edit-${p.id}-${s.id}`}
                    className="mp-htt-sat-anchor"
                    style={{
                      left: 0,
                      top: 0,
                      width: HEX_W,
                      height: HEX_H,
                      ["--hex-hue" as string]: p.hue,
                      zIndex: isDragging ? 30 : 1,
                    }}
                    initial={false}
                    animate={{ x: slotX, y: slotY }}
                    transition={
                      isDragging
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 520, damping: 38, mass: 0.6 }
                    }
                  >
                    <div
                      className={`mp-htt-hex mp-htt-sat mp-htt-sat-inner is-editable is-draggable${isDragging ? " is-dragging" : ""}`}
                      data-primary-id={p.id}
                      data-sat-id={s.id}
                      style={{
                        width: HEX_W,
                        height: HEX_H,
                        transform: isDragging
                          ? `translate(${draggingSat!.x}px, ${draggingSat!.y}px)`
                          : undefined,
                        touchAction: "none",
                        ["--hex-hue" as string]: p.hue,
                      }}
                      onPointerDown={(e) => handleSatellitePointerDown(e, p.id, s.id)}
                      onPointerMove={handleSatellitePointerMove}
                      onPointerUp={(e) => handleSatellitePointerUp(e, p)}
                      onPointerCancel={() => {
                        setDraggingSat(null);
                        setDropTarget(null);
                      }}
                    >
                      <span className="mp-htt-sheen" aria-hidden />
                      <span className="mp-htt-inner">
                        <span className="mp-htt-icon">{s.icon}</span>
                        <span className="mp-htt-name">{s.label}</span>
                      </span>
                      <EditRing />
                      <span
                        role="button"
                        tabIndex={0}
                        className="mp-htt-remove"
                        aria-label={`Hide ${s.label}`}
                        title={`Hide ${s.label}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          hideHex(satKey(p.id, s.id));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            hideHex(satKey(p.id, s.id));
                          }
                        }}
                      >
                        <IconClose size={11} />
                      </span>
                    </div>
                  </motion.div>
                );
              });
            })}



          {/* Satellites of the active primary (not shown in focus mode) */}
          <AnimatePresence>
            {activePrimary && orderedSatellites(activePrimary)
              .filter(
                (s) =>
                  s.id === ADD_SATELLITE_ID ||
                  !hidden.has(satKey(activePrimary.id, s.id)),
              )
              .map((s, i) => {
              const pos = axial(s.q, s.r);
              const canHide = editMode && s.id !== ADD_SATELLITE_ID;
              return (
                <div
                  key={`${activePrimary.id}-${s.id}`}
                  className="mp-htt-sat-anchor"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: HEX_W,
                    height: HEX_H,
                    ["--hex-hue" as string]: activePrimary.hue,
                  }}
                >
                  <motion.button
                    type="button"
                    className={`mp-htt-hex mp-htt-sat mp-htt-sat-inner${editMode ? " is-editable" : ""}`}
                    style={{ width: HEX_W, height: HEX_H, ["--hex-hue" as string]: activePrimary.hue }}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{
                      delay: i * 0.045,
                      type: "spring",
                      stiffness: 340,
                      damping: 24,
                      mass: 0.6,
                    }}
                    onMouseEnter={() => setHoverId(activePrimary.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editMode) return; // disable nav in edit mode
                      if (s.id === ADD_SATELLITE_ID) {
                        onAddCustomHex?.(activePrimary.id);
                        return;
                      }
                      if (onSatelliteFocus?.(activePrimary.id, s.id)) {
                        return;
                      }
                      if (!onSatelliteFocus) go(s.to);
                    }}
                    aria-label={s.id === ADD_SATELLITE_ID ? `Add custom hex to ${activePrimary.name}` : s.label}
                  >
                    <span className="mp-htt-sheen" aria-hidden />
                    <span className={`mp-htt-inner${s.id === ADD_SATELLITE_ID ? " mp-htt-add-inner" : ""}`}>
                      <span className="mp-htt-icon">{s.icon}</span>
                      <span className="mp-htt-name">{s.label}</span>
                    </span>
                    {canHide && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="mp-htt-remove"
                        aria-label={`Hide ${s.label}`}
                        title={`Hide ${s.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          hideHex(satKey(activePrimary.id, s.id));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            hideHex(satKey(activePrimary.id, s.id));
                          }
                        }}
                      >
                        <IconClose size={11} />
                      </span>
                    )}
                  </motion.button>
                </div>
              );
            })}
          </AnimatePresence>

          {/* Satellites of the FOCUSED primary — visible in focus mode so
              the user can hop between sub-tools without closing the panel.
              Positioned at neighbor cells, then translated by focusDelta
              so they orbit the focused hex at its bottom-left target. */}
          <AnimatePresence>
            {focusedPrimary && orderedSatellites(focusedPrimary).map((s, i) => {
              const pos = axial(s.q, s.r);
              const isActiveSat = focusedSatelliteId === s.id;
              return (
                <div
                  key={`focus-${focusedPrimary.id}-${s.id}`}
                  className="mp-htt-sat-anchor"
                  style={{
                    left: pos.x + focusDelta.dx,
                    top: pos.y + focusDelta.dy,
                    width: HEX_W,
                    height: HEX_H,
                    ["--hex-hue" as string]: focusedPrimary.hue,
                  }}
                >
                  <motion.button
                    type="button"
                    className={`mp-htt-hex mp-htt-sat mp-htt-sat-inner${isActiveSat ? " mp-htt-sat-active" : ""}`}
                    style={{ width: HEX_W, height: HEX_H, ["--hex-hue" as string]: focusedPrimary.hue }}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{
                      delay: 0.18 + i * 0.05,
                      type: "spring",
                      stiffness: 320,
                      damping: 26,
                      mass: 0.6,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (s.id === ADD_SATELLITE_ID) {
                        onAddCustomHex?.(focusedPrimary.id);
                        return;
                      }
                      if (onSatelliteFocus?.(focusedPrimary.id, s.id)) {
                        return;
                      }
                      if (!onSatelliteFocus) go(s.to);
                    }}
                    aria-label={s.id === ADD_SATELLITE_ID ? `Add custom hex to ${focusedPrimary.name}` : s.label}
                    aria-pressed={isActiveSat || undefined}
                  >
                    <span className="mp-htt-sheen" aria-hidden />
                    <span className={`mp-htt-inner${s.id === ADD_SATELLITE_ID ? " mp-htt-add-inner" : ""}`}>
                      <span className="mp-htt-icon">{s.icon}</span>
                      <span className="mp-htt-name">{s.label}</span>
                    </span>
                  </motion.button>
                </div>
              );
            })}
          </AnimatePresence>


        </div>
      </div>

    </div>
  );
}


// ─── Styles ───────────────────────────────────────────────────────────────
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
// Keystone: same 6-sided silhouette but vertically stretched. The slope of
// the top/bottom edges is preserved by the percent-based 25%/75% points
// scaling with height — visually it reads as a taller, narrower hex.
// We use slightly steeper shoulders so the elongation feels intentional.
const KEYSTONE_CLIP =
  "polygon(50% 0%, 100% 18%, 100% 82%, 50% 100%, 0% 82%, 0% 18%)";

// Visual breathing room between adjacent hex faces. Centers sit on the
// exact honeycomb grid; this inset shrinks each face so neighbors don't
// touch, producing a uniform gap on every shared edge.
const FACE_INSET = "5px";

const CSS_TEXT = `
.mp-htt-root {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  container-type: inline-size;
  overflow: visible;
}
/* Scaler hosts a fixed-pixel stage; we scale it down (never up) so it
   fits narrow containers without distorting hex geometry. */
.mp-htt-scaler {
  position: relative;
  max-width: 100%;
}
.mp-htt-stage {
  position: absolute;
  inset: 0;
  overflow: visible;
}
@container (max-width: ${STAGE_W}px) {
  .mp-htt-root:not(.is-edit-mode) .mp-htt-scaler {
    width: 100% !important;
    height: calc(100cqw * ${STAGE_H} / ${STAGE_W}) !important;
  }
  .mp-htt-root:not(.is-edit-mode) .mp-htt-stage {
    transform-origin: top left;
    transform: scale(calc(100cqw / ${STAGE_W}px));
    width: ${STAGE_W}px !important;
    height: ${STAGE_H}px !important;
  }
}
@container (max-width: ${EDIT_STAGE_W}px) {
  .mp-htt-root.is-edit-mode .mp-htt-scaler {
    width: 100% !important;
    height: calc(100cqw * ${EDIT_STAGE_H} / ${EDIT_STAGE_W}) !important;
  }
  .mp-htt-root.is-edit-mode .mp-htt-stage {
    transform-origin: top left;
    transform: scale(calc(100cqw / ${EDIT_STAGE_W}px));
    width: ${EDIT_STAGE_W}px !important;
    height: ${EDIT_STAGE_H}px !important;
  }
}





.mp-htt-stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.45;
  background-image:
    radial-gradient(1px 1px at 14% 22%, oklch(1 0 0 / 0.55), transparent 60%),
    radial-gradient(1px 1px at 78% 18%, oklch(0.82 0.18 305 / 0.6), transparent 60%),
    radial-gradient(1px 1px at 32% 82%, oklch(1 0 0 / 0.4), transparent 60%),
    radial-gradient(1.4px 1.4px at 88% 70%, oklch(0.86 0.13 90 / 0.5), transparent 60%),
    radial-gradient(1px 1px at 50% 50%, oklch(0.78 0.18 340 / 0.35), transparent 60%);
  animation: mp-htt-twinkle 9s ease-in-out infinite;
}
@keyframes mp-htt-twinkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.mp-htt-ghost-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: visible;
}

/* Shared hex — identical silhouette + border across primaries & satellites.
   Position is the EXACT honeycomb center; the face is inset so adjacent
   hexes have a uniform visual gap on every shared edge. */
.mp-htt-hex {
  position: absolute;
  transform: translate(-50%, -50%);
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: oklch(0.97 0.005 240);
  outline: none;
  z-index: 2;
  transition:
    filter 0.3s ease,
    height 0.35s cubic-bezier(0.2, 0.7, 0.2, 1),
    top 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
  will-change: filter, height, top;
}
/* The visible face is a child layer inset by ${FACE_INSET} so the grid
   reads as a true honeycomb with uniform mortar lines. */
.mp-htt-hex::before {
  content: '';
  position: absolute;
  inset: ${FACE_INSET};
  clip-path: ${HEX_CLIP};
  background: oklch(0.78 0.16 var(--hex-hue, 88) / 0.6);
  transition: background 0.35s ease, clip-path 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.mp-htt-hex::after {
  content: '';
  position: absolute;
  inset: calc(${FACE_INSET} + 1.5px);
  clip-path: ${HEX_CLIP};
  background: linear-gradient(160deg,
    oklch(0.34 0.13 var(--hex-hue, 290) / 0.97) 0%,
    oklch(0.20 0.09 var(--hex-hue, 320) / 0.97) 55%,
    oklch(0.10 0.03 270 / 1) 100%);
  box-shadow:
    inset 0 0 36px oklch(0.72 0.2 var(--hex-hue, 275) / 0.22),
    inset 0 2px 0 oklch(1 0 0 / 0.1),
    inset 0 -2px 0 oklch(0 0 0 / 0.45),
    0 18px 44px -12px oklch(0.06 0.02 270 / 0.95);
  transition: background 0.35s ease, box-shadow 0.35s ease, clip-path 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.mp-htt-sheen {
  position: absolute;
  inset: calc(${FACE_INSET} + 1.5px);
  clip-path: ${HEX_CLIP};
  background: radial-gradient(ellipse 70% 32% at 50% 10%,
    oklch(1 0 0 / 0.18),
    transparent 70%);
  pointer-events: none;
  z-index: 1;
  transition: clip-path 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.mp-htt-hex:hover { z-index: 6; }
.mp-htt-hex:hover::before {
  background: oklch(0.82 0.18 var(--hex-hue, 88) / 0.95);
}
.mp-htt-hex:hover::after {
  box-shadow:
    inset 0 0 50px oklch(0.82 0.18 var(--hex-hue, 88) / 0.36),
    inset 0 2px 0 oklch(1 0 0 / 0.22),
    inset 0 -2px 0 oklch(0 0 0 / 0.5),
    0 24px 60px -10px oklch(0.06 0.02 270 / 0.95),
    0 0 28px -2px oklch(0.82 0.18 var(--hex-hue, 88) / 0.65),
    0 0 64px 4px oklch(0.82 0.18 var(--hex-hue, 88) / 0.42),
    0 0 110px 12px oklch(0.82 0.18 var(--hex-hue, 88) / 0.22);
}
.mp-htt-hex:focus-visible::before {
  background: oklch(0.82 0.18 var(--hex-hue, 88));
}

/* Active center — morph face into the taller "keystone" silhouette. */
.mp-htt-primary.is-keystone { z-index: 8; }
.mp-htt-primary.is-keystone::before,
.mp-htt-primary.is-keystone::after,
.mp-htt-primary.is-keystone .mp-htt-sheen {
  clip-path: ${KEYSTONE_CLIP};
}

/* Active primary — colored border + warm inner glow, same silhouette */
.mp-htt-primary.is-active { z-index: 7; }

.mp-htt-primary.is-active::before {
  background: oklch(0.82 0.18 var(--hex-hue, 88) / 0.95);
}
.mp-htt-primary.is-active::after {
  background: linear-gradient(180deg,
    oklch(0.36 0.13 var(--hex-hue, 70) / 0.6) 0%,
    oklch(0.22 0.09 var(--hex-hue, 320) / 0.92) 55%,
    oklch(0.10 0.03 270 / 1) 100%);
  box-shadow:
    inset 0 0 56px oklch(0.82 0.18 var(--hex-hue, 88) / 0.34),
    inset 0 2px 0 oklch(1 0 0 / 0.2),
    inset 0 -2px 0 oklch(0 0 0 / 0.5),
    0 24px 60px -10px oklch(0.06 0.02 270 / 0.95),
    0 0 60px -8px oklch(0.82 0.18 var(--hex-hue, 88) / 0.5);
}
.mp-htt-primary.is-active .mp-htt-name { color: oklch(0.98 0.05 var(--hex-hue, 88)); }
.mp-htt-primary.is-active .mp-htt-tier { color: oklch(0.88 0.15 var(--hex-hue, 88)); }
.mp-htt-primary.is-active .mp-htt-icon { color: oklch(0.93 0.12 var(--hex-hue, 88)); }
.mp-htt-primary.is-active .mp-htt-rule {
  background: linear-gradient(90deg, transparent, oklch(0.86 0.14 88 / 0.9), transparent);
}

.mp-htt-primary.is-dimmed {
  filter: brightness(0.55) saturate(0.55);
}

/* ─── Focus mode ──────────────────────────────────────────────────────
   Triggered when a tool is open inline (right panel). The focused hex's
   own left/top transitions glide it down to the bottom-left target slot
   (see component logic) so its satellites stay reachable next to it. */
.mp-htt-root.is-focus-mode .mp-htt-ghost {
  opacity: 0.32;
  transition: opacity 0.5s ease;
}
.mp-htt-root.is-focus-mode .mp-htt-primary.is-dimmed {
  opacity: 0.22;
  filter: brightness(0.65) saturate(0.5);
  pointer-events: none;
  transition: opacity 0.35s ease, filter 0.35s ease;
}

.mp-htt-root.is-focus-mode .mp-htt-primary.is-focused {
  z-index: 9;
  animation: mp-htt-focus-pulse 3.6s ease-in-out infinite;
}
.mp-htt-root.is-focus-mode .mp-htt-primary.is-focused::after {
  box-shadow:
    inset 0 0 60px oklch(0.82 0.18 var(--hex-hue, 88) / 0.42),
    inset 0 2px 0 oklch(1 0 0 / 0.22),
    inset 0 -2px 0 oklch(0 0 0 / 0.5),
    0 24px 60px -10px oklch(0.06 0.02 270 / 0.95),
    0 0 60px -2px oklch(0.82 0.18 var(--hex-hue, 88) / 0.7),
    0 0 120px 8px oklch(0.82 0.18 var(--hex-hue, 88) / 0.35);
}
@keyframes mp-htt-focus-pulse {
  0%, 100% { filter: brightness(1) saturate(1); }
  50% { filter: brightness(1.12) saturate(1.1); }
}

/* Idle keystone aura — only on the hovered/active hex in HUB mode (not focus
   mode, where the focused hex already pulses). A slow, soft breath behind
   the keystone to invite the click without competing with the focused state. */
.mp-htt-root:not(.is-focus-mode) .mp-htt-primary.is-keystone {
  animation: mp-htt-keystone-breath 2.8s ease-in-out infinite;
}
@keyframes mp-htt-keystone-breath {
  0%, 100% { filter: brightness(1) saturate(1); }
  50%      { filter: brightness(1.08) saturate(1.06); }
}

.mp-htt-sat { z-index: 4; }
/* In focus mode, satellite hexes should read at full vibrancy (not faded)
   alongside the focused primary. Bump the face alpha and inner glow so
   they match the visual weight of the active hex. */
.mp-htt-root.is-focus-mode .mp-htt-sat::before {
  background: oklch(0.78 0.16 var(--hex-hue, 88) / 0.92);
}
.mp-htt-root.is-focus-mode .mp-htt-sat::after {
  background: linear-gradient(160deg,
    oklch(0.36 0.13 var(--hex-hue, 290) / 0.97) 0%,
    oklch(0.22 0.09 var(--hex-hue, 320) / 0.97) 55%,
    oklch(0.10 0.03 270 / 1) 100%);
  box-shadow:
    inset 0 0 44px oklch(0.78 0.18 var(--hex-hue, 275) / 0.32),
    inset 0 2px 0 oklch(1 0 0 / 0.14),
    inset 0 -2px 0 oklch(0 0 0 / 0.48),
    0 20px 50px -12px oklch(0.06 0.02 270 / 0.95);
}
/* Anchor wraps each satellite at its exact honeycomb center; framer-motion's
   inline transform on the inner button would otherwise clobber the
   translate(-50%, -50%) centering used by every other hex. */
.mp-htt-sat-anchor {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 4;
  pointer-events: none;
}
.mp-htt-sat-inner {
  position: absolute;
  left: 0;
  top: 0;
  transform: none;
  pointer-events: auto;
}

/* Ghost cells — show the empty honeycomb structure at rest */
.mp-htt-ghost {
  z-index: 1;
  pointer-events: none;
  cursor: default;
  opacity: var(--mp-ghost-fade, 1);
  transition: opacity 0.35s ease;
}
.mp-htt-ghost::before {
  background: oklch(0.65 0.06 280 / 0.18);
}
.mp-htt-ghost::after {
  background: linear-gradient(160deg,
    oklch(0.20 0.04 280 / 0.45) 0%,
    oklch(0.12 0.02 270 / 0.55) 100%);
  box-shadow:
    inset 0 0 18px oklch(0.5 0.1 280 / 0.08),
    inset 0 1px 0 oklch(1 0 0 / 0.04);
}
.mp-htt-ghost .mp-htt-sheen { display: none; }
.mp-htt-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 14px 16px;
  gap: 6px;
  text-align: center;
  pointer-events: none;
}
.mp-htt-icon {
  color: oklch(0.97 0.005 240);
  display: inline-flex;
  margin-bottom: 2px;
  transition: color 0.3s ease;
}
.mp-htt-name {
  font-family: var(--font-display);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: 0.005em;
  color: oklch(0.97 0.005 240);
  max-width: 108px;
  transition: color 0.3s ease;
}
.mp-htt-rule {
  width: 28px;
  height: 1px;
  background: oklch(1 0 0 / 0.18);
  transition: background 0.3s ease;
}
.mp-htt-tier {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 10px;
  letter-spacing: 0.22em;
  color: oklch(0.97 0.005 240 / 0.6);
  text-transform: lowercase;
  transition: color 0.3s ease;
}
.mp-htt-sat .mp-htt-name { font-size: 12.5px; max-width: 100px; }

/* "+" satellite — the affordance to add a custom hex. Reads as a darker,
   dashed slot with a bright + so it's clearly an action, not a tool. */
.mp-htt-add-inner .mp-htt-name {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: oklch(0.97 0.005 240 / 0.72);
}
.mp-htt-add-inner .mp-htt-icon {
  color: oklch(0.92 0.16 var(--hex-hue, 88));
}


/* ─── Edit mode ────────────────────────────────────────────────────────
   Toggled by the cog next to the page title. Hexes wiggle subtly, gain a
   dashed accent ring, and each one shows a ✕ button in its top-right
   corner so the user can hide it. Clicks on the hex body are suppressed
   in JS — only the ✕ is interactive (and the "+" satellite). */
.mp-htt-root.is-edit-mode .mp-htt-hex.is-editable {
  animation: mp-htt-wiggle 1.6s ease-in-out infinite;
  cursor: default;
}
.mp-htt-root.is-edit-mode .mp-htt-hex.is-editable:nth-child(even) {
  animation-delay: -0.8s;
}
.mp-htt-root.is-edit-mode .mp-htt-hex.is-editable .mp-htt-edit-ring,
.mp-htt-edit-ring {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  pointer-events: none;
  z-index: 3;
  color: oklch(0.92 0.2 var(--hex-hue, 88) / 0.95);
  overflow: visible;
  filter: drop-shadow(0 0 6px oklch(0.82 0.2 var(--hex-hue, 88) / 0.5));
}
@keyframes mp-htt-wiggle {
  0%, 100% { transform: translate(-50%, -50%) rotate(-0.6deg); }
  50%      { transform: translate(-50%, -50%) rotate(0.6deg); }
}
/* Satellites use translate: none (their anchor handles centering) */
.mp-htt-root.is-edit-mode .mp-htt-sat-inner.is-editable {
  animation: mp-htt-wiggle-sat 1.6s ease-in-out infinite;
}
.mp-htt-root.is-edit-mode .mp-htt-sat-inner.is-draggable {
  cursor: grab;
}
.mp-htt-root.is-edit-mode .mp-htt-sat-inner.is-draggable:active {
  cursor: grabbing;
}
.mp-htt-root.is-edit-mode .mp-htt-sat-inner.is-dragging {
  opacity: 0.85;
  filter: saturate(1.15) drop-shadow(0 12px 24px oklch(0 0 0 / 0.45));
  pointer-events: none;
  animation: none !important;
  transition: none !important;
  z-index: 30 !important;
}
.mp-htt-root.is-edit-mode .mp-htt-sat-inner.is-drop-target .mp-htt-edit-ring {
  color: oklch(0.98 0.16 var(--hex-hue, 88));
  filter: drop-shadow(0 0 12px oklch(0.92 0.2 var(--hex-hue, 88) / 0.8));
}
@keyframes mp-htt-wiggle-sat {
  0%, 100% { transform: rotate(-0.8deg); }
  50%      { transform: rotate(0.8deg); }
}

.mp-htt-remove {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: oklch(0.18 0.04 20 / 0.95);
  color: oklch(0.98 0.02 20);
  border: 1px solid oklch(0.7 0.2 20 / 0.7);
  box-shadow: 0 4px 14px -4px oklch(0 0 0 / 0.6);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.15s ease, background 0.15s ease;
}
.mp-htt-remove:hover {
  background: oklch(0.55 0.22 20);
  transform: scale(1.12);
}
.mp-htt-sat .mp-htt-remove {
  top: 8px;
  right: 14px;
  width: 20px;
  height: 20px;
}

@media (max-width: 900px) {
  .mp-htt-stage { aspect-ratio: 760 / 900 !important; }
}
@media (prefers-reduced-motion: reduce) {
  .mp-htt-hex { transition-duration: 0.01ms; }
  .mp-htt-stars { animation: none; }
  .mp-htt-root.is-edit-mode .mp-htt-hex.is-editable,
  .mp-htt-root.is-edit-mode .mp-htt-sat-inner.is-editable { animation: none; }
  .mp-htt-root:not(.is-focus-mode) .mp-htt-primary.is-keystone { animation: none; }
}
`;
