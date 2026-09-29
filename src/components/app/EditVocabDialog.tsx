import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IconCheck, IconSettings, IconEdit, IconPlus } from "@/components/ui-custom/CustomIcon";
import { Trash2 } from "lucide-react";

type Table = "taxonomy_settings" | "utm_settings";

type Props = {
  table: Table;
  column: string;
  orgId: string | null;
  label: string;
  help?: string;
  values: string[];
  defaults: string[];
  onSaved: (next: string[]) => void;
  /** Small inline trigger; defaults to a "Manage" pill */
  trigger?: React.ReactNode;
};

/**
 * Inline "Manage" dialog with add, inline rename (click pencil), and delete (trash)
 * for a vocabulary list stored on a Supabase column for the user's org.
 */
export function EditVocabDialog({
  table, column, orgId, label, help, values, defaults, onSaved, trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(values);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingVal, setEditingVal] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(values);
      setEditingIdx(null);
      setEditingVal("");
      setInput("");
    }
  }, [open, values]);

  useEffect(() => {
    if (editingIdx !== null) {
      requestAnimationFrame(() => editRef.current?.focus());
    }
  }, [editingIdx]);

  const normalize = (raw: string) =>
    raw.trim().toLowerCase().replace(/\s+/g, "-");

  const add = (raw: string) => {
    const items = raw.split(/[,\n]/).map(normalize).filter(Boolean);
    if (!items.length) return;
    const next = [...draft];
    for (const it of items) if (!next.includes(it)) next.push(it);
    setDraft(next);
    setInput("");
  };

  const remove = (idx: number) => {
    setDraft(draft.filter((_, i) => i !== idx));
    if (editingIdx === idx) {
      setEditingIdx(null);
      setEditingVal("");
    }
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditingVal(draft[idx]);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const v = normalize(editingVal);
    if (!v) {
      // empty rename = cancel
      setEditingIdx(null);
      setEditingVal("");
      return;
    }
    // Reject if it would duplicate another entry
    const dupAt = draft.findIndex((x, i) => i !== editingIdx && x === v);
    if (dupAt !== -1) {
      toast.error(`"${v}" already exists`);
      return;
    }
    const next = [...draft];
    next[editingIdx] = v;
    setDraft(next);
    setEditingIdx(null);
    setEditingVal("");
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditingVal("");
  };

  const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    }
  };

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const save = async () => {
    if (!orgId) { toast.error("No organization"); return; }
    // Compute the final list inline so an in-progress rename is included
    // (setState from commitEdit doesn't update `draft` in this closure).
    let finalDraft = draft;
    if (editingIdx !== null) {
      const v = normalize(editingVal);
      if (v) {
        const dupAt = draft.findIndex((x, i) => i !== editingIdx && x === v);
        if (dupAt !== -1) {
          toast.error(`"${v}" already exists`);
          return;
        }
        finalDraft = draft.map((x, i) => (i === editingIdx ? v : x));
        setDraft(finalDraft);
      }
      setEditingIdx(null);
      setEditingVal("");
    }
    setSaving(true);
    const { error } = await supabase
      .from(table)
      .update({ [column]: finalDraft } as never)
      .eq("org_id", orgId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved(finalDraft);
    toast.success(`${label} updated`);
    setOpen(false);
  };

  const missing = defaults.filter((d) => !draft.includes(d));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80 transition hover:text-foreground"
          >
            <IconSettings size={10} /> Manage
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage {label.toLowerCase()}</DialogTitle>
          {help && <DialogDescription>{help}</DialogDescription>}
        </DialogHeader>

        {/* Add new */}
        <div className="flex items-center gap-2 rounded-xl border border-glass-border bg-glass/40 px-3 py-2 focus-within:border-primary/60">
          <IconPlus size={14} className="text-muted-foreground" />
          <input
            ref={addRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onAddKey}
            onBlur={() => input && add(input)}
            placeholder={`Add ${label.toLowerCase().replace(/s$/, "")}…`}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {input.trim() && (
            <button
              type="button"
              onClick={() => add(input)}
              className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/25"
            >
              Add
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-glass-border/60 bg-glass/20 p-1.5">
          {draft.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No {label.toLowerCase()} yet. Add one above.
            </div>
          ) : (
            draft.map((v, i) => {
              const isEditing = editingIdx === i;
              return (
                <div
                  key={`${v}-${i}`}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-glass/50"
                >
                  {isEditing ? (
                    <input
                      ref={editRef}
                      value={editingVal}
                      onChange={(e) => setEditingVal(e.target.value)}
                      onKeyDown={onEditKey}
                      onBlur={commitEdit}
                      className="flex-1 rounded-md border border-primary/60 bg-background/60 px-2 py-1 font-mono text-xs outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(i)}
                      title="Click to rename"
                      className="flex-1 text-left font-mono text-xs text-foreground/90"
                    >
                      {v}
                    </button>
                  )}
                  {!isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(i)}
                        aria-label={`Rename ${v}`}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-glass-strong hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                      >
                        <IconEdit size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label={`Delete ${v}`}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {missing.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Suggestions:{" "}
            {missing.map((d) => (
              <button
                key={d}
                onClick={() => add(d)}
                className="mr-1 rounded-full border border-glass-border bg-glass/40 px-2 py-0.5 font-mono text-[11px] hover:bg-glass-strong"
              >
                + {d}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full border border-glass-border bg-glass px-4 py-2 text-sm hover:bg-glass-strong"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <IconCheck size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
