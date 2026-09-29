import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import { IconSettings, IconPlus, IconClose } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tools/taxonomy")({
  component: () => <TaxonomyContent />,
});


type Row = {
  id: string;
  category: string;
  value: string;
  label: string;
  position: number;
  archived: boolean;
};

const CATEGORIES = ["event", "webinar", "other"] as const;

export function TaxonomyContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState<(typeof CATEGORIES)[number]>("event");

  const reload = async (oid: string) => {
    const { data } = await supabase
      .from("org_campaign_types")
      .select("id, category, value, label, position, archived")
      .eq("org_id", oid)
      .order("category")
      .order("position");
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("default_org_id").eq("id", user.id).single();
      const oid = p?.default_org_id ?? null;
      setOrgId(oid);
      if (oid) await reload(oid);
      setLoading(false);
    })();
  }, [user]);

  const add = async () => {
    if (!orgId || !newLabel.trim()) return;
    const value = newLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
    const pos = rows.filter((r) => r.category === newCategory).length;
    const { error } = await supabase.from("org_campaign_types").insert({
      org_id: orgId,
      category: newCategory,
      value,
      label: newLabel.trim(),
      position: pos,
    });
    if (error) return toast.error(error.message);
    setNewLabel("");
    await reload(orgId);
  };

  const toggleArchive = async (r: Row) => {
    if (!orgId) return;
    await supabase.from("org_campaign_types").update({ archived: !r.archived }).eq("id", r.id);
    await reload(orgId);
  };

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <ToolHeader
          eyebrow="Settings · vocabulary"
          title="Campaign type"
          accent="taxonomy."
          hue={275}
          icon={<IconSettings size={24} />}
          ariaLabel="Naming conventions"
          description="The list of campaign types available in the Campaign Creator. Edits affect everyone in this organization."
        />
      )}

      <GlassPanel className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">Add a type</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as (typeof CATEGORIES)[number])}
            className="rounded-xl glass border border-glass-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/60"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Partner Webinar"
            className="min-w-[240px] flex-1 rounded-xl glass border border-glass-border px-3 py-2 text-sm outline-none focus:border-primary/60"
          />
          <button
            onClick={add}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <IconPlus size={14} /> Add
          </button>
        </div>
      </GlassPanel>

      {loading ? (
        <GlassSkeleton rows={5} />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const items = rows.filter((r) => r.category === cat);
            return (
              <GlassPanel key={cat} className="p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">{cat}</div>
                <ul className="mt-3 space-y-2">
                  {items.length === 0 && <li className="text-sm font-medium text-foreground/85">No types yet.</li>}
                  {items.map((r) => (
                    <li
                      key={r.id}
                      className={`flex items-center justify-between rounded-xl border border-glass-border px-3 py-2 text-sm ${
                        r.archived ? "opacity-50" : ""
                      }`}
                    >
                      <div>
                        <div>{r.label}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{r.value}</div>
                      </div>
                      <button
                        onClick={() => toggleArchive(r)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        title={r.archived ? "Restore" : "Archive"}
                      >
                        {r.archived ? "Restore" : <IconClose size={14} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
