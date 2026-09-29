import { useAutosaveSummary } from "@/lib/autosave-store";
import { IconCheck, IconSpark, IconClock } from "@/components/ui-custom/CustomIcon";
import { AnimatePresence, motion } from "framer-motion";

export function AutosaveStatus({ className = "" }: { className?: string }) {
  const { status, message } = useAutosaveSummary();

  if (status === "idle") return null;

  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved"
        : status === "local"
          ? "Saved locally"
          : message || "Save failed";

  const Icon = status === "saved" ? IconCheck : status === "saving" ? IconSpark : IconClock;

  const tone =
    status === "error"
      ? "text-destructive border-destructive/40 bg-destructive/10"
      : status === "saved"
        ? "text-primary border-primary/30 bg-primary/10"
        : "text-muted-foreground border-glass-border bg-glass/60";

  return (
    <AnimatePresence>
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.16 }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md ${tone} ${className}`}
        role="status"
        aria-live="polite"
      >
        <Icon
          size={12}
          className={status === "saving" ? "animate-spin [animation-duration:1.4s]" : ""}
        />
        <span>{label}</span>
      </motion.div>
    </AnimatePresence>
  );
}
