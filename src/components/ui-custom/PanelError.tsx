import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconWarning } from "@/components/ui-custom/CustomIcon";
import { cn } from "@/lib/utils";

interface PanelErrorProps {
  /** Short panel-friendly message. Defaults to "Couldn't load". */
  message?: string;
  onRetry?: () => void;
  className?: string;
  /** Render without the GlassPanel wrapper — useful when nested inside one. */
  bare?: boolean;
}

/**
 * Inline error state for background-fetched panels. Replaces empty/skeleton
 * UI when a query fails, so users see what's wrong and can retry.
 */
export function PanelError({
  message = "Couldn't load",
  onRetry,
  className,
  bare,
}: PanelErrorProps) {
  const body = (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[oklch(0.78_0.18_25)]/15 text-[oklch(0.78_0.18_25)]">
          <IconWarning size={12} />
        </span>
        <span className="truncate">{message}</span>
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-glass-border bg-glass/40 px-3 py-1 text-xs font-medium text-foreground/85 transition hover:bg-glass-strong"
        >
          Retry
        </button>
      )}
    </div>
  );

  if (bare) return <div className={className}>{body}</div>;
  return <GlassPanel className={cn("p-4", className)}>{body}</GlassPanel>;
}
