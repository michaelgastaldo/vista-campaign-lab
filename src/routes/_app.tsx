import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import {
  IconLogo,
  IconHome,
  IconWorkspace,
  IconCalendar,
  IconTemplate,
  IconCampaign,
  IconUtm,
  IconSettings,
  IconCommand,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconBolt,
  IconSearch,
  IconFunnel,
  IconSpark,
  IconAudience,
  IconImport,
  IconChart,

} from "@/components/ui-custom/CustomIcon";
import { CommanderAI } from "@/components/app/CommanderAI";
import { CommandPalette } from "@/components/app/CommandPalette";
import { CommanderOrb } from "@/components/app/CommanderOrb";

// Commander is an LLM copilot that can propose DB writes. Off by default in
// the remix template — set VITE_COMMANDER_ENABLED=true in .env to turn it on
// after reviewing the safety model in src/lib/commander.functions.ts.
const COMMANDER_ENABLED = import.meta.env.VITE_COMMANDER_ENABLED === "true";
import { BottomNav } from "@/components/app/BottomNav";
import { UserMenu } from "@/components/app/UserMenu";
import { OnboardingChecklist } from "@/components/app/OnboardingChecklist";
import { GuidedTour } from "@/components/tour/GuidedTour";
import { RouteProgressBar } from "@/components/app/RouteProgressBar";
import { BrandHexLogo } from "@/components/app/BrandHexLogo";
import { BRAND } from "@/lib/brand";

import { AutosaveStatus } from "@/components/app/AutosaveStatus";
import { purgeExpiredDrafts } from "@/hooks/use-draft";
import { getCachedOnboardedAt } from "@/hooks/use-onboarding-status";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

const PRIMARY_NAV = [
  { to: "/dashboard", label: "This week", Icon: IconHome },
  { to: "/campaigns", label: "Campaigns", Icon: IconWorkspace },
  { to: "/leads", label: "Leads", Icon: IconAudience },
  { to: "/tools", label: "Marketing tools", Icon: IconCampaign },
  { to: "/calendar", label: "Calendar", Icon: IconCalendar },
  { to: "/requests", label: "Requests", Icon: IconClock },
  { to: "/templates", label: "Templates", Icon: IconTemplate },
] as const;

type ToolChild = { to: string; label: string; Icon: typeof IconCampaign; search?: Record<string, string> };
type ToolItem = ToolChild & { id: string; children?: ToolChild[] };

const MARKETING_TOOLS: ToolItem[] = [
  {
    id: "campaign",
    to: "/tools",
    search: { focus: "campaign" },
    label: "Campaign-in-a-box",
    Icon: IconCampaign,
    children: [
      { to: "/tools", search: { focus: "campaign-creator" }, label: "Name Generator", Icon: IconCampaign },
      { to: "/tools", search: { focus: "campaign-import" }, label: "List Import", Icon: IconImport },
      { to: "/tools", search: { focus: "campaign-events" }, label: "Events", Icon: IconCalendar },
    ],
  },
  {
    id: "funnel",
    to: "/tools",
    search: { focus: "funnel" },
    label: "Funnel targets",
    Icon: IconFunnel,
    children: [
      { to: "/tools", search: { focus: "funnel-targets" }, label: "Overview", Icon: IconSpark },
      { to: "/tools", search: { focus: "funnel-performance" }, label: "Performance", Icon: IconChart },
    ],
  },
  {
    id: "utm",
    to: "/tools",
    search: { focus: "utm" },
    label: "UTM Builder",
    Icon: IconUtm,
    children: [
      { to: "/tools", search: { focus: "utm" }, label: "New UTM", Icon: IconSpark },
      { to: "/tools", search: { focus: "utm-all" }, label: "All UTMs", Icon: IconSpark },
      { to: "/tools", search: { focus: "utm-taxonomy" }, label: "Naming conventions", Icon: IconSpark },
    ],
  },
];

function ActiveBloom() {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2"
      style={{ width: "120%" }}
    >
      <motion.span
        aria-hidden
        initial={{ scaleX: 0.6, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        style={{
          transformOrigin: "center bottom",
          background:
            "radial-gradient(ellipse 60% 100% at 50% 100%, oklch(0.78 0.18 305 / 0.45), oklch(0.72 0.2 275 / 0.2) 40%, transparent 70%)",
        }}
        className="pointer-events-none absolute bottom-0 left-0 h-6 w-full"
      />
      <motion.span
        aria-hidden
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          transformOrigin: "center",
          background:
            "linear-gradient(90deg, transparent, oklch(0.78 0.18 305 / 0.95) 50%, transparent)",
        }}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full"
      />
    </motion.span>
  );
}



function AppShell() {
  const { session, loading, user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const focusParam = ((loc.search as Record<string, unknown> | undefined)?.focus as string) ?? "";
  const pathnameRef = useRef(loc.pathname);

  useEffect(() => {
    pathnameRef.current = loc.pathname;
  });

  const isToolsRoute = loc.pathname.startsWith("/tools") || loc.pathname.startsWith("/funnel");
  const [toolsOpenState, setToolsOpenState] = useState<{ manualOpen: boolean; routeCollapsedFor: string | null }>({
    manualOpen: false,
    routeCollapsedFor: null,
  });
  const toolsOpen = isToolsRoute
    ? toolsOpenState.routeCollapsedFor !== loc.pathname
    : toolsOpenState.manualOpen;
  const closeToolsTree = useCallback(() => {
    setToolsOpenState((prev) =>
      prev.manualOpen || prev.routeCollapsedFor !== null
        ? { manualOpen: false, routeCollapsedFor: null }
        : prev,
    );
  }, []);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("sidebar:collapsed");
    if (stored === "1") return true;
    if (stored === "0") return false;
    // First visit: auto-collapse on tablet widths so the hex grid doesn't clip.
    return window.innerWidth < 1024;
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);
  // Auto-collapse when the viewport crosses below 1024px (e.g. resize / rotate).
  // Tracks last seen width so we don't fight the user's manual toggle on desktop.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastWide = window.innerWidth >= 1024;
    const onResize = () => {
      const wide = window.innerWidth >= 1024;
      if (lastWide && !wide) setCollapsed(true);
      lastWide = wide;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    purgeExpiredDrafts();
  }, []);

  // Tour hook: force the sidebar's Marketing tools subtree open on demand.
  useEffect(() => {
    const onExpand = () => setToolsOpenState((prev) =>
      prev.manualOpen && prev.routeCollapsedFor === null ? prev : { manualOpen: true, routeCollapsedFor: null },
    );
    window.addEventListener("lovable:tour-expand-tools", onExpand);
    return () => window.removeEventListener("lovable:tour-expand-tools", onExpand);
  }, []);


  // First-run gate: send to /welcome until onboarded.
  // Run once per signed-in user (not on every navigation) so sidebar clicks
  // don't kick off duplicate profile fetches and re-render the shell.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const onboardedAt = await getCachedOnboardedAt(user.id);
      if (cancelled || onboardedAt) return;
      if (window.location.pathname.startsWith("/welcome")) return;
      nav({ to: "/welcome", replace: true });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!loading && !session) {
      nav({
        to: "/login",
        search: { redirect: pathnameRef.current, mode: "signin" },
        replace: true,
      });
    }
    // Fragile: this guard must not depend on location.pathname. Re-running the
    // auth redirect effect on every sidebar click was a source of nav churn.
  }, [loading, session, nav]);

  if (loading || !session) {
    // Keep this branch deterministic. A delayed blank→splash→app sequence was
    // the visible auth flash; the auth provider now dedupes initialization, so
    // a single stable loading tree is safer than a timed tree swap.
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[color:var(--color-ink)]">
        <GradientMesh />
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center gap-5"
        >
          <motion.div
            animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-glass/60 backdrop-blur-xl ring-1 ring-glass-border"
          >
            <IconLogo size={28} className="text-primary" />
          </motion.div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="font-display tracking-wide">
              {loading ? `Booting ${BRAND.name}` : "Redirecting to sign in"}
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[color:var(--color-ink)] text-foreground">
      <GradientMesh />
      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar (desktop) — sticky + collapsible */}
        <aside
          data-tour="sidebar"
          className={`sticky top-0 hidden h-screen shrink-0 self-start overflow-y-auto border-r border-glass-border bg-black/20 backdrop-blur-xl transition-[width] duration-200 md:flex md:flex-col ${
            collapsed ? "w-16" : "w-64"
          }`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center px-1" : "justify-between gap-1 px-4"} py-5`}>
            <Link to="/" className="flex min-w-0 items-center gap-2 text-foreground">
              <BrandHexLogo size={collapsed ? 32 : 34} />
              {!collapsed && <span className="font-display text-base tracking-tight truncate">{BRAND.name}</span>}
            </Link>
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-glass/60 hover:text-foreground"
              >
                <IconChevronLeft size={16} />
              </button>
            )}
          </div>
          {collapsed && (
            <div className="px-2 pb-2">
              <button
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                className="inline-flex h-7 w-full items-center justify-center rounded-md text-muted-foreground transition hover:bg-glass/60 hover:text-foreground"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          )}

          {!collapsed && (
            <div className="px-3 pb-2">
              <SidebarSearch />
            </div>
          )}

          <nav className={`flex-1 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
            {PRIMARY_NAV.map((n) => {
              const active =
                n.to === "/tools"
                  ? loc.pathname === "/tools" || loc.pathname.startsWith("/tools/")
                  : loc.pathname.startsWith(n.to);
              const isToolsItem = n.to === "/tools";
              return (
                <div key={n.to}>
                  <Link
                    to={n.to}
                    preload="render"
                    title={collapsed ? n.label : undefined}
                    data-tour={`nav-${n.to}`}
                    onClick={isToolsItem ? undefined : closeToolsTree}
                    className={`relative flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} rounded-xl py-2.5 text-sm transition-colors duration-150 ${
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-glass/50 hover:text-foreground"
                    }`}
                  >
                    <span className="relative z-10 inline-flex">
                      <n.Icon size={18} className={active ? "text-primary" : ""} />
                      {active && collapsed && <ActiveBloom />}
                    </span>

                    {!collapsed && (
                      <span className="relative z-10 flex-1">
                        <span className="relative inline-block">
                          {n.label}
                          {active && <ActiveBloom />}
                        </span>
                      </span>
                    )}
                    {!collapsed && isToolsItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setToolsOpenState((prev) =>
                            isToolsRoute
                              ? {
                                  manualOpen: prev.manualOpen,
                                  routeCollapsedFor: prev.routeCollapsedFor === loc.pathname ? null : loc.pathname,
                                }
                              : { manualOpen: !prev.manualOpen, routeCollapsedFor: null },
                          );
                        }}
                        aria-label={toolsOpen ? "Collapse tools" : "Expand tools"}
                        className="relative z-10 -mr-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                      >
                        <motion.span animate={{ rotate: toolsOpen ? 0 : -90 }} transition={{ duration: 0.18 }}>
                          <IconChevronDown size={14} />
                        </motion.span>
                      </button>
                    )}
                  </Link>

                  {/* Marketing tools sub-tree (inline under the nav item) */}
                  {isToolsItem && !collapsed && (
                    <AnimatePresence initial={false}>
                      {toolsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-3 mt-1 space-y-0.5 border-l border-glass-border/60 pl-2">
                            {MARKETING_TOOLS.map((t) => (
                              <ToolBranch
                                key={t.id}
                                tool={t}
                                loc={loc}
                                focus={focusParam}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              );
            })}


            <div className="pt-4 space-y-1">
              <Link
                to="/settings"
                preload="render"
                title={collapsed ? "Settings" : undefined}
                data-tour="nav-settings"
                className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} rounded-xl py-2.5 text-sm transition-colors ${
                  loc.pathname.startsWith("/settings")
                    ? "bg-glass text-foreground"
                    : "text-muted-foreground hover:bg-glass/50 hover:text-foreground"
                }`}
              >
                <IconSettings size={18} />
                {!collapsed && <span>Settings</span>}
              </Link>
              <Link
                to="/integrations"
                preload="render"
                title={collapsed ? "Integrations" : undefined}
                data-tour="nav-integrations"
                className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} rounded-xl py-2.5 text-sm transition-colors ${
                  loc.pathname.startsWith("/integrations") || loc.pathname.startsWith("/connectors")
                    ? "bg-glass text-foreground"
                    : "text-muted-foreground hover:bg-glass/50 hover:text-foreground"
                }`}
              >
                <IconBolt size={18} />
                {!collapsed && <span>Integrations</span>}
              </Link>
            </div>
          </nav>

          {COMMANDER_ENABLED && (
            <div className={`${collapsed ? "m-2" : "m-3"} space-y-1`}>
              <button
                onClick={() => {
                  const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                  window.dispatchEvent(ev);
                }}
                title={collapsed ? `Ask ${BRAND.shortName} AI (⌘K)` : undefined}
                className={`group flex w-full items-center ${collapsed ? "justify-center px-0" : "justify-between gap-3 px-3"} rounded-xl border border-glass-border bg-glass/40 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass-strong hover:text-foreground`}
              >
                <span className={`inline-flex items-center ${collapsed ? "" : "gap-2"}`}>
                  <CommanderOrb size={18} />
                  {!collapsed && <span className="font-display">Ask {BRAND.shortName} AI</span>}

                </span>
                {!collapsed && <kbd className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>}
              </button>
            </div>
          )}
        </aside>

        {COMMANDER_ENABLED && <CommanderAI />}
        {!COMMANDER_ENABLED && <CommandPalette />}

        <main className="flex-1 min-w-0 overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-0">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-glass-border bg-black/50 px-4 py-3 backdrop-blur-xl md:hidden">
            <Link to="/dashboard" className="flex items-center gap-2 text-foreground">
              <BrandHexLogo size={26} />
              <span className="font-display text-base tracking-tight">{BRAND.name}</span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                  window.dispatchEvent(ev);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass/40 px-2.5 py-1.5 text-xs text-muted-foreground"
                aria-label="Open command palette"
              >
                <IconCommand size={14} />
                <span>Search</span>
              </button>
            </div>
          </header>
          {/* Single user-control mount for both mobile and desktop. Hidden CSS
              duplicates still mount React effects, which previously caused
              duplicate profile/checklist fetches and visible post-load churn. */}
          <div className="pointer-events-none fixed right-4 top-3 z-40 flex items-center gap-2 md:right-5 md:top-4">
            <div className="pointer-events-auto hidden md:block">
              <AutosaveStatus />
            </div>
            <div className="pointer-events-auto">
              <OnboardingChecklist variant="pill" />
            </div>
            <div className="pointer-events-auto">
              <UserMenu />
            </div>
          </div>

          {/* Mobile autosave status sits inline below header */}
          <div className="sticky top-[57px] z-20 flex justify-end px-4 pt-2 md:hidden">
            <AutosaveStatus />
          </div>
          <div
            className={`mx-auto w-full pb-10 pt-6 transition-[padding,max-width] duration-200 md:pt-20 ${
              loc.pathname === "/tools" ? "max-w-full px-0" : "max-w-6xl px-4 sm:px-6"
            }`}
          >
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
      <RouteProgressBar />
      <GuidedTour />
    </div>
  );
}

/** Smart sidebar search — fuzzy filter over tools; Enter jumps to the top hit.
 *  ⌘K opens the full command palette for deeper search. */
function SidebarSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const flat = useMemo(
    () =>
      MARKETING_TOOLS.flatMap((t) => [
        { label: t.label, to: t.to, search: t.search, Icon: t.Icon, parent: null as string | null },
        ...(t.children ?? []).map((c) => ({
          label: c.label,
          to: c.to,
          search: c.search,
          Icon: c.Icon,
          parent: t.label,
        })),
      ]),
    [],
  );

  const ql = q.trim().toLowerCase();
  const hits = useMemo(
    () =>
      ql
        ? flat.filter(
            (x) =>
              x.label.toLowerCase().includes(ql) ||
              (x.parent ?? "").toLowerCase().includes(ql),
          )
        : [],
    [flat, ql],
  );

  const go = (h: (typeof flat)[number]) => {
    setQ("");
    setOpen(false);
    navigate({ to: h.to as never, search: (h.search ?? {}) as never });
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-glass-border bg-glass/40 px-2.5 py-1.5 text-sm text-muted-foreground focus-within:border-primary/40 focus-within:text-foreground">
        <IconSearch size={14} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) {
              e.preventDefault();
              go(hits[0]);
            } else if (e.key === "Escape") {
              setQ("");
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search tools…"
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60"
        />
        <kbd className="hidden rounded bg-black/30 px-1 py-0.5 font-mono text-[10px] text-muted-foreground/70 md:inline">
          ⌘K
        </kbd>
      </div>
      <AnimatePresence>
        {open && ql && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-glass-border bg-black/80 p-1 backdrop-blur-xl"
          >
            {hits.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
            ) : (
              hits.map((h, i) => (
                <button
                  key={`${h.to}-${h.label}-${i}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(h)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-glass-strong hover:text-foreground"
                >
                  <h.Icon size={14} className="text-primary/80" />
                  <span className="flex-1 truncate">{h.label}</span>
                  {h.parent && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      {h.parent}
                    </span>
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A primary marketing-tool row plus its (optional) children, rendered as
 *  an inline expandable branch under the Marketing tools nav item. */
function ToolBranch({
  tool,
  loc,
  focus,
}: {
  tool: ToolItem;
  loc: ReturnType<typeof useLocation>;
  focus: string;
}) {
  const matchesPath = tool.to !== "/tools" && loc.pathname.startsWith(tool.to);
  const matchesFocus =
    !!focus && (focus === tool.id || focus.startsWith(`${tool.id}-`));
  const matchesChildPath = !!tool.children?.some(
    (c) => c.to !== "/tools" && loc.pathname.startsWith(c.to),
  );
  const active = matchesPath || matchesFocus || matchesChildPath;
  const hasChildren = !!tool.children?.length;
  const [manualOpen, setManualOpen] = useState(false);
  const open = active || manualOpen;

  return (
    <div data-tour={`tool-${tool.id}`}>
      <div className="group flex items-center">
        <Link
          to={tool.to as never}
          search={(tool.search ?? {}) as never}
          preload="render"
          className={`flex flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
            active
              ? "bg-glass text-foreground"
              : "text-muted-foreground hover:bg-glass/40 hover:text-foreground"
          }`}
        >
          <tool.Icon size={14} className={active ? "text-primary" : ""} />
          <span className="truncate">{tool.label}</span>
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setManualOpen((o) => (active ? false : !o))}
            aria-label={open ? `Collapse ${tool.label}` : `Expand ${tool.label}`}
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-glass/40 hover:text-foreground"
          >
            <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.18 }}>
              <IconChevronDown size={12} />
            </motion.span>
          </button>
        )}
      </div>
      {hasChildren && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="overflow-hidden"
            >
              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-glass-border/50 pl-2">
                {tool.children!.map((c) => {
                  const subActive =
                    (c.search?.focus && focus === c.search.focus) ||
                    (!c.search && loc.pathname.startsWith(c.to));
                  return (
                    <Link
                      key={`${c.to}-${c.label}`}
                      to={c.to as never}
                      search={(c.search ?? {}) as never}
                      preload="render"
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1 text-[13px] transition-colors ${
                        subActive
                          ? "text-foreground"
                          : "text-muted-foreground/80 hover:text-foreground"
                      }`}
                    >
                      <c.Icon size={12} className={subActive ? "text-primary" : "opacity-60"} />
                      <span className="truncate">{c.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

