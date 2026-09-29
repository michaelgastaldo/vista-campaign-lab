import { cn } from "@/lib/utils";

/**
 * Lightweight shimmer block used as a per-tab loading placeholder so new
 * routes feel instant while data is still fetching.
 */
export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-glass/40 border border-glass-border",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r",
        "before:from-transparent before:via-white/5 before:to-transparent",
        "before:animate-[shimmer_1.4s_infinite]",
        className,
      )}
    />
  );
}

export function TabHeaderSkeleton({
  module,
  accent = "primary",
}: {
  module?: string;
  accent?: "primary" | "secondary";
}) {
  return (
    <div className="flex items-center gap-3">
      <Shimmer
        className={cn(
          "size-11 rounded-xl",
          accent === "secondary" ? "bg-secondary/15" : "bg-primary/10",
        )}
      />
      <div className="space-y-2">
        {module && (
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{module}</div>
        )}
        <Shimmer className="h-7 w-56" />
      </div>
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-glass-border bg-glass/30 p-5">
          <div className="flex items-center justify-between">
            <Shimmer className="h-3 w-16 border-0 bg-glass/60" />
            <Shimmer className="size-4 border-0 bg-glass/60" />
          </div>
          <Shimmer className="h-9 w-20 border-0 bg-glass/60" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("space-y-3 rounded-xl border border-glass-border bg-glass/30 p-6", className)}>
      <Shimmer className="h-3 w-24 border-0 bg-glass/60" />
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          className="h-4 border-0 bg-glass/60"
          // last line is shorter for natural rhythm
        />
      ))}
    </div>
  );
}

export function FieldGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-glass-border bg-glass/30 p-5">
          <Shimmer className="h-3 w-20 border-0 bg-glass/60" />
          <Shimmer className="h-10 w-full border-0 bg-glass/60" />
        </div>
      ))}
    </div>
  );
}
