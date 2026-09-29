import { motion, useReducedMotion } from "framer-motion";

interface AuroraFieldProps {
  /** OKLCH hue 0..360 for the dominant band. */
  hue?: number;
  /** Optional secondary hue for cross-fade. */
  hue2?: number;
  className?: string;
  /** Opacity scaler. */
  intensity?: number;
}

/**
 * Drifting aurora background — three soft hue-tinted blobs that breathe
 * slowly across the surface. Decorative; pointer-events: none.
 */
export function AuroraField({
  hue = 275,
  hue2 = 340,
  className = "",
  intensity = 1,
}: AuroraFieldProps) {
  const reduced = useReducedMotion();
  const base = `pointer-events-none absolute inset-0 overflow-hidden ${className}`;
  const a = 0.28 * intensity;
  const b = 0.22 * intensity;
  const c = 0.18 * intensity;

  return (
    <div aria-hidden className={base}>
      <motion.div
        className="absolute -left-[15%] top-[-25%] h-[70vh] w-[55vw] rounded-[50%] blur-[110px]"
        style={{ background: `radial-gradient(closest-side, oklch(0.72 0.22 ${hue} / ${a}), transparent 70%)` }}
        animate={reduced ? undefined : { x: [0, 60, -20, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-10%] top-[-10%] h-[60vh] w-[45vw] rounded-[50%] blur-[120px]"
        style={{ background: `radial-gradient(closest-side, oklch(0.74 0.2 ${hue2} / ${b}), transparent 70%)` }}
        animate={reduced ? undefined : { x: [0, -40, 30, 0], y: [0, 50, -20, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-30%] left-[20%] h-[60vh] w-[60vw] rounded-[50%] blur-[140px]"
        style={{ background: `radial-gradient(closest-side, oklch(0.78 0.18 ${(hue + hue2) / 2} / ${c}), transparent 70%)` }}
        animate={reduced ? undefined : { x: [0, 30, -50, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
