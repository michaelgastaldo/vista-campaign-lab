import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { Button } from "@/components/ui/button";

import { BRAND } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { redirect?: string; mode?: "signin" | "signup" } => ({
    ...(typeof s.redirect === "string" ? { redirect: s.redirect } : {}),
    ...(s.mode === "signup" || s.mode === "signin" ? { mode: s.mode as "signin" | "signup" } : {}),
  }),
  component: LoginPage,
});

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function LoginPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      nav({ to: (search.redirect ?? "/dashboard") as "/dashboard", replace: true });
    }
  }, [session, loading, nav, search.redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/welcome` },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation required — surface the check-your-inbox state.
          setPendingConfirm(email);
        } else {
          toast.success("Account created. Welcome.");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your inbox for a reset link.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirm = async () => {
    if (!pendingConfirm) return;
    setResendBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingConfirm,
        options: { emailRedirectTo: `${window.location.origin}/welcome` },
      });
      if (error) throw error;
      toast.success("Confirmation email resent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setResendBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${search.redirect ?? "/dashboard"}`,
    });
    if (result.error) {
      toast.error(result.error.message);
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <GradientMesh />

      {/* Floating refractive orbs */}
      <FloatingOrbs />

      {/* Ambient hex constellation */}
      <HexConstellation />

      <div className="relative z-10 w-full max-w-[420px]">


        {/* Liquid glass card */}
        <div className="relative">
          {/* Outer chromatic halo */}
          <div
            className="pointer-events-none absolute -inset-px rounded-[28px] opacity-70 blur-xl"
            style={{
              background:
                "conic-gradient(from 140deg, oklch(0.72 0.2 275 / 0.35), oklch(0.78 0.18 340 / 0.25), oklch(0.86 0.14 88 / 0.3), oklch(0.72 0.2 275 / 0.35))",
            }}
          />
          {/* Card */}
          <div
            className="relative overflow-hidden rounded-[28px] p-8 md:p-9"
            style={{
              background:
                "linear-gradient(155deg, oklch(1 0 0 / 0.09) 0%, oklch(1 0 0 / 0.04) 45%, oklch(0 0 0 / 0.15) 100%)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid oklch(1 0 0 / 0.12)",
              boxShadow:
                "inset 0 1px 0 oklch(1 0 0 / 0.14), inset 0 -1px 0 oklch(0 0 0 / 0.3), 0 40px 80px -20px oklch(0 0 0 / 0.6), 0 0 60px -10px oklch(0.72 0.2 275 / 0.25)",
            }}
          >
            {/* Specular sheen */}
            <div
              className="pointer-events-none absolute -top-1/2 left-0 h-full w-full rotate-12"
              style={{
                background: "linear-gradient(180deg, oklch(1 0 0 / 0.08) 0%, transparent 60%)",
                filter: "blur(20px)",
              }}
            />
            {/* Top edge highlight */}
            <div
              className="pointer-events-none absolute inset-x-8 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.5), transparent)",
              }}
            />

            <div className="relative">
              <Link
                to="/"
                className="group mb-7 flex items-center justify-center gap-3 text-foreground"
              >
                <span className="relative grid h-[52px] w-11 place-items-center">
                  <span
                    aria-hidden
                    className="absolute inset-0 opacity-70 blur-md transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      clipPath: HEX_CLIP,
                      background:
                        "conic-gradient(from 140deg, oklch(0.72 0.2 275), oklch(0.78 0.18 340), oklch(0.86 0.14 88), oklch(0.72 0.2 275))",
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      clipPath: HEX_CLIP,
                      background:
                        "linear-gradient(140deg, oklch(0.78 0.2 275), oklch(0.82 0.18 340) 50%, oklch(0.88 0.14 88))",
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-[1.5px]"
                    style={{
                      clipPath: HEX_CLIP,
                      background:
                        "linear-gradient(155deg, oklch(0.18 0.02 270) 0%, oklch(0.1 0.015 270) 100%)",
                      boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.12)",
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-[1.5px] opacity-60"
                    style={{
                      clipPath: HEX_CLIP,
                      background:
                        "linear-gradient(160deg, oklch(1 0 0 / 0.18) 0%, transparent 45%)",
                    }}
                  />
                  <svg
                    viewBox="0 0 24 24"
                    className="relative h-[18px] w-[18px]"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient id="m-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="oklch(0.92 0.05 275)" />
                        <stop offset="100%" stopColor="oklch(0.88 0.12 340)" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M4 19V6.5c0-.5.6-.8 1-.5L12 11l7-5c.4-.3 1 0 1 .5V19"
                      fill="none"
                      stroke="url(#m-grad)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="flex flex-col leading-none">
                  <span className="font-display text-2xl tracking-tight">{BRAND.name}</span>
                </span>
              </Link>

              {pendingConfirm ? (
                <div className="mt-7 space-y-4 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </div>
                  <h2 className="font-display text-2xl tracking-tight">Check your email</h2>
                  <p className="text-sm text-muted-foreground">
                    We sent a confirmation link to <span className="text-foreground">{pendingConfirm}</span>. Click it to finish signing up.
                  </p>
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resendConfirm}
                      disabled={resendBusy}
                      className="rounded-full border border-glass-border bg-glass/40 px-4 py-2 text-xs text-foreground transition hover:bg-glass-strong disabled:opacity-50"
                    >
                      {resendBusy ? "Sending…" : "Resend email"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingConfirm(null);
                        setMode("signin");
                      }}
                      className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                    >
                      ← Back to sign in
                    </button>
                  </div>
                </div>
              ) : (
              <>
              {mode !== "forgot" && (
                <>
                  <button
                    type="button"
                    onClick={google}
                    disabled={busy}
                    className="group relative mt-7 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition disabled:opacity-50"
                    style={{
                      background:
                        "linear-gradient(160deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.03))",
                      border: "1px solid oklch(1 0 0 / 0.14)",
                      backdropFilter: "blur(20px)",
                      boxShadow:
                        "inset 0 1px 0 oklch(1 0 0 / 0.1), 0 4px 16px -4px oklch(0 0 0 / 0.4)",
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                      style={{
                        background:
                          "radial-gradient(circle at 50% 0%, oklch(1 0 0 / 0.12), transparent 70%)",
                      }}
                    />
                    <GoogleMark />
                    <span className="relative">Continue with Google</span>
                  </button>

                  <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-glass-border to-glass-border" />
                    or with email
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-glass-border to-glass-border" />
                  </div>
                </>
              )}

              <form
                onSubmit={submit}
                className={mode === "forgot" ? "mt-7 space-y-4" : "space-y-4"}
              >
                <GlassField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  autoComplete="email"
                />
                {mode !== "forgot" && (
                  <GlassField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    trailing={
                      mode === "signin" ? (
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 transition hover:text-primary"
                        >
                          Forgot
                        </button>
                      ) : null
                    }
                  />
                )}

                <div className="group relative isolate rounded-full p-px shadow-[0_8px_24px_-6px_oklch(0.72_0.2_275/0.4)] transition-transform duration-300 ease-out hover:scale-105">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `
                        linear-gradient(160deg, oklch(0.72 0.2 275 / 0.55), oklch(0.86 0.14 88 / 0.35)) border-box,
                        conic-gradient(from var(--beam-angle, 0deg), transparent 0deg, transparent 40deg, oklch(0.72 0.2 275) 78deg, oklch(0.78 0.18 340) 116deg, oklch(0.86 0.14 88) 152deg, transparent 196deg, transparent 360deg) border-box
                      `,
                      animation: "beam-spin 4s linear infinite",
                      border: "2px solid transparent",
                      WebkitMask:
                        "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
                      WebkitMaskComposite: "xor",
                      mask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
                      maskComposite: "exclude",
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={busy}
                    className="relative h-11 w-full overflow-hidden rounded-full text-sm font-medium text-foreground shadow-none hover:text-foreground"
                    style={{
                      background:
                        "linear-gradient(160deg, oklch(0.22 0.01 270), oklch(0.14 0.01 270))",
                      boxShadow:
                        "inset 0 1px 0 oklch(1 0 0 / 0.08), inset 0 -1px 0 oklch(0 0 0 / 0.3)",
                    }}
                  >
                    <span className="relative z-10">
                      {busy
                        ? "…"
                        : mode === "signin"
                          ? "Sign in"
                          : mode === "signup"
                            ? "Create account"
                            : "Send reset link"}
                    </span>
                  </Button>
                </div>
                <style>{`
                  @property --beam-angle {
                    syntax: '<angle>';
                    initial-value: 0deg;
                    inherits: false;
                  }
                  @keyframes beam-spin {
                    to { --beam-angle: 360deg; }
                  }
                `}</style>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    New here?{" "}
                    <button
                      onClick={() => setMode("signup")}
                      className="text-primary transition hover:text-primary/80"
                      type="button"
                    >
                      Create an account
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <>
                    Already have one?{" "}
                    <button
                      onClick={() => setMode("signin")}
                      className="text-primary transition hover:text-primary/80"
                      type="button"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setMode("signin")}
                    className="text-muted-foreground transition hover:text-foreground"
                    type="button"
                  >
                    ← Back to sign in
                  </button>
                )}
              </div>
              </>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
          Secured · Encrypted · Yours
        </p>
      </div>
    </div>
  );
}

function GlassField({
  label,
  type,
  value,
  onChange,
  required,
  minLength,
  autoComplete,
  trailing,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80">
          {label}
        </span>
        {trailing}
      </div>
      <div
        className="group relative overflow-hidden rounded-xl transition focus-within:ring-1 focus-within:ring-primary/40"
        style={{
          background: "linear-gradient(160deg, oklch(0 0 0 / 0.25), oklch(0 0 0 / 0.1))",
          border: "1px solid oklch(1 0 0 / 0.1)",
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.06), inset 0 -1px 0 oklch(0 0 0 / 0.2)",
        }}
      >
        <input
          type={type}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
    </label>
  );
}

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute h-[480px] w-[480px] rounded-full opacity-60"
        style={{
          top: "-10%",
          left: "-8%",
          background: "radial-gradient(circle, oklch(0.72 0.2 275 / 0.55), transparent 65%)",
          filter: "blur(60px)",
          animation: "orb-drift-a 22s ease-in-out infinite",
        }}
      />
      <div
        className="absolute h-[420px] w-[420px] rounded-full opacity-55"
        style={{
          bottom: "-12%",
          right: "-6%",
          background: "radial-gradient(circle, oklch(0.78 0.18 340 / 0.5), transparent 65%)",
          filter: "blur(70px)",
          animation: "orb-drift-b 26s ease-in-out infinite",
        }}
      />
      <div
        className="absolute h-[360px] w-[360px] rounded-full opacity-40"
        style={{
          top: "30%",
          right: "20%",
          background: "radial-gradient(circle, oklch(0.86 0.14 88 / 0.35), transparent 65%)",
          filter: "blur(80px)",
          animation: "orb-drift-c 30s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes orb-drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 60px) scale(1.08); }
        }
        @keyframes orb-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, -40px) scale(1.1); }
        }
        @keyframes orb-drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 40px) scale(0.92); }
        }
      `}</style>
    </div>
  );
}

function HexConstellation() {
  const hexes = [
    { size: 28, top: "15%", left: "12%", delay: 0 },
    { size: 18, top: "22%", left: "78%", delay: 1.2 },
    { size: 22, top: "70%", left: "10%", delay: 2.4 },
    { size: 16, top: "78%", left: "85%", delay: 0.6 },
    { size: 36, top: "55%", left: "6%", delay: 1.8 },
    { size: 14, top: "40%", left: "90%", delay: 3 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {hexes.map((h, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: h.top,
            left: h.left,
            width: h.size,
            height: h.size * 1.1547,
            clipPath: HEX_CLIP,
            background: "linear-gradient(140deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.02))",
            border: "1px solid oklch(1 0 0 / 0.06)",
            animation: `hex-float 8s ease-in-out ${h.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes hex-float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
          50% { transform: translateY(-14px) rotate(8deg); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-8l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40 35.8 44 30.4 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
