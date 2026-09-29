import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { instantiateTemplate } from "@/lib/templates.functions";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconSpark, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";

const QUICK_PICKS = [
  { slug: "product-launch", label: "Product launch", hint: "4-week launch with checklist & budget" },
  { slug: "webinar", label: "Webinar", hint: "Promo → live → replay" },
  { slug: "newsletter", label: "Newsletter", hint: "Recurring single send" },
];

/**
 * Shared empty-state CTA. Drop into dashboard/campaigns/workspaces/funnel
 * empty states so a fresh remix never feels dead.
 */
export function LoadSampleCTA({
  headline = "Nothing here yet",
  body = "Load a sample campaign to see the workspace, checklist, budget, and KPIs wired up.",
  compact = false,
}: {
  headline?: string;
  body?: string;
  compact?: boolean;
}) {
  const instantiate = useServerFn(instantiateTemplate);
  const nav = useNavigate();
  const [creating, setCreating] = useState<string | null>(null);

  const loadSample = async (slug: string) => {
    setCreating(slug);
    try {
      const res = await instantiate({ data: { slug } });
      toast.success(
        (res as { reused?: boolean }).reused
          ? "Opened your existing sample"
          : "Sample campaign loaded",
      );
      nav({ to: "/campaigns/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load sample");
      setCreating(null);
    }
  };

  return (
    <GlassPanel className={compact ? "p-5" : "p-6 md:p-8"}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <IconSpark size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg">{headline}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {QUICK_PICKS.map((p) => (
          <button
            key={p.slug}
            onClick={() => loadSample(p.slug)}
            disabled={creating !== null}
            className="group rounded-xl border border-glass-border bg-glass/30 p-3 text-left transition hover:border-primary/40 hover:bg-glass-strong disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{p.label}</div>
              <IconArrowRight size={14} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {creating === p.slug ? "Loading…" : p.hint}
            </div>
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}
