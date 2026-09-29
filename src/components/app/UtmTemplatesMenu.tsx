import { useEffect, useState } from "react";
import { Star, Trash2, Bookmark, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export type UtmTemplate = {
  id: string;
  name: string;
  base_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  is_default: boolean;
  created_by: string;
};

export type UtmFormValues = {
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
};

type Props = {
  orgId: string | null;
  userId: string | null;
  current: UtmFormValues;
  onApply: (t: UtmTemplate) => void;
  onDefaultLoaded?: (t: UtmTemplate) => void;
};

export function UtmTemplatesMenu({ orgId, userId, current, onApply, onDefaultLoaded }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UtmTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);

  const load = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("utm_templates")
      .select("*")
      .eq("org_id", orgId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data as UtmTemplate[]) ?? []);
    setLoaded(true);
  };

  useEffect(() => {
    load();
  }, [orgId]);

  // Auto-apply default once on first load
  useEffect(() => {
    if (!loaded || !onDefaultLoaded) return;
    const def = items.find((i) => i.is_default);
    if (def) onDefaultLoaded(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const setDefault = async (id: string) => {
    if (!orgId) return;
    // Clear any existing default first to satisfy the unique index, then set new one
    await supabase.from("utm_templates").update({ is_default: false }).eq("org_id", orgId).eq("is_default", true);
    const { error } = await supabase.from("utm_templates").update({ is_default: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Default template set");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("utm_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Template deleted");
    load();
  };

  const save = async () => {
    if (!orgId || !userId || !name.trim()) return;
    if (makeDefault) {
      await supabase.from("utm_templates").update({ is_default: false }).eq("org_id", orgId).eq("is_default", true);
    }
    const { error } = await supabase.from("utm_templates").insert({
      org_id: orgId,
      created_by: userId,
      name: name.trim(),
      base_url: current.base_url || null,
      utm_source: current.utm_source || null,
      utm_medium: current.utm_medium || null,
      utm_campaign: current.utm_campaign || null,
      utm_term: current.utm_term || null,
      utm_content: current.utm_content || null,
      is_default: makeDefault,
    });
    if (error) return toast.error(error.message);
    toast.success("Template saved");
    setSaveOpen(false);
    setName("");
    setMakeDefault(false);
    load();
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1.5 rounded-full glass border border-glass-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-glass-strong">
            <Bookmark className="size-3.5" />
            Templates
            {items.length > 0 && (
              <span className="ml-1 rounded-full bg-glass-strong px-1.5 text-[10px]">{items.length}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 glass border-glass-border">
          <div className="flex items-center justify-between border-b border-glass-border px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Saved templates</div>
            <button
              onClick={() => {
                setOpen(false);
                setSaveOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="size-3" /> Save current
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No templates yet. Save your current settings to reuse them later.
              </div>
            ) : (
              items.map((t) => (
                <div key={t.id} className="group flex items-center gap-2 px-2 py-1.5 hover:bg-glass/40">
                  <button
                    onClick={() => {
                      onApply(t);
                      setOpen(false);
                      toast.success(`Applied "${t.name}"`);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5 truncate text-sm text-foreground">
                      {t.is_default && <Star className="size-3 fill-amber-300 text-amber-300" />}
                      <span className="truncate">{t.name}</span>
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {[t.utm_source, t.utm_medium, t.utm_campaign].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </button>
                  <button
                    onClick={() => setDefault(t.id)}
                    title={t.is_default ? "Default" : "Set as default"}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-amber-300 group-hover:opacity-100"
                  >
                    <Star className={`size-3.5 ${t.is_default ? "fill-amber-300 text-amber-300 opacity-100" : ""}`} />
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    title="Delete"
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-rose-400 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="glass border-glass-border">
          <DialogHeader>
            <DialogTitle>Save UTM template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Template name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="Paid search — Google"
                className="mt-1 w-full rounded-full border border-glass-border bg-glass/30 px-4 py-2 text-sm outline-none focus:border-primary/60"
              />
            </div>
            <div className="rounded-lg border border-glass-border bg-glass/20 p-3 font-mono text-[11px] text-muted-foreground">
              <div>source: {current.utm_source || "—"}</div>
              <div>medium: {current.utm_medium || "—"}</div>
              <div>campaign: {current.utm_campaign || "—"}</div>
              {current.utm_term && <div>term: {current.utm_term}</div>}
              {current.utm_content && <div>content: {current.utm_content}</div>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
                className="size-4 accent-primary"
              />
              Set as default (auto-fills on page load)
            </label>
          </div>
          <DialogFooter>
            <button
              onClick={() => setSaveOpen(false)}
              className="rounded-full border border-glass-border bg-glass/30 px-4 py-2 text-sm hover:bg-glass-strong"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!name.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="size-4" /> Save template
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
