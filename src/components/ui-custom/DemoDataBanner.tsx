import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconWarning, IconClose, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { cn } from "@/lib/utils";

interface DemoDataBannerProps {
  /** Storage key — when set, dismissal persists across reloads for this banner instance. */
  storageKey?: string;
  /** Short variant renders as an inline chip (no border block). */
  variant?: "banner" | "chip";
  /** Override copy if needed. */
  label?: string;
  /** Override CTA label (banner variant only). */
  ctaLabel?: string;
  /** Override CTA target (banner variant only). Can be an internal route or "#" to hide. */
  ctaHref?: string;
  /** Optional click handler for the CTA (banner variant). When provided, renders a button instead of a link. */
  onCtaClick?: () => void;
  className?: string;
}

const DEFAULT_LABEL = "Demo data — connect your CRM to see real campaigns";

/**
 * Surfaces that data on screen comes from a mocked/demo fallback. Dismissible;
 * by default links to /integrations with "Connect CRM" — override via
 * ctaLabel / ctaHref / onCtaClick for non-CRM demo contexts (e.g. Gmail).
 */
export function DemoDataBanner({
  storageKey,
  variant = "banner",
  label = DEFAULT_LABEL,
  ctaLabel = "Connect CRM",
  ctaHref = "/integrations",
  onCtaClick,
  className,
}: DemoDataBannerProps) {
  const fullKey = storageKey ? `demo-banner-dismissed:${storageKey}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined" || !fullKey) return false;
    return window.localStorage.getItem(fullKey) === "1";
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    if (fullKey && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(fullKey, "1");
      } catch {
        /* ignore */
      }
    }
  };

  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300",
          className,
        )}
        title={label}
      >
        <IconWarning size={10} />
        Demo data
      </span>
    );
  }

  const ctaClass =
    "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-medium text-amber-200 transition hover:bg-amber-400/20";
  const showCta = ctaHref !== "#" || !!onCtaClick;

  return (
    <div
      className={cn(
        "glass flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-2.5 text-xs",
        className,
      )}
      role="status"
    >
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
        <IconWarning size={12} />
      </span>
      <span className="min-w-0 flex-1 text-amber-100/90">{label}</span>
      {showCta && (
        onCtaClick ? (
          <button type="button" onClick={onCtaClick} className={ctaClass}>
            {ctaLabel}
            <IconArrowRight size={11} />
          </button>
        ) : (
          <Link to={ctaHref as never} className={ctaClass}>
            {ctaLabel}
            <IconArrowRight size={11} />
          </Link>
        )
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-amber-200/70 transition hover:bg-amber-400/15 hover:text-amber-100"
      >
        <IconClose size={12} />
      </button>
    </div>
  );
}
