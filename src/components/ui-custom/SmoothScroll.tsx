import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Buttery smooth scroll powered by Lenis.
 * Mount once near the root. Respects prefers-reduced-motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });

    let raf = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Anchor links — let Lenis handle in-page jumps
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href");
      if (!id || id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -32 });
    };
    document.addEventListener("click", onClick);

    // Pause Lenis whenever an overlay locks body scroll (Radix Dialog/Sheet,
    // Vaul Drawer, etc.). Without this, Lenis keeps driving the page behind
    // the open panel and wheel input scrolls the background.
    const syncLock = () => {
      const locked =
        document.body.hasAttribute("data-scroll-locked") ||
        document.documentElement.hasAttribute("data-scroll-locked") ||
        document.body.style.overflow === "hidden" ||
        document.body.style.pointerEvents === "none";
      if (locked) lenis.stop();
      else lenis.start();
    };
    syncLock();
    const mo = new MutationObserver(syncLock);
    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-scroll-locked"],
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      mo.disconnect();
      lenis.destroy();
    };
  }, []);

  return null;
}
