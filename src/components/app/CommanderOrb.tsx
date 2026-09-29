import { motion } from "framer-motion";

export function CommanderOrb({ size = 28, active = false }: { size?: number; active?: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 2.2, repeat: active ? Infinity : 0, ease: "easeInOut" }}
    >
      {/* Soft outer halo */}
      <span
        className="absolute inset-0 rounded-full blur-md opacity-70"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.85 0.18 295 / 0.85), oklch(0.7 0.22 250 / 0.55) 55%, transparent 75%)",
        }}
      />
      {/* Core gradient */}
      <span
        className="relative h-full w-full rounded-full ring-1 ring-white/30"
        style={{
          background:
            "conic-gradient(from 140deg at 50% 50%, oklch(0.9 0.18 300), oklch(0.8 0.22 260), oklch(0.85 0.2 200), oklch(0.92 0.15 320), oklch(0.9 0.18 300))",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.25), inset 0 -4px 8px rgba(0,0,0,0.25), 0 0 18px oklch(0.78 0.2 280 / 0.45)",
        }}
      />
      {/* Inner highlight */}
      <span
        className="absolute rounded-full opacity-80"
        style={{
          top: "12%",
          left: "18%",
          width: "32%",
          height: "26%",
          background: "radial-gradient(circle, rgba(255,255,255,0.9), transparent 70%)",
          filter: "blur(0.5px)",
        }}
      />
    </motion.span>
  );
}
