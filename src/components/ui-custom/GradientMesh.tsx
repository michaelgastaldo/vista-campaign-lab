/**
 * Live gradient mesh background — drifts and pulses behind every surface.
 * No imagery, no AI badges. Pure CSS animation.
 */
export function GradientMesh({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[color:var(--color-ink)]" />
      <div className="mesh-bg" />
      <div className="grain" />
    </div>
  );
}
