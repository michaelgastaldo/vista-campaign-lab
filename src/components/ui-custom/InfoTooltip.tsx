import { type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function InfoTooltip({ children, side = "top" }: { children: ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            className="inline-flex size-4 items-center justify-center rounded-full border border-glass-border bg-glass/40 text-[9px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            aria-label="More info"
          >
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[260px] text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
