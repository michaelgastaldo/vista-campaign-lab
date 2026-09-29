import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Standalone copy helper. Same fallback chain as the hook. Returns true on
 * success. Safe to call from anywhere (event handlers, plain utils).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Async Clipboard API (preferred — secure contexts only)
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function" &&
      (typeof window === "undefined" || window.isSecureContext !== false)
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  // 2. Legacy textarea + execCommand fallback (works in iframes / HTTP)
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    const selection = document.getSelection();
    const prevRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (prevRange && selection) {
      selection.removeAllRanges();
      selection.addRange(prevRange);
    }
    return ok;
  } catch {
    return false;
  }
}


/**
 * Robust clipboard hook. Tries the async Clipboard API first; if it's
 * unavailable (insecure context, sandboxed iframe, permissions denied)
 * falls back to the legacy hidden-textarea + document.execCommand('copy')
 * trick which works in iframes and HTTP. Returns a "copied" flag that
 * auto-resets after `resetMs` (default 2s), and an "error" flag set only
 * when both methods fail.
 */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const ok = await copyToClipboard(text);
      if (ok) {
        setCopied(true);
        setError(false);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
      } else {
        setCopied(false);
        setError(true);
        timerRef.current = setTimeout(() => setError(false), resetMs);
      }
      return ok;
    },
    [resetMs],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopied(false);
    setError(false);
  }, []);

  return { copy, copied, error, reset };
}
