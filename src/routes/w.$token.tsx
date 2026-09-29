import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { IconLogo } from "@/components/ui-custom/CustomIcon";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/w/$token")({
  component: PublicWorkspace,
});

type View = {
  id: string;
  name: string;
  status: string;
  goal: string | null;
  channel: string | null;
  kpi_label: string | null;
  kpi_target: number | null;
  kpi_actual: number | null;
  start_date: string | null;
  end_date: string | null;
};

function PublicWorkspace() {
  const { token } = useParams({ from: "/w/$token" });
  const [w, setW] = useState<View | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("public_workspace_by_token", { _token: token });
      const row = (data ?? [])[0] as View | undefined;
      if (!row) {
        setState("missing");
        return;
      }
      setW(row);
      setState("ok");
      await supabase.rpc("record_share_view", { _token: token });
    })();
  }, [token]);

  return (
    <div className="relative min-h-screen bg-[color:var(--color-ink)] text-foreground">
      <GradientMesh />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 text-foreground">
          <IconLogo size={22} className="text-primary" />
          <span className="font-display text-lg">{BRAND.name}</span>
        </Link>

        {state === "loading" && (
          <GlassPanel className="h-64 animate-pulse" />
        )}
        {state === "missing" && (
          <GlassPanel className="p-10 text-center">
            <div className="font-display text-2xl">Link expired or revoked</div>
            <p className="mt-2 text-sm text-muted-foreground">Ask the workspace owner for a fresh share link.</p>
          </GlassPanel>
        )}
        {state === "ok" && w && (
          <div className="space-y-6">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Read-only share</div>
              <h1 className="mt-2 font-display text-4xl">{w.name}</h1>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass/40 px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
                Status · {w.status}
              </div>
            </div>

            {w.goal && (
              <GlassPanel className="p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Goal</div>
                <div className="mt-2 text-sm leading-relaxed">{w.goal}</div>
              </GlassPanel>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Channel" value={w.channel ?? "—"} />
              <Stat label="Start" value={w.start_date ?? "—"} />
              <Stat label="End" value={w.end_date ?? "—"} />
            </div>

            {w.kpi_label && (
              <GlassPanel className="p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{w.kpi_label}</div>
                <div className="mt-2 font-display text-3xl">
                  {w.kpi_actual ?? 0}
                  {w.kpi_target ? <span className="text-base text-muted-foreground"> / {w.kpi_target}</span> : null}
                </div>
              </GlassPanel>
            )}

            <div className="text-center text-[11px] text-muted-foreground">
              Shared via {BRAND.name}. <Link to="/" className="text-primary underline-offset-4 hover:underline">Build your own</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm">{value}</div>
    </GlassPanel>
  );
}
