import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { BRAND } from "@/lib/brand";

/**
 * Catch-all redirect for legacy Marketing Command Center URLs.
 * Consolidates ~12 single-file redirect stubs into one map so the route
 * tree stays small while bookmarks and external docs keep working.
 *
 * Unknown paths render a soft 404 with a link back home.
 */
const LEGACY_REDIRECTS: Record<string, { to: string; search?: Record<string, string> }> = {
  "campaign-in-a-box": { to: "/tools", search: { focus: "campaign" } },
  "campaign-performance": { to: "/tools", search: { focus: "campaign-performance" } },
  "funnel-dashboard": { to: "/tools", search: { focus: "funnel" } },
  "hackathon-request": { to: "/tools/event-intake" },
  "hubspot-campaign": { to: "/tools", search: { focus: "campaign-creator" } },
  "list-cleaner": { to: "/tools", search: { focus: "campaign-list-cleaner" } },
  "list-import": { to: "/tools", search: { focus: "campaign-import" } },
  "utm-builder": { to: "/tools", search: { focus: "utm" } },
  "migrate": { to: "/dashboard" },
};

export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [
      { title: `Page not found — ${BRAND.name}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CatchAll,
});

function CatchAll() {
  const { _splat } = Route.useParams();
  const slug = (_splat ?? "").split("/")[0];
  const hit = LEGACY_REDIRECTS[slug];

  if (hit) {
    const props = { to: hit.to, search: hit.search ?? {}, replace: true } as unknown as Parameters<typeof Navigate>[0];
    return <Navigate {...props} />;
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[color:var(--color-ink)] text-foreground">
      <GradientMesh />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 py-16">
        <GlassPanel className="w-full p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">404</p>
          <h1 className="mt-3 font-display text-3xl tracking-tight">Page not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We couldn't find <span className="font-mono text-foreground/80">/{_splat}</span>.
            It may have moved or been retired.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/dashboard"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Back to dashboard
            </Link>
            <Link
              to="/tools"
              className="rounded-lg border border-glass-border bg-glass/40 px-4 py-2 text-sm transition hover:bg-glass/70"
            >
              Browse tools
            </Link>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
