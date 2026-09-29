import { type ReactNode } from "react";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { FadeInUp, WordStagger } from "@/components/motion/WordStagger";

interface ToolHeaderProps {
  eyebrow: string;
  title: string;
  /** Optional italic-serif accent word appended to the title. */
  accent?: string;
  description?: ReactNode;
  hue?: number;
  icon?: ReactNode;
  ariaLabel?: string;
  /** Right-aligned actions (filters, buttons, pills). */
  actions?: ReactNode;
}

/**
 * Editorial header shared across every tool. Eyebrow + display-scale title
 * with an optional serif italic accent, hex badge, optional supporting copy,
 * and a hairline spectrum divider underneath. Cinematic entrance via word
 * stagger + fade-up; honors reduced motion through the underlying primitives.
 */
export function ToolHeader({
  eyebrow,
  title,
  accent,
  description,
  hue = 275,
  icon,
  ariaLabel,
  actions,
}: ToolHeaderProps) {
  return (
    <header className="relative">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 items-start gap-4">
          {icon && (
            <FadeInUp delay={0.02} className="shrink-0">
              <PageHexBadge hue={hue} icon={icon} aria-label={ariaLabel ?? title} size={28} />
            </FadeInUp>
          )}
          <div className="min-w-0">
            <FadeInUp delay={0.04}>
              <div className="text-eyebrow flex items-center gap-2">
                <span className="feature-dot" />
                {eyebrow}
              </div>
            </FadeInUp>
            <h1 className="mt-2 font-display text-3xl leading-[1.05] tracking-tight md:text-[2.6rem]">
              <WordStagger text={title} delay={0.12} />
              {accent && (
                <>
                  {" "}
                  <span className="text-serif-accent">{accent}</span>
                </>
              )}
            </h1>
            {description && (
              <FadeInUp delay={0.32}>
                <p className="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </FadeInUp>
            )}
          </div>
        </div>
        {actions && (
          <FadeInUp delay={0.2} className="flex shrink-0 items-center gap-2">
            {actions}
          </FadeInUp>
        )}
      </div>
      <hr className="spectrum-divider mt-6" />
    </header>
  );
}
