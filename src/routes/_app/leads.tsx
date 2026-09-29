import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { PanelError } from "@/components/ui-custom/PanelError";
import { DemoDataBanner } from "@/components/ui-custom/DemoDataBanner";
import {
  IconArrowRight,
  IconClose,
  IconFunnel,
  IconPlus,
  IconEdit,
  IconTrash,
} from "@/components/ui-custom/CustomIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";


type SearchParams = {
  stage?: string;
  source?: string;
  channel?: string;
  q?: string;
  sort?: SortKey;
};

type SortKey =
  | "activity_desc"
  | "activity_asc"
  | "name_asc"
  | "name_desc"
  | "stage_asc";

const STAGES: { id: string; label: string; hex: string }[] = [
  { id: "lead", label: "Leads", hex: "oklch(0.78 0.15 200)" },
  { id: "mql", label: "MQL", hex: "oklch(0.74 0.17 250)" },
  { id: "sql", label: "SQL", hex: "oklch(0.7 0.2 290)" },
  { id: "opp", label: "Opps", hex: "oklch(0.7 0.2 330)" },
  { id: "won", label: "Won", hex: "oklch(0.78 0.18 145)" },
];

const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const Route = createFileRoute("/_app/leads")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    stage: typeof s.stage === "string" ? s.stage : undefined,
    source: typeof s.source === "string" ? s.source : undefined,
    channel: typeof s.channel === "string" ? s.channel : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    sort: typeof s.sort === "string" ? (s.sort as SortKey) : undefined,
  }),
  component: LeadsPage,
});

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  company: string | null;
  title: string | null;
  stage: string;
  source: string | null;
  channel: string | null;
  notes: string | null;
  last_activity_on: string;
  created_at: string;
  is_sample?: boolean;
};

function LeadsPage() {
  const orgId = useOrgId();
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [allRows, setAllRows] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const reload = () => setReloadTick((t) => t + 1);

  const stage = search.stage ?? "__all__";
  const source = search.source ?? "__all__";
  const channel = search.channel ?? "__all__";
  const q = search.q ?? "";
  const sort: SortKey = search.sort ?? "activity_desc";

  const setSearch = (patch: Partial<SearchParams>) => {
    navigate({
      search: (prev: SearchParams) => {
        const next: SearchParams = { ...prev, ...patch };
        // Strip "all" sentinels so the URL stays clean
        (Object.keys(next) as (keyof SearchParams)[]).forEach((k) => {
          if (next[k] === "__all__" || next[k] === "") delete next[k];
        });
        return next;
      },
      replace: true,
    });
  };

  // Single fetch — pull all org contacts once, then filter/sort/count in memory.
  // Re-running on every filter change caused visible lag; client-side derivation
  // makes tab and filter switches instant.
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setError(null);
    (async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id, full_name, email, company, title, stage, source, channel, notes, last_activity_on, created_at, is_sample",
        )
        .eq("org_id", orgId)
        .order("last_activity_on", { ascending: false })
        .limit(2000);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setAllRows([]);
        return;
      }
      setAllRows((data ?? []) as Contact[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, reloadTick]);

  // Distinct option lists derived from the FULL data set so options don't
  // disappear when a filter narrows the view.
  const { sources, channels } = useMemo(() => {
    const s = new Set<string>();
    const c = new Set<string>();
    (allRows ?? []).forEach((r) => {
      if (r.source) s.add(r.source);
      if (r.channel) c.add(r.channel);
    });
    return {
      sources: Array.from(s).sort(),
      channels: Array.from(c).sort(),
    };
  }, [allRows]);

  // Rows with every filter EXCEPT stage applied — used for stage counts so
  // each tab shows its true size under the current source/channel/search.
  const preStageRows = useMemo(() => {
    if (!allRows) return null;
    const term = q.trim().toLowerCase();
    return allRows.filter((r) => {
      if (source !== "__all__" && r.source !== source) return false;
      if (channel !== "__all__" && r.channel !== channel) return false;
      if (term) {
        const hay =
          (r.full_name ?? "").toLowerCase() +
          " " +
          (r.email ?? "").toLowerCase() +
          " " +
          (r.company ?? "").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [allRows, source, channel, q]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (preStageRows ?? []).forEach((r) => {
      counts[r.stage] = (counts[r.stage] ?? 0) + 1;
    });
    return counts;
  }, [preStageRows]);

  // Final filtered + sorted rows for the table.
  const rows = useMemo(() => {
    if (!preStageRows) return null;
    const filtered =
      stage === "__all__"
        ? preStageRows
        : preStageRows.filter((r) => r.stage === stage);
    const stageOrder: Record<string, number> = Object.fromEntries(
      STAGES.map((s, i) => [s.id, i]),
    );
    const sorted = [...filtered];
    switch (sort) {
      case "activity_asc":
        sorted.sort((a, b) =>
          a.last_activity_on.localeCompare(b.last_activity_on),
        );
        break;
      case "name_asc":
        sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
        break;
      case "name_desc":
        sorted.sort((a, b) => b.full_name.localeCompare(a.full_name));
        break;
      case "stage_asc":
        sorted.sort((a, b) => {
          const sa = stageOrder[a.stage] ?? 99;
          const sb = stageOrder[b.stage] ?? 99;
          if (sa !== sb) return sa - sb;
          return b.last_activity_on.localeCompare(a.last_activity_on);
        });
        break;
      default:
        sorted.sort((a, b) =>
          b.last_activity_on.localeCompare(a.last_activity_on),
        );
    }
    return sorted;
  }, [preStageRows, stage, sort]);
  const updateContactStage = async (c: Contact, nextStage: string) => {
    if (nextStage === c.stage) return;
    const prev = allRows;
    // Optimistic update
    setAllRows((rs) =>
      rs ? rs.map((r) => (r.id === c.id ? { ...r, stage: nextStage } : r)) : rs,
    );
    const { error } = await supabase
      .from("contacts")
      .update({ stage: nextStage })
      .eq("id", c.id);
    if (error) {
      setAllRows(prev);
      toast.error(error.message);
    } else {
      toast.success(`Moved to ${STAGE_BY_ID[nextStage]?.label ?? nextStage}`);
    }
  };

  const hasFilter =
    stage !== "__all__" ||
    source !== "__all__" ||
    channel !== "__all__" ||
    q.trim().length > 0;



  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={200} size={26} icon={<IconFunnel size={22} />} aria-label="Leads" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pipeline</div>
            <h1 className="mt-1 font-display text-4xl tracking-tight">
              Leads &amp; contacts

            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Every person flowing through your funnel — sort, filter, and open
              a record.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/funnel"
            className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass/30 px-2.5 py-1.5 text-xs text-foreground/80 hover:text-foreground"
          >
            ← Back to funnel
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <IconPlus size={14} /> New lead
          </button>
        </div>
      </div>

      {(allRows ?? []).some((r) => r.is_sample) && (
        <DemoDataBanner
          storageKey="leads-sample"
          label="Sample data — these contacts were seeded so the funnel isn't empty. Replace them with your own or clear them in Settings."
          ctaHref="#"
        />
      )}




      <StageTabBar
        active={stage}
        counts={stageCounts}
        onChange={(v) => setSearch({ stage: v })}
      />

      <GlassPanel className="p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Search name, email, company…"
            value={q}
            onChange={(e) => setSearch({ q: e.target.value })}
            className="h-9"
          />
          <Select
            value={source}
            onValueChange={(v) => setSearch({ source: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={channel}
            onValueChange={(v) => setSearch({ channel: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All channels</SelectItem>
              {channels.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(v) => setSearch({ sort: v as SortKey })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activity_desc">Newest activity</SelectItem>
              <SelectItem value="activity_asc">Oldest activity</SelectItem>
              <SelectItem value="name_asc">Name A→Z</SelectItem>
              <SelectItem value="name_desc">Name Z→A</SelectItem>
              <SelectItem value="stage_asc">Grouped by stage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilter && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {rows?.length ?? 0} contact{(rows?.length ?? 0) === 1 ? "" : "s"}{" "}
              match{(rows?.length ?? 0) === 1 ? "es" : ""}
            </span>
            <button
              onClick={() =>
                navigate({ search: {}, replace: true })
              }
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <IconClose className="h-3 w-3" /> Reset filters
            </button>
          </div>
        )}
      </GlassPanel>

      {error ? (
        <PanelError
          message={`Couldn't load leads — ${error}`}
          onRetry={reload}
        />
      ) : rows === null ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <GlassSkeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyLeadsState
          hasFilter={hasFilter}
          onReset={() => navigate({ search: {}, replace: true })}
        />
      ) : (
        <GlassPanel className="overflow-hidden p-0">
          <div className="grid grid-cols-[1.6fr_1.2fr_0.9fr_0.8fr_0.7fr] gap-3 border-b border-glass-border/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <div>Name</div>
            <div className="hidden sm:block">Company</div>
            <div className="hidden md:block">Source</div>
            <div>Stage</div>
            <div className="text-right">Activity</div>
          </div>
          <ul className="divide-y divide-glass-border/40">
            {rows.map((c) => {
              return (
                <li
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="grid cursor-pointer grid-cols-[1.6fr_1.2fr_0.9fr_0.8fr_0.7fr] items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-foreground/[0.04]"
                >

                  <div className="min-w-0">
                    <div className="truncate text-foreground/90">
                      {c.full_name}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {c.email ?? "—"}
                    </div>
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <div className="truncate text-foreground/85">
                      {c.company ?? "—"}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {c.title ?? ""}
                    </div>
                  </div>
                  <div className="hidden truncate text-foreground/75 md:block">
                    {c.source ?? "—"}
                    {c.channel ? (
                      <span className="text-muted-foreground"> · {c.channel}</span>
                    ) : null}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <InlineStagePicker
                      contact={c}
                      onChange={(next) => updateContactStage(c, next)}
                    />
                  </div>
                  <div className="text-right font-mono text-[11px] text-muted-foreground">
                    {formatActivityShort(c.last_activity_on)}
                  </div>

                </li>
              );
            })}
          </ul>
        </GlassPanel>
      )}
      <ContactDetailDialog
        contact={selected}
        onClose={() => setSelected(null)}
        onEdit={(c) => {
          setSelected(null);
          setEditing(c);
        }}
        onDelete={(c) => {
          setSelected(null);
          setPendingDelete(c);
        }}
      />
      <ContactFormDialog
        open={creating || !!editing}
        contact={editing}
        orgId={orgId}
        userId={user?.id}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          reload();
        }}
      />
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent className="border-glass-border bg-background/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.full_name} will be removed from your contacts. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingDelete) return;
                const { error } = await supabase
                  .from("contacts")
                  .delete()
                  .eq("id", pendingDelete.id);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                toast.success("Lead deleted");
                setPendingDelete(null);
                reload();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatActivityShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "—";
  const diffMs = Date.now() - d.getTime();
  const day = 86_400_000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateLong(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ContactDetailDialog({
  contact,
  onClose,
  onEdit,
  onDelete,
}: {
  contact: Contact | null;
  onClose: () => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
}) {
  const s = contact ? STAGE_BY_ID[contact.stage] : null;
  const initials = contact
    ? contact.full_name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";
  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden border-glass-border bg-background/95 p-0 backdrop-blur-xl">
        {contact && (
          <>
            {/* Header with subtle stage-tinted wash */}
            <div
              className="relative px-6 pb-5 pt-6"
              style={{
                background: s?.hex
                  ? `linear-gradient(180deg, color-mix(in oklab, ${s.hex} 14%, transparent), transparent 90%)`
                  : undefined,
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background: s?.hex
                    ? `linear-gradient(90deg, transparent, ${s.hex}, transparent)`
                    : undefined,
                }}
              />
              {s && (
                <div className="mb-3 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-3 w-[2px] rounded-full"
                    style={{ background: s.hex }}
                  />
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.18em]"
                    style={{ color: s.hex }}
                  >
                    {s.label}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border font-display text-lg"
                  style={{
                    color: s?.hex,
                    borderColor: s?.hex
                      ? `color-mix(in oklab, ${s.hex} 40%, transparent)`
                      : undefined,
                    background: s?.hex
                      ? `color-mix(in oklab, ${s.hex} 10%, transparent)`
                      : undefined,
                  }}
                >
                  {initials || "?"}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <DialogTitle className="truncate font-display text-xl leading-tight">
                    {contact.full_name}
                  </DialogTitle>
                  <DialogDescription className="mt-1 truncate text-xs">
                    {[contact.title, contact.company]
                      .filter(Boolean)
                      .join(" · ") || "No company on file"}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5">
              <DialogHeader className="sr-only">
                <DialogTitle>{contact.full_name}</DialogTitle>
              </DialogHeader>

              <dl className="divide-y divide-glass-border/40 border-y border-glass-border/40">
                <DetailRow label="Email" value={contact.email} mono />
                <DetailRow label="Company" value={contact.company} />
                <DetailRow label="Title" value={contact.title} />
                <DetailRow label="Source" value={contact.source} />
                <DetailRow label="Channel" value={contact.channel} />
                <DetailRow
                  label="Last activity"
                  value={formatDateLong(contact.last_activity_on)}
                />
                <DetailRow
                  label="Added"
                  value={formatDateLong(contact.created_at)}
                />
              </dl>

              {contact.notes && (
                <div className="mt-4 rounded-lg border border-glass-border bg-glass/30 p-3 text-sm text-foreground/80">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Notes
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {contact.notes}
                  </p>
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={() => onDelete(contact)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass/30 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
                >
                  <IconTrash size={12} /> Delete
                </button>
                <button
                  onClick={() => onEdit(contact)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass/30 px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:text-foreground"
                >
                  <IconEdit size={12} /> Edit
                </button>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    Email <IconArrowRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}

      </dt>
      <dd
        className={`truncate text-foreground/90 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}


function StageTabBar({
  active,
  counts,
  onChange,
}: {
  active: string;
  counts: Record<string, number>;
  onChange: (v: string) => void;
}) {
  const total = STAGES.reduce((sum, s) => sum + (counts[s.id] ?? 0), 0);
  const tabs: { id: string; label: string; hex?: string; count: number }[] = [
    { id: "__all__", label: "All", count: total },
    ...STAGES.map((s) => ({
      id: s.id,
      label: s.label,
      hex: s.hex,
      count: counts[s.id] ?? 0,
    })),
  ];
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="flex min-w-max items-stretch gap-2">
        {tabs.map((t) => {
          const isActive = active === t.id;
          const accent = t.hex ?? "hsl(var(--foreground) / 0.5)";
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              aria-pressed={isActive}
              className={
                "group relative flex shrink-0 items-center gap-3 rounded-lg pl-2.5 pr-3.5 py-2 text-left transition-all " +
                (isActive
                  ? "bg-foreground/[0.06]"
                  : "hover:bg-foreground/[0.03]")
              }
            >
              <span
                aria-hidden
                className={
                  "h-7 w-[3px] rounded-full transition-all " +
                  (isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70")
                }
                style={{ background: accent }}
              />
              <span className="flex flex-col leading-none">
                <span
                  className={
                    "text-[9px] font-medium uppercase tracking-[0.14em] transition-colors " +
                    (isActive ? "text-foreground/80" : "text-muted-foreground/70")
                  }
                >
                  {t.label}
                </span>
                <span
                  className={
                    "mt-1 font-display text-lg tabular-nums leading-none transition-colors " +
                    (isActive ? "text-foreground" : "text-foreground/60")
                  }
                >
                  {t.count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}



function EmptyLeadsState({
  hasFilter,
  onReset,
}: {
  hasFilter: boolean;
  onReset: () => void;
}) {
  return (
    <GlassPanel className="relative overflow-hidden p-10 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <h2 className="font-display text-xl">
          {hasFilter ? "No matching contacts" : "No contacts yet"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasFilter
            ? "Try widening the filters above — your data is just hiding behind a narrow view."
            : "Once leads start flowing through your funnel, every person will show up here."}
        </p>
        <div className="flex justify-center gap-2 pt-1">
          {hasFilter && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-lg border border-glass-border bg-glass/30 px-3 py-1.5 text-xs hover:bg-glass/50"
            >
              <IconClose className="h-3 w-3" /> Reset filters
            </button>
          )}
          <Link
            to="/funnel"
            className="inline-flex items-center gap-1 rounded-lg border border-glass-border bg-glass/30 px-3 py-1.5 text-xs hover:bg-glass/50"
          >
            Open funnel <IconArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </GlassPanel>
  );
}

function ContactFormDialog({
  open,
  contact,
  orgId,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean;
  contact: Contact | null;
  orgId: string | null | undefined;
  userId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!contact;
  const today = new Date().toISOString().slice(0, 10);
  const empty = {
    full_name: "",
    email: "",
    company: "",
    title: "",
    stage: "lead",
    source: "",
    channel: "",
    notes: "",
    last_activity_on: today,
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (contact) {
      setForm({
        full_name: contact.full_name ?? "",
        email: contact.email ?? "",
        company: contact.company ?? "",
        title: contact.title ?? "",
        stage: contact.stage ?? "lead",
        source: contact.source ?? "",
        channel: contact.channel ?? "",
        notes: contact.notes ?? "",
        last_activity_on: contact.last_activity_on ?? today,
      });
    } else {
      setForm(empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact]);

  const set =
    <K extends keyof typeof form>(k: K) =>
    (v: (typeof form)[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.full_name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!orgId || !userId) {
      toast.error("Workspace not ready");
      return;
    }
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      company: form.company.trim() || null,
      title: form.title.trim() || null,
      stage: form.stage,
      source: form.source.trim() || null,
      channel: form.channel.trim() || null,
      notes: form.notes.trim() || null,
      last_activity_on: form.last_activity_on || today,
    };
    const { error } = isEdit
      ? await supabase.from("contacts").update(payload).eq("id", contact!.id)
      : await supabase
          .from("contacts")
          .insert({ ...payload, org_id: orgId, created_by: userId });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "Lead updated" : "Lead added");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg border-glass-border bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {isEdit ? "Edit lead" : "New lead"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit
              ? "Update this contact's information."
              : "Add a contact to your funnel."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Full name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name")(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Company</Label>
            <Input
              value={form.company}
              onChange={(e) => set("company")(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Stage</Label>
            <Select
              value={form.stage}
              onValueChange={(v) => set("stage")(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Last activity</Label>
            <Input
              type="date"
              value={form.last_activity_on}
              onChange={(e) => set("last_activity_on")(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Input
              value={form.source}
              onChange={(e) => set("source")(e.target.value)}
              placeholder="google, partner, event…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Channel</Label>
            <Input
              value={form.channel}
              onChange={(e) => set("channel")(e.target.value)}
              placeholder="email, paid-social…"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-lg border border-glass-border bg-glass/30 px-3 py-1.5 text-xs hover:bg-glass/50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add lead"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineStagePicker({
  contact,
  onChange,
}: {
  contact: Contact;
  onChange: (nextStage: string) => void;
}) {
  const s = STAGE_BY_ID[contact.stage];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Change stage (currently ${s?.label ?? contact.stage})`}
          className="group inline-flex items-center gap-2 rounded-md px-1.5 py-1 -ml-1.5 transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:bg-foreground/[0.06]"
        >
          <span
            aria-hidden
            className="h-3.5 w-[2px] rounded-full"
            style={{ background: s?.hex }}
          />
          <span
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: s?.hex }}
          >
            {s?.label ?? contact.stage}
          </span>
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="h-2.5 w-2.5 opacity-0 transition-opacity text-muted-foreground group-hover:opacity-100 group-data-[state=open]:opacity-100"
          >
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {STAGES.map((opt) => {
          const active = opt.id === contact.stage;
          return (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden
                className="h-3 w-[2px] rounded-full"
                style={{ background: opt.hex }}
              />
              <span
                className="text-[11px] font-medium uppercase tracking-[0.14em]"
                style={{ color: opt.hex }}
              >
                {opt.label}
              </span>
              {active && (
                <span className="ml-auto text-[10px] text-muted-foreground">current</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
