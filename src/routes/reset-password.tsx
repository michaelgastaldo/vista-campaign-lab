import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { Button } from "@/components/ui/button";
import { IconLogo } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Supabase recovery places a hashed session in the URL; once auth picks it up,
  // we're authenticated for the duration of this page and can call updateUser.
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash.includes("type=recovery")) {
      // Allow directly opening this page only if you already have an active session
      // (e.g. you arrived via the email link and Supabase has set the session).
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          toast.error("This reset link is invalid or expired.");
          nav({ to: "/login", replace: true });
        } else {
          setReady(true);
        }
      });
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // In case the event already fired
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You're signed in.");
    nav({ to: "/dashboard", replace: true });
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <GradientMesh />
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5 text-foreground">
          <IconLogo size={28} className="text-primary" />
          <span className="font-display text-2xl">{BRAND.name}</span>
        </Link>

        <GlassPanel tier="strong" className="p-6 md:p-8">
          <h1 className="font-display text-2xl">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose something strong. You'll be signed in afterwards.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={!ready}
                className="mt-1.5 w-full rounded-xl border border-glass-border bg-transparent px-3 py-2 text-sm focus:border-primary/60 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={!ready}
                className="mt-1.5 w-full rounded-xl border border-glass-border bg-transparent px-3 py-2 text-sm focus:border-primary/60 focus:outline-none disabled:opacity-50"
              />
            </div>
            <Button type="submit" disabled={busy || !ready} className="w-full">
              {!ready ? "Verifying link…" : busy ? "Updating…" : "Update password"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm">
            <Link to="/login" className="text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
