import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { IconUtm, IconCopy, IconCheck, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { InfoTooltip } from "@/components/ui-custom/InfoTooltip";
import { PanelSkeleton } from "@/components/ui-custom/TabSkeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tools/all-utms")({
  component: () => <AllUtmsContent />,
});

type UtmRow = {
  id: string;
  label: string | null;
  final_url: string;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  created_at: string;
};

type ShortLinkRow = {
  utm_link_id: string | null;
  click_count: number | null;
};

export function AllUtmsContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<UtmRow[] | null>(null);
  const [clicks, setClicks] = useState<Record<string, number>>({});
  const [hasTracking, setHasTracking] = useState(false);
  const [filter, setFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("default_org_id")
        .eq("id", userId)
        .single();
      const orgId = p?.default_org_id;
      if (!orgId) {
        if (!cancelled) setRows([]);
        return;
      }
      const [utmRes, shortRes] = await Promise.all([
        supabase
          .from("utm_links")
          .select("id,label,final_url,utm_campaign,utm_medium,utm_source,created_at")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("short_links")
          .select("utm_link_id,click_count")
          .eq("org_id", orgId)
          .not("utm_link_id", "is", null),
      ]);
      if (cancelled) return;
      const list = (utmRes.data ?? []) as UtmRow[];
      const counts: Record<string, number> = {};
      let anyTracking = false;
      for (const s of (shortRes.data ?? []) as ShortLinkRow[]) {
        if (!s.utm_link_id) continue;
        anyTracking = true;
        counts[s.utm_link_id] = (counts[s.utm_link_id] ?? 0) + (s.click_count ?? 0);
      }
      setRows(list);
      setClicks(counts);
      setHasTracking(anyTracking);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.label, r.final_url, r.utm_campaign, r.utm_medium, r.utm_source]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [rows, filter]);

  const copy = async (id: string, url: string) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedId(id);
      toast.success("Link copied");
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    } else {
      toast.error("Couldn't copy");
    }
  };


  return (
    <div className={hideHeader ? "focused-fill-canvas flex min-h-[calc(100vh-17rem)] flex-col gap-6" : "space-y-8"}>
      {!hideHeader && (
        <ToolHeader
          eyebrow="UTM Builder"
          title="All"
          accent="UTMs"
          hue={275}
          icon={<IconUtm size={22} />}
          description="Every tracked link you've generated. Click counts come from short-link redirects."
        />
      )}

      <GlassPanel tier="strong" className="readable-glass-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg">Saved UTM links</h2>
            <span className="text-xs text-muted-foreground">
              {rows ? `${filtered?.length ?? 0} of ${rows.length}` : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Filter by URL, campaign, channel…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-64 max-w-full rounded-full border border-glass-border bg-background/40 px-4 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Link
              to="/tools"
              search={{ focus: "utm-campaign-name" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/25"
            >
              New UTM <IconArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="mt-5">
          {!rows ? (
            <PanelSkeleton lines={6} />
          ) : filtered && filtered.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-glass-border">
              <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto] gap-3 border-b border-glass-border bg-glass/30 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <div>URL</div>
                <div>Campaign</div>
                <div>Channel</div>
                <div className="text-right">Clicks</div>
                <div />
              </div>
              <ul className="divide-y divide-glass-border">
                {filtered.map((r) => {
                  const count = clicks[r.id];
                  const hasCount = typeof count === "number";
                  return (
                    <li
                      key={r.id}
                      className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto] items-center gap-3 px-4 py-3 text-sm transition hover:bg-glass/30"
                    >
                      <div className="min-w-0">
                        {r.label && (
                          <div className="truncate font-medium text-foreground">{r.label}</div>
                        )}
                        <a
                          href={r.final_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-muted-foreground hover:text-foreground"
                          title={r.final_url}
                        >
                          {r.final_url}
                        </a>
                      </div>
                      <div className="truncate text-xs text-foreground/90" title={r.utm_campaign ?? ""}>
                        {r.utm_campaign || <span className="text-muted-foreground">—</span>}
                      </div>
                      <div className="truncate text-xs text-foreground/90">
                        {r.utm_medium ? (
                          <span className="inline-flex items-center rounded-full border border-glass-border bg-glass/40 px-2 py-0.5">
                            {r.utm_medium}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="text-right text-sm tabular-nums">
                        {hasCount ? (
                          <span className="font-medium text-foreground">{count.toLocaleString()}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            —
                            <InfoTooltip>Connect tracking to enable. Generate a short link for this UTM to start counting clicks.</InfoTooltip>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(r.id, r.final_url)}
                        aria-label="Copy URL"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-glass-border bg-glass/40 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                      >
                        {copiedId === r.id ? <IconCheck size={12} /> : <IconCopy size={12} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-glass-border bg-glass/20 p-10 text-center">
              <div className="font-display text-base">No UTM links yet</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Mint your first tracked link from the UTM Builder.
              </p>
              <Link
                to="/tools"
                search={{ focus: "utm-campaign-name" }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/25"
              >
                New UTM <IconArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-glass-border bg-glass/20 p-6 text-center text-sm text-muted-foreground">
              No links match "{filter}".
            </div>
          )}
        </div>

        {!hasTracking && rows && rows.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground/80">
            Click counts show a dash until you generate short links — those redirects are what record the clicks.
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
