import { createFileRoute, Navigate } from "@tanstack/react-router";

/**
 * Catch-all for unknown /tools/<slug> URLs. Maps legacy/renamed tool slugs
 * onto current routes (or focused-tool deep links on the hub) so external
 * bookmarks and shared links keep resolving after IA cleanup.
 *
 * Unknown slugs fall back to the tools hub.
 */
const TOOL_REDIRECTS: Record<string, { to: string; search?: Record<string, string> }> = {
  // Renamed / merged tools (future-proofed; current files still exist too)
  // Old slugs → renamed routes (preserves shared/bookmarked links)
  "hackathon-request": { to: "/tools/event-intake" },
  "hackathon": { to: "/tools/event-intake" },
  "naming": { to: "/tools/taxonomy" },
  "automations": { to: "/connectors" },
};

export const Route = createFileRoute("/_app/tools/$")({
  component: ToolsCatchAll,
});

function ToolsCatchAll() {
  const { _splat } = Route.useParams();
  const slug = (_splat ?? "").split("/")[0];
  const hit = TOOL_REDIRECTS[slug];
  const target = hit ?? { to: "/tools" };
  const props = {
    to: target.to,
    search: target.search ?? {},
    replace: true,
  } as unknown as Parameters<typeof Navigate>[0];
  return <Navigate {...props} />;
}
