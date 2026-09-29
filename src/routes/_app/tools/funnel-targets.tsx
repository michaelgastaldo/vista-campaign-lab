import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import { IconFunnel, IconCheck } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tools/funnel-targets")({
  component: () => <FunnelTargetsContent />,
});

type Workspace = { id: string; name: string };
type Target = {
  id: string;
  year_month: string;
  mql_target: number;
  sqo_target: number;
  workspace_id: string | null;
};

function monthsAhead(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export function FunnelTargetsContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [scope, setScope] = useState<string>("__org__");
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const months = useMemo(() => monthsAhead(12), []);

  const reload = async (oid: string) => {
    const { data } = await supabase
      .from("funnel_targets")
      .select("id, year_month, mql_target, sqo_target, workspace_id")
      .eq("org_id", oid);
    setTargets((data ?? []) as Target[]);
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("default_org_id").eq("id", user.id).single();
      const oid = p?.default_org_id ?? null;
      setOrgId(oid);
      if (oid) {
        const { data: w } = await supabase
          .from("workspaces")
          .select("id, name")
          .eq("org_id", oid)
          .order("created_at", { ascending: false });
        setWorkspaces((w ?? []) as Workspace[]);
        await reload(oid);
      }
      setLoading(false);
    })();
  }, [user]);

  const get = (m: string): Target | undefined =>
    targets.find(
      (t) => t.year_month === m && (scope === "__org__" ? t.workspace_id === null : t.workspace_id === scope),
    );

  const orgDefault = (m: string): Target | undefined =>
    targets.find((t) => t.year_month === m && t.workspace_id === null);

  const upsert = async (m: string, patch: Partial<Pick<Target, "mql_target" | "sqo_target">>) => {
    if (!orgId || !user) return;
    setSaving(m);
    const existing = get(m);
    const row = {
      org_id: orgId,
      created_by: user.id,
      year_month: m,
      workspace_id: scope === "__org__" ? null : scope,
      mql_target: existing?.mql_target ?? 0,
      sqo_target: existing?.sqo_target ?? 0,
      ...patch,
    };
    const { error } = await supabase.from("funnel_targets").upsert(row, {
      onConflict: "org_id,workspace_id,year_month",
    });
    setSaving(null);
    if (error) toast.error(error.message);
    else {
      await reload(orgId);
      toast.success("Saved");
    }
  };

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <ToolHeader
          eyebrow="Settings · funnel"
          title="MQL & SQO"
          accent="targets."
          hue={200}
          icon={<IconFunnel size={24} />}
          ariaLabel="Targets"
          description="Monthly targets feed the Funnel Dashboard. Set an organization default; override per workspace when needed."
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">Scope</div>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="field-glass rounded-xl px-3 py-2 text-sm"
        >
          <option value="__org__">Organization default</option>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              Workspace · {w.name}
            </option>
          ))}
        </select>
        {scope !== "__org__" && (
          <span className="text-sm font-medium text-foreground/85">
            Blank fields fall back to the org default for that month.
          </span>
        )}
      </div>

      <div className="glass flex items-start gap-3 rounded-xl border border-glass-border px-4 py-3 text-sm text-muted-foreground">
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold">i</span>
        <span>
          Targets are stored in-app and work out of the box. Live funnel actuals require{" "}
          <Link to="/connectors" className="text-primary hover:underline">a CRM connection</Link>.
        </span>
      </div>

      <GlassPanel className="overflow-hidden p-0">
        {loading ? (
          <div className="p-4"><GlassSkeleton rows={6} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Month</th>
                <th className="px-4 py-3 text-right">MQL target</th>
                <th className="px-4 py-3 text-right">SQO target</th>
                <th className="px-4 py-3 text-right">Implied MQL→SQO</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const t = get(m);
                const fallback = scope !== "__org__" ? orgDefault(m) : undefined;
                const mql = t?.mql_target ?? fallback?.mql_target ?? 0;
                const sqo = t?.sqo_target ?? fallback?.sqo_target ?? 0;
                const conv = mql > 0 ? Math.round((sqo / mql) * 1000) / 10 : 0;
                return (
                  <tr key={m} className="border-t border-glass-border">
                    <td className="px-4 py-3 font-mono text-xs">{m.slice(0, 7)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        defaultValue={t?.mql_target ?? ""}
                        placeholder={fallback ? String(fallback.mql_target) : "0"}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        onBlur={(e) => {
                          const v = Number(e.target.value || 0);
                          if (v !== (t?.mql_target ?? 0)) upsert(m, { mql_target: v });
                        }}
                        className="w-24 rounded-lg glass border border-glass-border bg-transparent px-2 py-1 text-right text-sm outline-none focus:border-primary/60"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        defaultValue={t?.sqo_target ?? ""}
                        placeholder={fallback ? String(fallback.sqo_target) : "0"}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        onBlur={(e) => {
                          const v = Number(e.target.value || 0);
                          if (v !== (t?.sqo_target ?? 0)) upsert(m, { sqo_target: v });
                        }}
                        className="w-24 rounded-lg glass border border-glass-border bg-transparent px-2 py-1 text-right text-sm outline-none focus:border-primary/60"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {conv > 0 ? `${conv}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {saving === m ? (
                        <span className="text-sm font-medium text-foreground/85">Saving…</span>
                      ) : t ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <IconCheck size={12} /> saved
                        </span>
                      ) : fallback ? (
                        <span className="text-sm font-medium text-foreground/85">org default</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </GlassPanel>
    </div>
  );
}
