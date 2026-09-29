import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TOUR_STEPS, TOUR_PREF_KEY, type TourStep } from "./tour-steps";

const TOOLTIP_W = 340;
const TOOLTIP_GAP = 20;
const SPOTLIGHT_PAD = 12;
const CONTEXT_PAD = 6;

type Phase = "idle" | "loading" | "active" | "done";
type Rect = { x: number; y: number; w: number; h: number };

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function getElementRect(selector: string): Rect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function waitForElement(selector: string, timeout = 2000): Promise<Rect | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const rect = getElementRect(selector);
      if (rect) return resolve(rect);
      if (performance.now() - start > timeout) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function computeTooltipPos(
  rect: Rect | null,
  placement: TourStep["placement"],
  vw: number,
  vh: number,
): { left: number; top: number; arrow: "up" | "down" | "left" | "right" | "none" } {
  if (!rect || placement === "center") {
    return { left: vw / 2 - TOOLTIP_W / 2, top: vh / 2 - 110, arrow: "none" };
  }
  const candidates: Array<{
    pos: { left: number; top: number };
    arrow: "up" | "down" | "left" | "right";
    fits: boolean;
    score: number;
  }> = [];

  // below
  {
    const left = Math.max(16, Math.min(vw - TOOLTIP_W - 16, rect.x + rect.w / 2 - TOOLTIP_W / 2));
    const top = rect.y + rect.h + TOOLTIP_GAP;
    candidates.push({
      pos: { left, top },
      arrow: "up",
      fits: top + 200 < vh,
      score: placement === "bottom" ? 100 : 50,
    });
  }
  // above
  {
    const left = Math.max(16, Math.min(vw - TOOLTIP_W - 16, rect.x + rect.w / 2 - TOOLTIP_W / 2));
    const top = rect.y - 200 - TOOLTIP_GAP;
    candidates.push({
      pos: { left, top },
      arrow: "down",
      fits: top > 16,
      score: placement === "top" ? 100 : 50,
    });
  }
  // right
  {
    const left = rect.x + rect.w + TOOLTIP_GAP;
    const top = Math.max(16, rect.y + rect.h / 2 - 90);
    candidates.push({
      pos: { left, top },
      arrow: "left",
      fits: left + TOOLTIP_W < vw - 16,
      score: placement === "right" ? 100 : 30,
    });
  }
  // left
  {
    const left = rect.x - TOOLTIP_W - TOOLTIP_GAP;
    const top = Math.max(16, rect.y + rect.h / 2 - 90);
    candidates.push({
      pos: { left, top },
      arrow: "right",
      fits: left > 16,
      score: placement === "left" ? 100 : 30,
    });
  }

  const ranked = candidates
    .map((c) => ({ ...c, finalScore: c.fits ? c.score : c.score - 1000 }))
    .sort((a, b) => b.finalScore - a.finalScore);
  const winner = ranked[0];
  return { left: winner.pos.left, top: winner.pos.top, arrow: winner.arrow };
}

async function loadTourState(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_preferences")
    .select("values")
    .eq("user_id", userId)
    .eq("key", TOUR_PREF_KEY)
    .maybeSingle();
  return ((data?.values as string[] | undefined) ?? []);
}

async function saveTourState(userId: string, values: string[]) {
  await supabase.from("user_preferences").upsert({
    user_id: userId,
    key: TOUR_PREF_KEY,
    values,
    updated_at: new Date().toISOString(),
  });
}

export function GuidedTour() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [contextRect, setContextRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window === "undefined"
      ? { vw: 1280, vh: 800 }
      : { vw: window.innerWidth, vh: window.innerHeight },
  );
  const userIdRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);
  const pathnameRef = useRef(loc.pathname);

  useEffect(() => {
    pathnameRef.current = loc.pathname;
  });

  const step = TOUR_STEPS[stepIdx];
  const isLast = stepIdx === TOUR_STEPS.length - 1;

  // Auto-start on first dashboard visit when user has no tour preference yet.
  useEffect(() => {
    const userId = user?.id;
    if (!userId || autoStartedRef.current) return;
    userIdRef.current = userId;
    autoStartedRef.current = true;
    (async () => {
      const values = await loadTourState(userId);
      if (values.includes("completed") || values.includes("skipped")) return;
      // Only auto-start on dashboard (avoids surprising users mid-flow)
      if (!pathnameRef.current.startsWith("/dashboard")) return;
      // Small delay so hero animations settle
      setTimeout(() => {
        setStepIdx(0);
        setPhase("active");
      }, 700);
    })();
    // Fragile: this should run once per signed-in user, not on every route.
    // Route changes are mirrored through pathnameRef to avoid nav-time churn.
  }, [user?.id]);

  // Replay listener
  useEffect(() => {
    const onReplay = () => {
      setStepIdx(0);
      setPhase("active");
    };
    window.addEventListener("lovable:start-tour", onReplay);
    return () => window.removeEventListener("lovable:start-tour", onReplay);
  }, []);

  // Track viewport
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewport({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // When phase becomes active or step changes: navigate then resolve target
  useEffect(() => {
    if (phase !== "active") return;
    let cancelled = false;
    setRect(null);
    setContextRect(null);
    (async () => {
      if (step.route && loc.pathname !== step.route) {
        await nav({ to: step.route, replace: false });
        await new Promise((r) => setTimeout(r, 120));
      }
      if (cancelled) return;
      if (step.expandTools) {
        window.dispatchEvent(new Event("lovable:tour-expand-tools"));
        await new Promise((r) => setTimeout(r, 220));
      }
      if (cancelled) return;
      if (!step.target) {
        setRect(null);
        setContextRect(null);
        return;
      }
      const found = await waitForElement(step.target, 1800);
      if (cancelled) return;
      setRect(found);
      if (step.context) setContextRect(getElementRect(step.context));
      if (found) {
        const el = document.querySelector(step.target) as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.top < 80 || r.bottom > window.innerHeight - 80) {
            el.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
            await new Promise((res) => setTimeout(res, REDUCED_MOTION ? 50 : 380));
            if (!cancelled) {
              setRect(getElementRect(step.target!));
              if (step.context) setContextRect(getElementRect(step.context));
            }
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx]);

  // Live re-measure on scroll/resize while active
  useEffect(() => {
    if (phase !== "active" || !step.target) return;
    const update = () => {
      setRect(getElementRect(step.target!));
      if (step.context) setContextRect(getElementRect(step.context));
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const id = window.setInterval(update, 500);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.clearInterval(id);
    };
  }, [phase, step?.target, step?.context]);

  const finish = useCallback(
    async (status: "completed" | "skipped") => {
      setPhase("done");
      if (userIdRef.current) {
        await saveTourState(userIdRef.current, [status]);
      }
    },
    [],
  );

  const next = useCallback(() => {
    if (isLast) {
      void finish("completed");
      return;
    }
    setStepIdx((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
  }, [isLast, finish]);

  const back = useCallback(() => {
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard
  useEffect(() => {
    if (phase !== "active") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void finish("skipped");
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, next, back, finish]);

  const tooltipPos = useMemo(
    () => computeTooltipPos(rect, step?.placement, viewport.vw, viewport.vh),
    [rect, step?.placement, viewport.vw, viewport.vh],
  );

  if (phase !== "active" || typeof document === "undefined") return null;

  // The hole cut out of the dim backdrop. Defaults to padded target, but
  // when a wider `context` region is provided (e.g. the whole sidebar) we
  // keep that visible so the user retains orientation.
  const cutRect: Rect | null = contextRect
    ? {
        x: Math.max(0, contextRect.x - CONTEXT_PAD),
        y: Math.max(0, contextRect.y - CONTEXT_PAD),
        w: contextRect.w + CONTEXT_PAD * 2,
        h: contextRect.h + CONTEXT_PAD * 2,
      }
    : rect
      ? {
          x: Math.max(0, rect.x - SPOTLIGHT_PAD),
          y: Math.max(0, rect.y - SPOTLIGHT_PAD),
          w: rect.w + SPOTLIGHT_PAD * 2,
          h: rect.h + SPOTLIGHT_PAD * 2,
        }
      : null;

  // The bright focus ring always tracks the narrow target.
  const focusRect: Rect | null = rect
    ? {
        x: Math.max(0, rect.x - SPOTLIGHT_PAD),
        y: Math.max(0, rect.y - SPOTLIGHT_PAD),
        w: rect.w + SPOTLIGHT_PAD * 2,
        h: rect.h + SPOTLIGHT_PAD * 2,
      }
    : null;

  const anim = REDUCED_MOTION
    ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25 } };

  return createPortal(
    <motion.div
      key="tour-root"
      {...anim}
      className="fixed inset-0 z-[9000]"
      aria-live="polite"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop with optional spotlight hole via 4 quadrant rects */}
      {!cutRect ? (
        <div
          className="absolute inset-0 bg-[oklch(0.04_0.02_270/0.86)] backdrop-blur-xl"
          onClick={() => void finish("skipped")}
        />
      ) : (
        <>
          {/* top */}
          <div
            className="absolute left-0 top-0 right-0 bg-[oklch(0.04_0.02_270/0.86)] backdrop-blur-xl transition-all duration-300"
            style={{ height: cutRect.y }}
            onClick={() => void finish("skipped")}
          />
          {/* bottom */}
          <div
            className="absolute left-0 right-0 bottom-0 bg-[oklch(0.04_0.02_270/0.86)] backdrop-blur-xl transition-all duration-300"
            style={{ top: cutRect.y + cutRect.h }}
            onClick={() => void finish("skipped")}
          />
          {/* left */}
          <div
            className="absolute left-0 bg-[oklch(0.04_0.02_270/0.86)] backdrop-blur-xl transition-all duration-300"
            style={{ top: cutRect.y, height: cutRect.h, width: cutRect.x }}
            onClick={() => void finish("skipped")}
          />
          {/* right */}
          <div
            className="absolute right-0 bg-[oklch(0.04_0.02_270/0.86)] backdrop-blur-xl transition-all duration-300"
            style={{
              top: cutRect.y,
              height: cutRect.h,
              left: cutRect.x + cutRect.w,
            }}
            onClick={() => void finish("skipped")}
          />
          {/* Context outline — soft, only when context differs from focus */}
          {contextRect && (
            <div
              className="absolute rounded-2xl pointer-events-none transition-all duration-300"
              style={{
                left: cutRect.x,
                top: cutRect.y,
                width: cutRect.w,
                height: cutRect.h,
                boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 305 / 0.18)",
              }}
            />
          )}
          {/* Bright focus ring on the actual target */}
          {focusRect && (
            <div
              className="absolute rounded-2xl pointer-events-none transition-all duration-300"
              style={{
                left: focusRect.x,
                top: focusRect.y,
                width: focusRect.w,
                height: focusRect.h,
                boxShadow:
                  "0 0 0 2px oklch(0.78 0.18 305 / 0.9), 0 0 60px 6px oklch(0.78 0.18 275 / 0.55)",
              }}
            />
          )}
        </>
      )}

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={REDUCED_MOTION ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={REDUCED_MOTION ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: REDUCED_MOTION ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute"
          style={{ left: tooltipPos.left, top: tooltipPos.top, width: TOOLTIP_W }}
        >
          <div className="relative rounded-2xl readable-glass-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-primary">
                {step.eyebrow}
              </div>
              <div className="shrink-0 text-[10px] tabular-nums uppercase tracking-[0.2em] text-muted-foreground/70">
                {stepIdx + 1} / {TOUR_STEPS.length}
              </div>
            </div>
            <h3 className="mt-1.5 font-display text-lg leading-tight text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

            {step.openTo && (
              <button
                type="button"
                onClick={async () => {
                  await finish("completed");
                  await nav({ to: step.openTo! });
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              >
                Open this page →
              </button>
            )}

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className={`h-1 rounded-full transition-all ${
                      i === stepIdx
                        ? "w-5 progress-spectrum-fill"
                        : i < stepIdx
                          ? "w-1.5 bg-primary/60"
                          : "w-1.5 bg-glass-border"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                {stepIdx > 0 && (
                  <button
                    onClick={back}
                    className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => void finish("skipped")}
                  className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Skip
                </button>
                <button
                  onClick={next}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  {isLast ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
