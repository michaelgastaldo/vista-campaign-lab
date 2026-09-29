import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias for the old "Workspaces" name. Keeps bookmarks/emails working.
export const Route = createFileRoute("/_app/workspaces/")({
  beforeLoad: () => {
    throw redirect({ to: "/campaigns" });
  },
});
