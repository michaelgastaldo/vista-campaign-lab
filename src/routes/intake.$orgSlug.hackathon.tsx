import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDraft } from "@/hooks/use-draft";
import { supabase } from "@/integrations/supabase/client";
import { newRequestStatusToken } from "@/lib/request-token";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconLogo, IconCheck } from "@/components/ui-custom/CustomIcon";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/intake/$orgSlug/hackathon")({
  component: HackathonIntake,
  head: () => ({
    meta: [
      { title: "Submit an event project" },
      { name: "description", content: "Pitch your event project for marketing support." },
    ],
  }),
});

function HackathonIntake() {
  const { orgSlug } = Route.useParams();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm, { clearDraft }] = useDraft(`intake/${orgSlug}/hackathon:form`, {
    project: "",
    name: "",
    email: "",
    pitch: "",
    demo_url: "",
    needs: "",
    desired_due_date: "",
  });
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("org_id_from_slug", { _slug: orgSlug });
      setOrgId((data as string | null) ?? null);
      setLoading(false);
    })();
  }, [orgSlug]);

  const submit = async () => {
    if (!orgId) return toast.error("Org not found");
    if (!form.project.trim()) return toast.error("Add the project name");
    if (!form.email.includes("@")) return toast.error("Email looks off");
    if (form.pitch.trim().length < 10) return toast.error("Tell us a bit more");
    setBusy(true);
    const brief = [
      `[Event] ${form.project}`,
      "",
      form.pitch.trim(),
      form.demo_url ? `\nDemo: ${form.demo_url.trim()}` : "",
      form.needs ? `\nWhat we need: ${form.needs.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const statusToken = newRequestStatusToken();
    const { error } = await supabase
      .from("campaign_requests")
      .insert({
        org_id: orgId,
        status_token: statusToken,
        requestor_name: form.name.trim() || null,
        requestor_email: form.email.trim(),
        brief,
        desired_due_date: form.desired_due_date || null,
      });
    setBusy(false);
    if (error) return toast.error(error.message ?? "Submission failed");
    setDoneId(statusToken);
    clearDraft();
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <GradientMesh />
        <div className="relative mx-auto max-w-2xl px-6 py-16">
          <div className="h-64 animate-pulse rounded-2xl bg-glass/40" />
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <GradientMesh />
        <div className="relative mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl">Org not found</h1>
          <p className="mt-2 text-muted-foreground">Double-check the link you were given.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GradientMesh />
      <div className="relative mx-auto max-w-2xl px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <IconLogo size={20} /> {BRAND.name}
        </Link>
        <h1 className="mt-8 font-display text-4xl">Pitch your event project</h1>
        <p className="mt-2 text-muted-foreground">
          Get a fast track for marketing support — naming, landing page, distribution.
        </p>

        {doneId ? (
          <GlassPanel className="mt-8 p-8 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <IconCheck size={22} />
            </span>
            <div className="mt-3 font-display text-2xl">Submitted!</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Track status:{" "}
              <Link to="/request/status/$token" params={{ token: doneId }} className="text-primary underline">
                view your submission
              </Link>
            </p>
          </GlassPanel>
        ) : (
          <GlassPanel className="mt-8 space-y-4 p-6 md:p-8">
            <Field label="Project name" value={form.project} onChange={(v) => setForm({ ...form, project: v })} placeholder="HoloPager" />
            <Field label="Your name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Alex Builder" />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="alex@acme.com" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">The pitch</div>
              <textarea
                value={form.pitch}
                onChange={(e) => setForm({ ...form, pitch: e.target.value })}
                rows={4}
                placeholder="What is it, who's it for, why now?"
                className="mt-2 w-full rounded-xl border border-glass-border bg-glass/30 px-4 py-2.5 outline-none focus:border-primary/60"
              />
            </div>
            <Field label="Demo URL (optional)" value={form.demo_url} onChange={(v) => setForm({ ...form, demo_url: v })} placeholder="https://…" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">What you need</div>
              <textarea
                value={form.needs}
                onChange={(e) => setForm({ ...form, needs: e.target.value })}
                rows={3}
                placeholder="Landing page, X/LinkedIn launch, demo video…"
                className="mt-2 w-full rounded-xl border border-glass-border bg-glass/30 px-4 py-2.5 outline-none focus:border-primary/60"
              />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Desired ship date</div>
              <input
                type="date"
                value={form.desired_due_date}
                onChange={(e) => setForm({ ...form, desired_due_date: e.target.value })}
                className="mt-2 w-full rounded-xl border border-glass-border bg-glass/30 px-4 py-2.5 outline-none focus:border-primary/60"
              />
            </div>
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <IconCheck size={14} /> {busy ? "Submitting…" : "Submit project"}
            </button>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-glass-border bg-glass/30 px-4 py-2.5 outline-none focus:border-primary/60"
      />
    </div>
  );
}
