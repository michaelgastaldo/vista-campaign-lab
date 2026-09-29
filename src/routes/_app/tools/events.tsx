import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  IconCalendar,
  IconChevronLeft,
  IconArrowRight,
  IconTrophy,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";

export const Route = createFileRoute("/_app/tools/events")({
  component: () => <EventsContent />,
  head: () => ({
    meta: [
      { title: "Events — Campaign-in-a-box" },
      {
        name: "description",
        content:
          "Request a conference booth, hackathon, or meetup. We turn the event into a campaign with the right attribution.",
      },
    ],
  }),
});

type EventKind = {
  to: string;
  search?: Record<string, string>;
  label: string;
  desc: string;
  Icon: typeof IconTrophy;
};

const KINDS: EventKind[] = [
  {
    to: "/tools",
    search: { focus: "campaign-hackathon" },
    label: "Event request",
    desc: "Sponsor or host an event — conference, hackathon, or meetup.",
    Icon: IconTrophy,
  },
];

export function EventsContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  return (
    <div className="space-y-8">
      {!hideHeader && (
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconChevronLeft size={14} /> Back to tools
        </Link>
      )}

      {!hideHeader && (
        <header className="flex items-start gap-4">
          <PageHexBadge hue={150} icon={<IconCalendar size={26} />} aria-label="Events" />
          <div>
            <h1 className="font-display text-3xl md:text-4xl">Events</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Submit an event request and turn it into a campaign with its own
              audience, landing page, and post-event list import.
            </p>
          </div>
        </header>
      )}

      <p className="text-sm text-muted-foreground">
        Submitted requests land in your{" "}
        <Link to="/requests" className="text-primary hover:underline">Requests queue</Link>{" "}
        for triage, and appear on the{" "}
        <Link to="/calendar" className="text-primary hover:underline">Calendar</Link>{" "}
        on their due date.
      </p>



      <div className="max-w-2xl">
        {KINDS.map((k) => (
          <Link key={k.label} to={k.to} search={k.search} className="block">
            <GlassPanel
              className="flex items-center gap-5 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-glass-strong text-primary">
                <k.Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-display text-lg">
                  {k.label}
                </div>
                <div className="text-sm text-muted-foreground">{k.desc}</div>
              </div>
              <IconArrowRight size={18} className="text-muted-foreground" />
            </GlassPanel>
          </Link>
        ))}
      </div>
    </div>
  );
}
