import { useEffect, useState } from "react";
import { readPrefLocal, hydratePrefs } from "@/lib/preferences";
import { useAuth } from "@/contexts/AuthContext";
import { IconClock } from "@/components/ui-custom/CustomIcon";

/**
 * Renders a small pill row showing the most recent value(s) for a set of pref
 * keys. Click a pill to one-click reuse all "last" values. Quietly hides when
 * the user has no history.
 */
export function ReuseLastPill({
  prefKeys,
  onReuse,
  label = "Use last values",
}: {
  prefKeys: string[];
  onReuse: (values: Record<string, string>) => void;
  label?: string;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    (async () => {
      await hydratePrefs(userId, prefKeys);
      const next: Record<string, string> = {};
      for (const k of prefKeys) {
        const v = readPrefLocal(k)[0];
        if (v) next[k] = v;
      }
      setVals(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const entries = Object.entries(vals);
  if (entries.length === 0) return null;

  return (
    <button
      onClick={() => onReuse(vals)}
      className="group inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-glass-strong hover:text-foreground"
    >
      <IconClock size={12} />
      <span>{label}</span>
      <span className="hidden md:inline font-mono text-[10px] text-muted-foreground/70">
        {entries
          .slice(0, 3)
          .map(([, v]) => v)
          .join(" · ")}
      </span>
    </button>
  );
}
