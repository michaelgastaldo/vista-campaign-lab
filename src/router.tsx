import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

let clientRouter: ReturnType<typeof createAppRouter> | undefined;

function createAppRouter() {
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload visible route links as soon as they render. The app shell uses a
    // fixed nav, so waiting for click/hover made first visits load chunks after
    // navigation and read as a page flash.
    defaultPreload: "render",
    defaultPreloadStaleTime: 0,
    // Keep the previous route visible while the next route chunk/data settles,
    // instead of swapping to a transient blank/skeleton state after click.
    defaultPendingMs: 1500,
    defaultPendingMinMs: 0,
  });
}

export const getRouter = () => {
  // Fragile: the client router owns the QueryClient provider. In dev/HMR a
  // second client getRouter() call must not replace that provider instance or
  // every page consumer repaints like a navigation flash. Keep SSR per-request.
  if (typeof window !== "undefined" && clientRouter) return clientRouter;

  const router = createAppRouter();
  if (typeof window !== "undefined") clientRouter = router;

  return router;
};
