import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconLogo, IconArrowRight, IconCheck } from "@/components/ui-custom/CustomIcon";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { BRAND } from "@/lib/brand";
import { RequestForm } from "@/components/requests/RequestForm";

export const Route = createFileRoute("/request/$orgSlug")({
  component: RequestPage,
  head: () => ({
    meta: [
      { title: "Request a campaign" },
      { name: "description", content: "Submit a campaign brief — get a status link back." },
    ],
  }),
});

function RequestPage() {
  const { orgSlug } = Route.useParams();
  const [orgId, setOrgId] = useState<string | null | undefined>(undefined);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("org_id_from_slug", { _slug: orgSlug });
      setOrgId((data as string | null) ?? null);
    })();
  }, [orgSlug]);

  if (orgId === undefined) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <GradientMesh />
        <div className="relative z-10 text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (orgId === null) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <GradientMesh />
        <GlassPanel tier="strong" className="relative z-10 max-w-md p-8 text-center">
          <h1 className="font-display text-2xl">Workspace not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">Double-check the link with the team that sent it.</p>
        </GlassPanel>
      </div>
    );
  }

  if (submittedId) {
    return (
      <div className="relative min-h-screen p-6">
        <GradientMesh />
        <div className="relative z-10 mx-auto max-w-lg pt-20">
          <GlassPanel tier="strong" className="p-8 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <IconCheck size={24} />
            </span>
            <h1 className="mt-4 font-display text-3xl">Request received</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We saved your brief and pinged the team. Bookmark the status link below.
            </p>
            <Link
              to="/request/status/$token"
              params={{ token: submittedId }}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              View status <IconArrowRight size={14} />
            </Link>
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-6">
      <GradientMesh />
      <div className="relative z-10 mx-auto max-w-xl pt-12">
        <Link to="/" className="inline-flex items-center gap-2 text-foreground">
          <IconLogo size={26} className="text-primary" />
          <span className="font-display text-lg">{BRAND.name}</span>
        </Link>
        <h1 className="mt-8 font-display text-4xl">Request a campaign</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One sentence in, working campaign out. The team takes it from here.
        </p>

        <GlassPanel tier="strong" className="mt-8 p-6">
          <RequestForm
            orgId={orgId}
            draftKey={`request/${orgSlug}:form`}
            onSubmitted={setSubmittedId}
          />
        </GlassPanel>
      </div>
    </div>
  );
}

