import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconCheck, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";


const KEY = "onboarding-checklist";
const checklistCache: {
  userId: string | null;
  values: string[] | null;
  promise: Promise<string[]> | null;
} = { userId: null, values: null, promise: null };

type TaskId =
  | "create_workspace"
  | "save_campaign_name"
  | "import_list"
  | "mint_utm";

const TASKS: { id: TaskId; label: string; to: string; focus?: string; hint: string }[] = [
  { id: "create_workspace", label: "Create your first campaign", to: "/campaigns", hint: "30 sec — name, goal, channel" },
  { id: "save_campaign_name", label: "Generate a campaign name", to: "/tools", focus: "utm-campaign-name", hint: "AI codenames + tracking tag" },
  { id: "mint_utm", label: "Mint a UTM link", to: "/tools", focus: "utm", hint: "Copy-ready URL with QR code" },
  { id: "import_list", label: "Import a contact list", to: "/tools", focus: "campaign-import", hint: "CSV → ready to push to ESP" },
];

export function OnboardingChecklist({ variant = "auto" }: { variant?: "auto" | "pill" | "full" } = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [done, setDone] = useState<Set<TaskId> | null>(() => {
    if (!userId || checklistCache.userId !== userId || !checklistCache.values) return null;
    return new Set(checklistCache.values.filter((v): v is TaskId => v !== "__dismissed") as TaskId[]);
  });
  const [dismissed, setDismissed] = useState(() =>
    !!userId && checklistCache.userId === userId && checklistCache.values?.includes("__dismissed") === true,
  );
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      // Fragile: this component is intentionally allowed in the header and
      // dashboard. Share the first preference request so duplicate mounts do
      // not create duplicate post-navigation state changes.
      if (checklistCache.userId !== userId) {
        checklistCache.userId = userId;
        checklistCache.values = null;
        checklistCache.promise = null;
      }
      const vals = checklistCache.values ?? await (checklistCache.promise ??= Promise.resolve(supabase
          .from("user_preferences")
          .select("values")
          .eq("user_id", userId)
          .eq("key", KEY)
          .maybeSingle()
          .then(({ data }) => (data?.values as string[] | undefined) ?? [])));
      checklistCache.values = vals;
      checklistCache.promise = null;
      if (cancelled) return;
      if (vals.includes("__dismissed")) {
        setDismissed(true);
        setDone(new Set());
      } else {
        setDone(new Set(vals as TaskId[]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Auto-detect completion by checking real data. Only count rows the user
  // actually created (created_by/owner = user) so the trigger-seeded welcome
  // workspace + example audience don't mark tasks done before they touch them.
  useEffect(() => {
    if (!userId || !done) return;
    let cancelled = false;
    (async () => {
      const completed = new Set(done);
      const checks = await Promise.all([
        supabase
          .from("workspaces")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId)
          .eq("is_sample", false),
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("created_by", userId),
        supabase
          .from("utm_links")
          .select("id", { count: "exact", head: true })
          .eq("created_by", userId),
        supabase
          .from("imported_lists")
          .select("id", { count: "exact", head: true })
          .eq("created_by", userId),
      ]);
      // Skip the trigger-seeded "Welcome campaign" by requiring at least 2
      // user-owned non-sample workspaces (welcome + the one they made).
      if ((checks[0].count ?? 0) >= 2) completed.add("create_workspace");
      if ((checks[1].count ?? 0) > 0) completed.add("save_campaign_name");
      if ((checks[2].count ?? 0) > 0) completed.add("mint_utm");
      if ((checks[3].count ?? 0) > 0) completed.add("import_list");

      if (cancelled) return;
      if (completed.size !== done.size) {
        setDone(completed);
        checklistCache.values = Array.from(completed);
        await supabase.from("user_preferences").upsert({
          user_id: userId,
          key: KEY,
          values: Array.from(completed),
          updated_at: new Date().toISOString(),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, done]);

  const dismiss = useCallback(async () => {
    if (!userId) return;
    setDismissed(true);
    checklistCache.userId = userId;
    checklistCache.values = ["__dismissed"];
    checklistCache.promise = null;
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      key: KEY,
      values: ["__dismissed"],
      updated_at: new Date().toISOString(),
    });
  }, [userId]);

  const celebratedRef = useRef(false);
  const total = TASKS.length;
  const count = done ? TASKS.filter((t) => done.has(t.id)).length : 0;

  useEffect(() => {
    if (!done || count !== total || celebratedRef.current) return;
    if (typeof window === "undefined") return;
    celebratedRef.current = true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      toast.success("Setup complete — nicely done.", { description: "All five starter steps are checked off." });
      return;
    }
    toast.success("Setup complete — nicely done.", { description: "All five starter steps are checked off." });
    const layer = document.createElement("div");
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
    document.body.appendChild(layer);
    const glyphs = ["•"];
    const hues = [275, 305, 340, 195, 75];
    for (let i = 0; i < 22; i++) {
      const p = document.createElement("span");
      const hue = hues[i % hues.length];
      p.textContent = glyphs[i % glyphs.length];
      const startX = 30 + Math.random() * 40;
      p.style.cssText = `position:absolute;left:${startX}vw;top:42vh;font-size:${14 + Math.random() * 14}px;color:oklch(0.82 0.18 ${hue});text-shadow:0 0 10px oklch(0.78 0.2 ${hue}/0.7);will-change:transform,opacity;`;
      layer.appendChild(p);
      const dx = (Math.random() - 0.5) * 520;
      const dy = -(180 + Math.random() * 260);
      const rot = (Math.random() - 0.5) * 360;
      p.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy * 0.4}px) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx * 1.2}px, ${Math.abs(dy)}px) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: 1500 + Math.random() * 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
      );
    }
    const t = window.setTimeout(() => layer.remove(), 1900);
    return () => { window.clearTimeout(t); layer.remove(); };
  }, [done, count, total]);

  if (!done || dismissed) return null;
  if (count === total) return null;

  const pct = Math.round((count / total) * 100);
  const halfDone = count / total >= 0.5;

  // "auto": render full when <50%, render nothing when >=50% (header pill handles it)
  if (variant === "auto" && halfDone) return null;

  // "pill" variant: always show the compact pill
  if (variant === "pill") {
    if (expanded) {
      // fall through to full render
    } else {
      return (
        <button
          onClick={() => setExpanded(true)}
          title={`Setup checklist — ${count} of ${total} done. Click to expand.`}
          aria-label={`Onboarding checklist: ${count} of ${total} steps complete. Click to expand.`}
          data-tour="setup-pill"
          className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-glass hover:text-foreground"
        >
          <span className="relative inline-block size-2">
            <span className="absolute inset-0 rounded-full bg-primary/40" />
            <span
              className="absolute inset-0 rounded-full bg-primary"
              style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
            />
          </span>
          Setup {count}/{total}
          <IconArrowRight size={11} />
        </button>

      );
    }
  }




  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <GlassPanel tier="strong" glow className="readable-glass-surface p-6" data-tour="onboarding-checklist">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Get started</div>
              <h2 className="mt-1 font-display text-xl">
                {count}/{total} steps · {pct}% there
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("lovable:start-tour"))}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Replay tour
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Hide
              </button>
            </div>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-glass-border">
            <motion.div
              className="h-full progress-spectrum-fill"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <div className="mt-5 grid gap-2">
            {TASKS.map((t) => {
              const isDone = done.has(t.id);
              return (
                <Link
                  key={t.id}
                  to={t.to}
                  search={t.focus ? { focus: t.focus } : undefined}
                  className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                    isDone
                      ? "border-glass-border bg-glass/20 text-muted-foreground"
                      : "border-glass-border bg-glass/40 text-foreground hover:bg-glass-strong"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${
                        isDone
                          ? "border-primary/50 bg-primary/20 text-primary"
                          : "border-glass-border text-muted-foreground"
                      }`}
                    >
                      {isDone ? <IconCheck size={12} /> : null}
                    </span>
                    <span className={isDone ? "line-through" : ""}>
                      <span className="font-medium">{t.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{t.hint}</span>
                    </span>
                  </span>
                  {!isDone && (
                    <IconArrowRight
                      size={14}
                      className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </GlassPanel>
      </motion.div>
    </AnimatePresence>
  );
}
