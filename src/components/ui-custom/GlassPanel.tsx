import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  tier?: "soft" | "strong" | "inner";
  glow?: boolean;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, tier = "soft", glow, children, ...rest }, ref) => {
    const tierCls = tier === "strong" ? "glass-strong" : tier === "inner" ? "glass-inner" : "glass";
    return (
      <div
        ref={ref}
        className={cn(tierCls, "rounded-2xl", glow && "ring-glow", className)}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
GlassPanel.displayName = "GlassPanel";
