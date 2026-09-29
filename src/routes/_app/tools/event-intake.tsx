import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDraft } from "@/hooks/use-draft";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  IconTrophy,
  IconChevronLeft,
  IconArrowRight,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/hooks/use-org";
import { toast } from "sonner";
import { z } from "zod";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/tools/event-intake")({
  component: () => <HackathonRequestContent />,
  head: () => ({
    meta: [
      { title: `Event request — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Submit an event sponsorship or hosting request. Marketing will follow up.",
      },
    ],
  }),
});

const EVENT_TYPES = [
  { value: "conference", label: "Conference" },
  { value: "hackathon", label: "Hackathon" },
  { value: "meetup", label: "Meetup" },
  { value: "webinar", label: "Webinar" },
  { value: "other", label: "Other" },
] as const;

const schema = z.object({
  requesterEmail: z.string().trim().email("Valid email required").max(255),
  company: z.string().trim().min(1).max(120),
  eventType: z.enum(["conference", "hackathon", "meetup", "webinar", "other"]).optional(),
  eventName: z.string().trim().min(1).max(160),
  eventDate: z.string().trim().min(1, "Date required"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

// Export name kept for import compatibility across the tools registry.
export function HackathonRequestContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const orgId = useOrgId();
  const [form, setForm, { clearDraft }] = useDraft("tools/hackathon-request:form", {
    requesterEmail: "",
    company: "",
    eventType: "" as "" | (typeof EVENT_TYPES)[number]["value"],
    eventName: "",
    eventDate: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set =
    (k: "requesterEmail" | "company" | "eventName" | "eventDate" | "notes") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, eventType: form.eventType === "" ? undefined : form.eventType };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!orgId) {
      toast.error("Workspace not ready yet");
      return;
    }
    setSubmitting(true);
    const typeLabel = parsed.data.eventType
      ? EVENT_TYPES.find((t) => t.value === parsed.data.eventType)?.label ?? "Event"
      : "Event";
    const brief = `${typeLabel}: ${parsed.data.eventName}\nCompany: ${parsed.data.company}\nDate: ${parsed.data.eventDate}\n\n${parsed.data.notes ?? ""}`;
    const { error } = await supabase.from("campaign_requests").insert({
      org_id: orgId,
      requestor_email: parsed.data.requesterEmail,
      brief,
      status: "new",
      desired_due_date: parsed.data.eventDate,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't submit. Try again.");
      return;
    }
    setDone(true);
    clearDraft();
  };

  if (done) {
    return (
      <div className="space-y-6">
        {!hideHeader && (
          <Link
            to="/tools"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <IconChevronLeft size={14} /> Back to tools
          </Link>
        )}
        <GlassPanel className="p-10 text-center">
          <div className="font-display text-3xl">Request received</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            We've added it to the requests queue. Marketing will follow up shortly.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              to="/requests"
              className="rounded-full border border-glass-border px-4 py-2 text-sm hover:bg-glass"
            >
              View requests
            </Link>
            <Link
              to="/tools"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              Back to tools <IconArrowRight size={14} />
            </Link>
          </div>
        </GlassPanel>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      {!hideHeader && (
        <>
          <Link
            to="/tools"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <IconChevronLeft size={14} /> Back to tools
          </Link>

          <header className="flex items-start gap-4">
            <PageHexBadge hue={340} icon={<IconTrophy size={26} />} aria-label="Event request" />
            <div>
              <h1 className="font-display text-3xl md:text-4xl">Event request</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Submit an event sponsorship or hosting request — conference, hackathon,
                meetup, webinar, or something else. The marketing team will triage it from
                your Requests queue.
              </p>
            </div>
          </header>
        </>
      )}
      <p className="-mt-3 text-sm text-muted-foreground">
        Submitted requests land in your{" "}
        <Link to="/requests" className="text-primary hover:underline">Requests queue</Link>{" "}
        for triage, and appear on the{" "}
        <Link to="/calendar" className="text-primary hover:underline">Calendar</Link>{" "}
        on their due date.
      </p>

      <GlassPanel className="p-6">
        <form onSubmit={submit} className="space-y-7">
          <fieldset className="space-y-4">
            <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Your contact
            </legend>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground/85">Your email *</Label>
              <Input
                type="email"
                value={form.requesterEmail}
                onChange={set("requesterEmail")}
                className="glass border-glass-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground/85">Company / organization *</Label>
              <Input
                value={form.company}
                onChange={set("company")}
                className="glass border-glass-border"
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Event details
            </legend>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground/85">Event type</Label>
              <Select
                value={form.eventType || undefined}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, eventType: v as typeof f.eventType }))
                }
              >
                <SelectTrigger className="glass border-glass-border">
                  <SelectValue placeholder="Select an event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground/85">Event name *</Label>
                <Input
                  value={form.eventName}
                  onChange={set("eventName")}
                  className="glass border-glass-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground/85">Event date *</Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={set("eventDate")}
                  className="glass border-glass-border"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground/85">Notes</Label>
              <Textarea
                rows={4}
                placeholder="Format, audience size, what you're asking for, etc."
                value={form.notes}
                onChange={set("notes")}
                className="glass border-glass-border"
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit request"}
            <IconArrowRight size={14} />
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
