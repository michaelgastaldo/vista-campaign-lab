import { createFileRoute } from "@tanstack/react-router";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  IconBolt,
  IconCopy,
  IconArrowRight,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import {
  INTEGRATIONS,
  CATEGORIES,
  METHOD_META,
  buildPromptFor,
  type IntegrationEntry,
  type IntegrationMethod,
  type IntegrationCat,
} from "@/data/integrations-catalog";
import { INTEGRATION_RECIPES } from "@/data/integration-recipes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRAND } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsPage,
});



type MethodTab = "all" | IntegrationMethod;

const METHOD_TABS: MethodTab[] = ["all", "connector", "api-key", "oauth-app", "webhook"];

function IntegrationLogo({
  slug,
  name,
  size = 40,
}: {
  slug?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (slug && !failed) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-xl bg-white shadow-inner ring-1 ring-black/5"
        style={{ width: size, height: size }}
      >
        <img
          src={`https://cdn.simpleicons.org/${slug}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: size * 0.58, height: size * 0.58 }}
        />
      </div>
    );
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 font-display text-base text-foreground/80 shadow-inner"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function MethodBadge({ method }: { method: IntegrationMethod }) {
  const meta = METHOD_META[method];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${meta.tone} px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-white/10`}
    >
      {meta.short}
    </span>
  );
}

function IntegrationsPage() {
  const [method, setMethod] = useState<MethodTab>("all");
  const [cat, setCat] = useState<IntegrationCat | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<IntegrationEntry | null>(null);

  const counts = useMemo(() => {
    const c: Record<MethodTab, number> = {
      all: INTEGRATIONS.length,
      connector: 0,
      "api-key": 0,
      "oauth-app": 0,
      webhook: 0,
    };
    for (const i of INTEGRATIONS) c[i.method] += 1;
    return c;
  }, []);

  const filtered = useMemo(() => {
    return INTEGRATIONS.filter((i) => {
      if (method !== "all" && i.method !== method) return false;
      if (cat !== "all" && i.category !== cat) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !i.name.toLowerCase().includes(q) &&
          !i.blurb.toLowerCase().includes(q) &&
          !i.category.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [method, cat, query]);

  // Categories that exist within the active method filter — keep the row tight.
  const activeCategories = useMemo(() => {
    const set = new Set<IntegrationCat>();
    for (const i of INTEGRATIONS) {
      if (method === "all" || i.method === method) set.add(i.category);
    }
    return CATEGORIES.filter((c) => set.has(c));
  }, [method]);

  return (
    <div className="space-y-8">
      {/* ----- Header ----- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={200} size={26} icon={<IconBolt size={22} />} aria-label="Integrations" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bring your stack</div>
            <h1 className="mt-1 font-display text-4xl tracking-tight">Integrations</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {BRAND.name} is a template — every team's stack is different. Pick a setup method below; each tile gives you
              a copy-paste prompt tuned for that path so Lovable wires it into your remix correctly.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-glass-border bg-glass/40 px-4 py-3 text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Available</div>
          <div className="font-display text-2xl tabular-nums">{INTEGRATIONS.length}</div>
        </div>
      </div>

      {/* ----- Primary: setup-method segmented tabs ----- */}
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full items-stretch gap-1 rounded-2xl border border-glass-border bg-glass/30 p-1">
            {METHOD_TABS.map((m) => {
              const on = method === m;
              const label = m === "all" ? "All" : METHOD_META[m].label;
              return (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId="method-tab-pill"
                      className="absolute inset-0 rounded-xl bg-glass-strong ring-1 ring-primary/30"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{label}</span>
                  <span
                    className={`relative rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      on ? "bg-primary/20 text-primary" : "bg-glass/60 text-muted-foreground"
                    }`}
                  >
                    {counts[m]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* explanation line for the active method */}
        <AnimatePresence mode="wait">
          <motion.p
            key={method}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.15 }}
            className="text-xs leading-relaxed text-muted-foreground"
          >
            {method === "all"
              ? "Every option, grouped by how you wire it up. The badge on each card tells you which path it follows."
              : METHOD_META[method as IntegrationMethod].description}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ----- Secondary: category + search ----- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border pb-3">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Category
          </span>
          <button
            onClick={() => setCat("all")}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              cat === "all"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {activeCategories.map((c) => {
            const on = cat === c;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                  on
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search integrations…"
          className="w-full max-w-xs rounded-lg border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none md:w-64"
        />
      </div>

      {/* ----- Grid ----- */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-glass-border bg-glass/20 p-10 text-center text-sm text-muted-foreground">
          No integrations match those filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => {
            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <GlassPanel
                  onClick={() => setSelected(entry)}
                  className="flex h-full cursor-pointer flex-col gap-3 p-5 transition-colors hover:bg-glass-strong"
                >
                  <div className="flex items-start gap-3">
                    <IntegrationLogo slug={entry.slug} name={entry.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg leading-tight">{entry.name}</h3>
                        <MethodBadge method={entry.method} />
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {entry.category}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {entry.blurb}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      {entry.method === "connector"
                        ? "Get connect prompt"
                        : entry.method === "api-key"
                        ? "Get API-key prompt"
                        : entry.method === "oauth-app"
                        ? "Get OAuth prompt"
                        : "Get webhook prompt"}{" "}
                      <IconArrowRight size={12} />
                    </span>
                  </div>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      )}

      <PromptDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Prompt dialog                                                              */
/* -------------------------------------------------------------------------- */

function PromptDialog({
  entry,
  onClose,
}: {
  entry: IntegrationEntry | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"prompt" | "how">("prompt");

  useEffect(() => {
    if (entry) setTab("prompt");
  }, [entry]);

  const prompt = useMemo(() => (entry ? buildPromptFor(entry) : ""), [entry]);
  const recipe = useMemo(
    () => (entry?.recipeId ? INTEGRATION_RECIPES.find((r) => r.id === entry.recipeId) : null),
    [entry],
  );

  const copyPrompt = async () => {
    if (!prompt) return;
    await copyToClipboard(prompt);
    toast.success("Prompt copied — paste it into Lovable chat");
  };

  if (!entry) return null;
  const meta = METHOD_META[entry.method];

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{entry.name}</DialogTitle>
        </DialogHeader>
        <AnimatePresence mode="wait">
          <motion.div
            key={entry.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-start gap-4 border-b border-glass-border bg-black/20 p-6">
              <IntegrationLogo slug={entry.slug} name={entry.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>{entry.category}</span>
                  <span className="opacity-50">·</span>
                  <MethodBadge method={entry.method} />
                </div>
                <h2 className="mt-1 font-display text-2xl">{entry.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{entry.blurb}</p>
              </div>
            </div>

            <div className="border-b border-glass-border px-6">
              <div className="flex gap-1">
                {(["prompt", "how"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`relative px-3 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${
                      tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "prompt" ? "Prompt" : `How "${meta.short}" works`}
                    {tab === t && (
                      <motion.span
                        layoutId="prompt-tab"
                        className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-6">
              {tab === "prompt" && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Copy this and paste it into Lovable chat. It tells Lovable to wire {entry.name} in via the{" "}
                    <strong className="text-foreground">{meta.label}</strong> path — including the right server
                    functions, secrets, and UI placement.
                  </div>
                  <div className="relative">
                    <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-glass-border bg-black/40 p-4 font-mono text-xs leading-relaxed text-foreground/90">
                      {prompt}
                    </pre>
                    <button
                      onClick={copyPrompt}
                      className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-glass-border bg-glass/60 px-2.5 py-1.5 text-xs hover:bg-glass-strong"
                    >
                      <IconCopy size={12} /> Copy
                    </button>
                  </div>
                  {recipe && (
                    <div className="rounded-xl border border-glass-border bg-glass/40 p-3 text-xs text-muted-foreground">
                      <strong className="text-foreground">Heads up:</strong> a richer setup recipe for {entry.name}{" "}
                      already exists in this template — the prompt above will produce the same scaffolding for the{" "}
                      <em>{meta.label}</em> path.
                    </div>
                  )}
                </div>
              )}

              {tab === "how" && (
                <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                  <div>{meta.description}</div>
                  {entry.method === "connector" && (
                    <ul className="list-disc space-y-1.5 pl-5">
                      <li>OAuth flow is handled by Lovable's connector picker — no developer console.</li>
                      <li>API calls are proxied through <code className="text-foreground">https://connector-gateway.lovable.dev/{entry.connectorId}/...</code> — never the raw provider URL.</li>
                      <li>This authenticates as <em>your</em> account, so anyone using the app sees the same data. Use Per-user OAuth if each user needs their own.</li>
                      {entry.scopes && (
                        <li>Suggested scopes: <code className="text-foreground">{entry.scopes}</code></li>
                      )}
                    </ul>
                  )}
                  {entry.method === "api-key" && (
                    <ul className="list-disc space-y-1.5 pl-5">
                      <li>You'll generate a key in the provider dashboard and paste it into Lovable's secret prompt.</li>
                      <li>Stored as <code className="text-foreground">{entry.id.toUpperCase()}_API_KEY</code>, server-only, never bundled to the browser.</li>
                      <li>One key powers the whole workspace — fine for server-to-server, not for "each user has their own account".</li>
                      {entry.dashboardUrl && (
                        <li>
                          Get the key here:{" "}
                          <a
                            href={entry.dashboardUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary hover:opacity-80"
                          >
                            {entry.dashboardUrl}
                          </a>
                        </li>
                      )}
                    </ul>
                  )}
                  {entry.method === "oauth-app" && (
                    <ul className="list-disc space-y-1.5 pl-5">
                      <li>You create an OAuth app in {entry.provider}'s developer console — Lovable can't do this for you.</li>
                      <li>Each end-user clicks "Connect" and grants access to <em>their own</em> account.</li>
                      <li>Tokens are stored per-user with RLS, and refreshed automatically before they expire.</li>
                      {entry.scopes && (
                        <li>Required scopes: <code className="text-foreground">{entry.scopes}</code></li>
                      )}
                    </ul>
                  )}
                  {entry.method === "webhook" && (
                    <ul className="list-disc space-y-1.5 pl-5">
                      <li>{entry.name} POSTs events to a public route in your app — no OAuth, no API key.</li>
                      <li>Signature verification is non-negotiable: every payload is checked with <code className="text-foreground">timingSafeEqual</code> against a stored signing secret.</li>
                      <li>Events land in <code className="text-foreground">webhook_events</code> and route to the relevant feature.</li>
                    </ul>
                  )}
                  {entry.docsUrl && (
                    <div className="pt-1">
                      <a
                        href={entry.docsUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:opacity-80"
                      >
                        Provider docs <IconArrowRight size={11} />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-glass-border bg-black/20 px-6 py-4">
              <div className="text-[11px] text-muted-foreground">
                <IconBolt size={11} className="-mt-0.5 inline" /> {meta.label} path
              </div>
              <button
                onClick={copyPrompt}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <IconCopy size={12} /> Copy prompt
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
