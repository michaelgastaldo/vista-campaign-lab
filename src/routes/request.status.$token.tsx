import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { IconLogo, IconCheck, IconClock } from "@/components/ui-custom/CustomIcon";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/request/status/$token")({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: `Request status | ${BRAND.name}` },
      { name: "description", content: "Track the status of a campaign request you submitted." },
      { property: "og:title", content: `Request status | ${BRAND.name}` },
      { property: "og:description", content: "Track the status of a campaign request you submitted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Status = {
  id: string;
  status: "new" | "accepted" | "declined" | "converted";
  brief: string;
  created_at: string;
  workspace_id: string | null;
};

function StatusPage() {
  const { token } = Route.useParams();
  const [s, setS] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("public_request_status", { _token: token });
      const row = (data as Status[] | null)?.[0] ?? null;
      setS(row);
      setLoading(false);
    })();
  }, [token]);

  const done = s?.status === "converted" || s?.status === "accepted";

  return (
    <div className="relative min-h-screen p-6">
      <GradientMesh />
      <div className="relative z-10 mx-auto max-w-lg pt-12">
        <Link to="/" className="inline-flex items-center gap-2 text-foreground">
          <IconLogo size={26} className="text-primary" />
          <span className="font-display text-lg">{BRAND.name}</span>
        </Link>

        <GlassPanel tier="strong" className="mt-8 p-8">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : !s ? (
            <div>
              <h1 className="font-display text-2xl">Request not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This status link is invalid or has expired. Status links stay live for 30 days.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex size-9 items-center justify-center rounded-xl ${
                    done
                      ? "bg-primary/15 text-primary"
                      : s.status === "declined"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {done ? <IconCheck size={18} /> : <IconClock size={18} />}
                </span>
                <h1 className="font-display text-2xl capitalize">
                  {s.status === "new" ? "Awaiting triage" : s.status}
                </h1>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Submitted</div>
                <div className="text-sm">{new Date(s.created_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Brief</div>
                <div className="mt-1 text-sm">{s.brief}</div>
              </div>
              {s.status === "converted" && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
                  This request became a working campaign. Reach out to the team for the workspace link.
                </div>
              )}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
