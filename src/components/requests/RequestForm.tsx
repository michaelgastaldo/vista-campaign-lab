import { useEffect, useState } from "react";
import { useDraft } from "@/hooks/use-draft";
import { supabase } from "@/integrations/supabase/client";
import { newRequestStatusToken } from "@/lib/request-token";
import { IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";

type Template = { id: string; name: string; description: string | null };

export type RequestFormProps = {
  orgId: string;
  /** Unique draft key to isolate this form's draft state from other instances. */
  draftKey: string;
  /** Prefill and lock the requestor email (e.g. signed-in user on the internal form). */
  initialEmail?: string;
  /** Called with the request's private status token on success. */
  onSubmitted: (statusToken: string) => void;
  /** Ask the RPC for available templates. Defaults to true. */
  loadTemplates?: boolean;
  submitLabel?: string;
};

export function RequestForm({
  orgId,
  draftKey,
  initialEmail,
  onSubmitted,
  loadTemplates = true,
  submitLabel = "Submit request",
}: RequestFormProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm, { clearDraft }] = useDraft(draftKey, {
    name: "",
    email: initialEmail ?? "",
    brief: "",
    due: "",
    templateId: "",
  });
  const { name, email, brief, due, templateId } = form;
  const setName = (v: string) => setForm((f) => ({ ...f, name: v }));
  const setEmail = (v: string) => setForm((f) => ({ ...f, email: v }));
  const setBrief = (v: string) => setForm((f) => ({ ...f, brief: v }));
  const setDue = (v: string) => setForm((f) => ({ ...f, due: v }));
  const setTemplateId = (v: string) => setForm((f) => ({ ...f, templateId: v }));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialEmail && email !== initialEmail) setEmail(initialEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail]);

  useEffect(() => {
    if (!loadTemplates) return;
    (async () => {
      const { data } = await supabase.rpc("public_seed_templates");
      setTemplates((data as Template[]) ?? []);
    })();
  }, [loadTemplates]);

  const submit = async () => {
    if (!email.includes("@")) return toast.error("Email looks off");
    if (brief.trim().length < 10) return toast.error("Tell us a bit more");
    setSubmitting(true);
    const statusToken = newRequestStatusToken();
    const { error } = await supabase
      .from("campaign_requests")
      .insert({
        org_id: orgId,
        status_token: statusToken,
        requestor_email: email.trim(),
        requestor_name: name.trim() || null,
        brief: brief.trim(),
        desired_due_date: due || null,
        template_id: templateId || null,
      });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Could not submit");
      return;
    }
    clearDraft();
    onSubmitted(statusToken);
  };

  return (
    <div className="space-y-4">
      <Field label="Your name (optional)">
        <input value={name} onChange={(e) => setName(e.target.value)} className="request-input" placeholder="Jordan" />
      </Field>
      <Field label="Email *">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="request-input"
          placeholder="jordan@acme.co"
          type="email"
          readOnly={!!initialEmail}
        />
      </Field>
      <Field label="What do you need? *">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          placeholder="A 2-week LinkedIn campaign for the Q3 webinar — 250 sign-ups."
          className="request-input resize-none"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Needed by">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="request-input" />
        </Field>
        <Field label="Template">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="request-input">
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <button
        onClick={submit}
        disabled={submitting}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : submitLabel} <IconArrowRight size={14} />
      </button>
      <style>{`.request-input { width: 100%; border-radius: 0.5rem; border: 1px solid hsl(var(--glass-border, 0 0% 100%/0.1)); background: hsl(var(--background, 0 0% 0%)/0.4); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .request-input:focus { border-color: hsl(var(--primary)/0.5); }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
