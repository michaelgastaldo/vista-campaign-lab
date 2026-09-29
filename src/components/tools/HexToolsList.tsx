import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { PRIMARIES, ADD_SATELLITE_ID } from "./HexToolsTree";
import { useHiddenHexes } from "@/lib/hex-overrides";

/**
 * Responsive fallback for the HexToolsTree used on viewports too narrow
 * to render the full honeycomb without clipping. Each primary becomes a
 * row: the parent hex on the left, its satellites flowing to the right,
 * wrapping naturally. Same click semantics as the tree.
 */
interface HexToolsListProps {
  focusedId?: string | null;
  focusedSatelliteId?: string | null;
  onFocus?: (primaryId: string) => void;
  focusablePrimaryIds?: ReadonlySet<string>;
  onSatelliteFocus?: (primaryId: string, satelliteId: string) => boolean;
  onAddCustomHex?: (primaryId: string) => void;
  className?: string;
}

const HEX_CLIP = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

export function HexToolsList({
  focusedId = null,
  focusedSatelliteId = null,
  onFocus,
  focusablePrimaryIds,
  onSatelliteFocus,
  onAddCustomHex,
  className = "",
}: HexToolsListProps) {
  const navigate = useNavigate();
  const hidden = useHiddenHexes();
  const go = useCallback((to: string) => navigate({ to }), [navigate]);

  const visiblePrimaries = PRIMARIES.filter((p) => !hidden.has(p.id));

  return (
    <div className={`htl-root flex flex-col gap-4 px-2 py-2 ${className}`}>
      {visiblePrimaries.map((p) => {
        const isActive = focusedId === p.id;
        const sats = p.satellites.filter((s) => !hidden.has(s.id));
        return (
          <div
            key={p.id}
            className="htl-row flex items-start gap-3"
            style={{ ["--hex-hue" as string]: String(p.hue) }}
          >
            <button
              type="button"
              onClick={() => {
                if (focusablePrimaryIds?.has(p.id) && onFocus) onFocus(p.id);
                else go(p.to);
              }}
              aria-label={p.name}
              className={`htl-hex htl-primary ${isActive ? "is-active" : ""}`}
            >
              <span className="htl-face" />
              <span className="htl-body">
                <span className="htl-icon">{p.icon}</span>
                <span className="htl-name">{p.name}</span>
                <span className="htl-tier">{p.tier}</span>
              </span>
            </button>

            <div className="htl-sats flex flex-wrap gap-2 pt-1">
              {sats.map((s) => {
                const isAdd = s.id === ADD_SATELLITE_ID;
                const isActiveSat = isActive && focusedSatelliteId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (isAdd) {
                        onAddCustomHex?.(p.id);
                        return;
                      }
                      const handled = onSatelliteFocus?.(p.id, s.id) ?? false;
                      if (!handled) go(s.to);
                    }}
                    aria-label={s.label}
                    className={`htl-hex htl-sat ${isActiveSat ? "is-active" : ""} ${isAdd ? "is-add" : ""}`}
                  >
                    <span className="htl-face" />
                    <span className="htl-body">
                      <span className="htl-icon">{s.icon}</span>
                      <span className="htl-sat-label">{s.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <style>{`
        .htl-hex {
          position: relative;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          color: oklch(0.97 0.005 240);
          outline: none;
          flex-shrink: 0;
        }
        .htl-hex .htl-face {
          position: absolute;
          inset: 0;
          clip-path: ${HEX_CLIP};
          background:
            linear-gradient(160deg,
              oklch(0.34 0.13 var(--hex-hue, 290) / 0.97) 0%,
              oklch(0.20 0.09 var(--hex-hue, 320) / 0.97) 55%,
              oklch(0.10 0.03 270 / 1) 100%);
          box-shadow:
            inset 0 0 24px oklch(0.72 0.2 var(--hex-hue, 275) / 0.20),
            inset 0 1px 0 oklch(1 0 0 / 0.10),
            inset 0 -1px 0 oklch(0 0 0 / 0.45),
            0 10px 24px -10px oklch(0.06 0.02 270 / 0.9);
          transition: box-shadow 0.25s ease, transform 0.25s ease;
        }
        .htl-hex .htl-body {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 8px 6px;
          width: 100%;
          height: 100%;
        }
        .htl-hex:hover .htl-face {
          box-shadow:
            inset 0 0 36px oklch(0.82 0.18 var(--hex-hue, 88) / 0.32),
            inset 0 1px 0 oklch(1 0 0 / 0.18),
            inset 0 -1px 0 oklch(0 0 0 / 0.5),
            0 14px 32px -10px oklch(0.06 0.02 270 / 0.95),
            0 0 28px -4px oklch(0.82 0.18 var(--hex-hue, 88) / 0.5);
        }
        .htl-hex.is-active .htl-face {
          box-shadow:
            inset 0 0 40px oklch(0.82 0.18 var(--hex-hue, 88) / 0.4),
            inset 0 1px 0 oklch(1 0 0 / 0.22),
            inset 0 -1px 0 oklch(0 0 0 / 0.5),
            0 14px 36px -8px oklch(0.06 0.02 270 / 0.95),
            0 0 36px -4px oklch(0.82 0.18 var(--hex-hue, 88) / 0.6);
        }
        .htl-hex.is-active .htl-name,
        .htl-hex.is-active .htl-sat-label { color: oklch(0.98 0.05 var(--hex-hue, 88)); }
        .htl-hex.is-active .htl-icon { color: oklch(0.93 0.12 var(--hex-hue, 88)); }

        /* Primary hex — squarish, big */
        .htl-primary {
          width: 112px;
          height: 128px;
        }
        .htl-primary .htl-icon {
          color: oklch(0.92 0.08 var(--hex-hue, 88));
          display: inline-flex;
        }
        .htl-primary .htl-name {
          font-family: var(--font-display, inherit);
          font-size: 12px;
          line-height: 1.15;
          font-weight: 600;
          text-align: center;
          max-width: 92px;
        }
        .htl-primary .htl-tier {
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          opacity: 0.65;
        }

        /* Satellite hex — smaller, label below icon */
        .htl-sat {
          width: 84px;
          height: 96px;
        }
        .htl-sat .htl-icon {
          color: oklch(0.92 0.08 var(--hex-hue, 88));
          display: inline-flex;
        }
        .htl-sat .htl-sat-label {
          font-size: 10px;
          line-height: 1.1;
          font-weight: 500;
          text-align: center;
          max-width: 72px;
          opacity: 0.92;
        }
        .htl-sat.is-add .htl-face {
          background:
            linear-gradient(160deg,
              oklch(0.22 0.02 270 / 0.85) 0%,
              oklch(0.14 0.02 270 / 0.95) 100%);
        }
        .htl-sat.is-add .htl-sat-label { opacity: 0.6; }
      `}</style>
    </div>
  );
}
