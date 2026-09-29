import { GlassPanel } from "./GlassPanel";

/**
 * Shimmering glass skeleton rows used for in-page loading states.
 * Keeps the page weight stable instead of flashing a plain "Loading…" string.
 */
export function GlassSkeleton({
  rows = 4,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <GlassPanel className={`p-5 ${className}`}>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-xl bg-gradient-to-r from-glass/30 via-glass/60 to-glass/30"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </GlassPanel>
  );
}
