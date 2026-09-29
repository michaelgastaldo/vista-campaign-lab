import { useEffect, useState } from "react";

/**
 * Sun↔moon morph toggle. App is dark-by-default; this adds a `.light` class
 * on <html> when the user opts into light mode. Persisted in localStorage.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("theme");
    if (stored === "light") return false;
    if (stored === "dark") return true;
    return true; // dark-first product
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("light");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.add("light");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <>
      <style>{`
        .tt-btn {
          position: relative;
          width: 56px;
          height: 28px;
          border-radius: 9999px;
          padding: 0;
          border: 1px solid transparent;
          cursor: pointer;
          overflow: hidden;
          transition: background 600ms ease, border-color 600ms ease;
          flex-shrink: 0;
        }
        .tt-btn[data-mode="light"] {
          background: linear-gradient(135deg, #87ceeb 0%, #ffd3a5 100%);
          border-color: rgba(15,23,42,0.1);
        }
        .tt-btn[data-mode="dark"] {
          background: linear-gradient(135deg, #0d1244 0%, #1a0b3d 100%);
          border-color: rgba(255,255,255,0.15);
        }
        .tt-knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          transition: transform 700ms cubic-bezier(.5,.05,.3,1), background 600ms ease, box-shadow 600ms ease;
        }
        .tt-btn[data-mode="light"] .tt-knob {
          transform: translateX(0);
          background: radial-gradient(circle at 35% 30%, #fff6c9 0%, #ffd27a 45%, #ff9d5c 100%);
          box-shadow: 0 0 14px 2px rgba(255,180,90,0.7);
        }
        .tt-btn[data-mode="dark"] .tt-knob {
          transform: translateX(28px);
          background: radial-gradient(circle at 35% 35%, #fffceb 0%, #e6eeff 55%, #b9c3dd 100%);
          box-shadow: 0 0 10px 2px rgba(230,238,255,0.5),
            inset -5px -2px 0 0 rgba(13,18,68,0.85);
        }
        .tt-stars { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 500ms ease; }
        .tt-btn[data-mode="dark"] .tt-stars { opacity: 1; }
        .tt-stars span {
          position: absolute;
          background: white;
          border-radius: 9999px;
          box-shadow: 0 0 4px rgba(255,255,255,0.9);
          animation: tt-twink 2.5s ease-in-out infinite;
        }
        @keyframes tt-twink {
          0%,100% { opacity: 0.3; transform: scale(0.7); }
          50%     { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        data-mode={isDark ? "dark" : "light"}
        onClick={() => setIsDark((v) => !v)}
        className={`tt-btn ${className}`}
      >
        <span className="tt-stars">
          <span style={{ top: 6, left: 9, width: 2, height: 2, animationDelay: "0s" }} />
          <span style={{ top: 12, left: 14, width: 1.5, height: 1.5, animationDelay: "0.6s" }} />
          <span style={{ top: 18, left: 7, width: 1, height: 1, animationDelay: "1.2s" }} />
          <span style={{ top: 5, left: 20, width: 1, height: 1, animationDelay: "1.8s" }} />
        </span>
        <span className="tt-knob" />
      </button>
    </>
  );
}

export default ThemeToggle;
