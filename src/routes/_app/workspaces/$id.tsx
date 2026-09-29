import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias: /workspaces/:id → /campaigns/:id.
export const Route = createFileRoute("/_app/workspaces/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/campaigns/$id", params: { id: params.id } });
  },
});
