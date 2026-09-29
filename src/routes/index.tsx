import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/lib/brand";
import {
  IconCampaign,
  IconUtm,
  IconCalendar,
  IconFunnel,
  IconBot,
  IconArrowRight,
  IconLogo,
} from "@/components/ui-custom/CustomIcon";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "description", content: BRAND.description },
      { property: "og:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { property: "og:description", content: BRAND.description },
      { property: "og:type", content: "website" },
    ],
  }),
});

const FEATURES = [
  {
    Icon: IconCampaign,
    label: "Campaign workspaces",
    desc: "Brief, plan, and ship every campaign in one shared workspace.",
    hue: 150,
    to: "/campaigns" as const,
  },
  {
    Icon: IconUtm,
    label: "UTM builder",
    desc: "Consistent, taxonomy-checked tracking links across every channel.",
    hue: 275,
    to: "/tools/utm" as const,
  },
  {
    Icon: IconCalendar,
    label: "Calendar",
    desc: "See every launch, event, and send in one calendar view.",
    hue: 88,
    to: "/calendar" as const,
  },
  {
    Icon: IconFunnel,
    label: "Funnel targets",
    desc: "Set MQL and SQO targets and track pacing at a glance.",
    hue: 200,
    to: "/funnel" as const,
  },
  {
    Icon: IconBot,
    label: "AI tools",
    desc: "Copilot for naming and turning requests into campaigns.",
    hue: 55,
    to: "/tools" as const,
  },
];

function LandingPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [session, loading, navigate]);

  if (loading || session) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <GradientMesh />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GradientMesh />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium">
          <IconLogo size={22} />
          <span className="font-display text-lg">{BRAND.name}</span>
        </Link>
        <Link
          to="/login"
          className="rounded-full border border-glass-border bg-glass/40 px-4 py-2 text-sm text-foreground hover:bg-glass-strong"
        >
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pt-16">
        <section className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {BRAND.tagline}
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight sm:text-6xl">
            {BRAND.name}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {BRAND.description}
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Create an account <IconArrowRight size={14} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full border border-glass-border bg-glass/40 px-6 py-3 text-sm text-foreground hover:bg-glass-strong"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="mt-16 sm:mt-24">
          <h2 className="text-center text-xs uppercase tracking-[0.28em] text-muted-foreground">
            What's inside
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((f) => (
              <Link key={f.label} to={f.to} className="block">
                <GlassPanel className="h-full p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <div
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      background: `oklch(0.30 0.12 ${f.hue} / 0.5)`,
                      color: `oklch(0.92 0.08 ${f.hue})`,
                    }}
                  >
                    <f.Icon size={20} />
                  </div>
                  <div className="mt-4 font-display text-lg">{f.label}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </GlassPanel>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-20 border-t border-glass-border/60 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {BRAND.name}
        </footer>
      </main>
    </div>
  );
}
