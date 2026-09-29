import { useMemo, useState } from "react";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconSearch, IconClose, IconChevronDown } from "@/components/ui-custom/CustomIcon";
import { cn } from "@/lib/utils";

export type CalendarFilterValue = {
  search: string;
  statuses: string[];
  channels: string[];
  types: string[];
  showCampaigns: boolean;
  showPosts: boolean;
};

export const EMPTY_FILTERS: CalendarFilterValue = {
  search: "",
  statuses: [],
  channels: [],
  types: [],
  showCampaigns: true,
  showPosts: true,
};

const STATUS_OPTIONS = ["draft", "planning", "live", "complete", "archived"];

type Props = {
  value: CalendarFilterValue;
  onChange: (next: CalendarFilterValue) => void;
  availableChannels: string[];
  availableTypes: string[];
  totalVisible: number;
  totalAll: number;
};

export function CalendarFilters({
  value,
  onChange,
  availableChannels,
  availableTypes,
  totalVisible,
  totalAll,
}: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = useMemo(
    () =>
      (value.search ? 1 : 0) +
      value.statuses.length +
      value.channels.length +
      value.types.length +
      (!value.showCampaigns ? 1 : 0) +
      (!value.showPosts ? 1 : 0),
    [value],
  );

  const toggle = (key: "statuses" | "channels" | "types", v: string) => {
    const cur = value[key];
    onChange({
      ...value,
      [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    });
  };

  return (
    <GlassPanel className="overflow-hidden p-0">
      {/* Always-visible top row: search + segmented + filter toggle */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="relative flex-1 min-w-[220px]">
          <IconSearch
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Search campaigns, posts…"
            className="h-9 w-full rounded-lg border border-glass-border bg-background/40 pl-8 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <div className="inline-flex rounded-lg border border-glass-border bg-background/40 p-0.5 text-xs">
          <SegBtn
            active={value.showCampaigns && value.showPosts}
            onClick={() => onChange({ ...value, showCampaigns: true, showPosts: true })}
          >
            All
          </SegBtn>
          <SegBtn
            active={value.showCampaigns && !value.showPosts}
            onClick={() => onChange({ ...value, showCampaigns: true, showPosts: false })}
          >
            Campaigns
          </SegBtn>
          <SegBtn
            active={!value.showCampaigns && value.showPosts}
            onClick={() => onChange({ ...value, showCampaigns: false, showPosts: true })}
          >
            Posts
          </SegBtn>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border border-glass-border bg-background/40 px-3 text-xs transition hover:border-primary/40",
            (open || activeCount > 0) && "border-primary/40 text-primary",
          )}
        >
          Filters
          {activeCount > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 font-mono text-[10px] text-primary">
              {activeCount}
            </span>
          )}
          <IconChevronDown
            size={12}
            className={cn("transition", open && "rotate-180")}
          />
        </button>

        {activeCount > 0 && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <IconClose size={12} />
            Clear
          </button>
        )}

        <div className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {totalVisible} of {totalAll}
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-glass-border bg-background/20 px-4 py-4">
          <FacetRow label="Status">
            {STATUS_OPTIONS.map((s) => (
              <Chip key={s} active={value.statuses.includes(s)} onClick={() => toggle("statuses", s)}>
                {s}
              </Chip>
            ))}
          </FacetRow>
          {availableChannels.length > 0 && (
            <FacetRow label="Channel">
              {availableChannels.map((c) => (
                <Chip
                  key={c}
                  active={value.channels.includes(c)}
                  onClick={() => toggle("channels", c)}
                >
                  {c}
                </Chip>
              ))}
            </FacetRow>
          )}
          {availableTypes.length > 0 && (
            <FacetRow label="Type">
              {availableTypes.map((t) => (
                <Chip key={t} active={value.types.includes(t)} onClick={() => toggle("types", t)}>
                  {t.replace(/_/g, " ")}
                </Chip>
              ))}
            </FacetRow>
          )}
        </div>
      )}
    </GlassPanel>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 transition",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] capitalize transition",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-glass-border bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
