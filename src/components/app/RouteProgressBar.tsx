import { useRouterState } from "@tanstack/react-router";

/**
 * Thin gradient top-progress bar that appears whenever the router is
 * transitioning between routes.
 */
export function RouteProgressBar() {
  const isLoading = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-primary via-accent to-primary transition-opacity duration-200 ${
        isLoading ? "opacity-100 animate-[routeprog_1.2s_ease-out_infinite]" : "opacity-0"
      }`}
    >
      <style>{`
        @keyframes routeprog {
          0%   { transform: scaleX(0.05); }
          60%  { transform: scaleX(0.85); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
