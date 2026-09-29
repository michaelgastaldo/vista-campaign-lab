import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconImport, IconCheck, IconClose } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { VoiceMicButton } from "@/components/ui-custom/VoiceMicButton";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tools/import")({
  component: ListImportContent,
});

type Row = Record<string, string>;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ListImportContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filename, setFilename] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [map, setMap] = useState({ email: "", first_name: "", last_name: "", company: "" });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("default_org_id").eq("id", user.id).single();
      setOrgId(p?.default_org_id ?? null);
    })();
  }, [user]);

  const handleParsed = (parsed: Row[], h: string[], name: string) => {
    setFilename(name);
    setRows(parsed);
    setHeaders(h);
    const guess = (keys: string[]) => h.find((c) => keys.some((k) => c.toLowerCase().includes(k))) ?? "";
    setMap({
      email: guess(["email", "mail"]),
      first_name: guess(["first", "fname", "given"]),
      last_name: guess(["last", "surname", "lname"]),
      company: guess(["company", "org", "account"]),
    });
    setSearch("");
    setSortKey("");
  };

  const onDrop = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    if (["xlsx", "xls"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "", raw: false });
        const h = json.length ? Object.keys(json[0]) : [];
        handleParsed(json, h, f.name);
      };
      reader.readAsArrayBuffer(f);
    } else {
      Papa.parse<Row>(f, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => handleParsed(res.data, res.meta.fields ?? [], f.name),
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  // Validation: rows split by whether mapped email is valid
  const { valid, failed } = useMemo(() => {
    if (!map.email) return { valid: [] as Row[], failed: [] as Row[] };
    const v: Row[] = [];
    const f: Row[] = [];
    for (const r of rows) {
      const e = (r[map.email] ?? "").trim();
      if (e && EMAIL_RE.test(e)) v.push(r);
      else f.push(r);
    }
    return { valid: v, failed: f };
  }, [rows, map.email]);

  const fixFailedEmail = (idxInFailed: number, newEmail: string) => {
    // mutate underlying rows by reference index
    const target = failed[idxInFailed];
    const allIdx = rows.indexOf(target);
    if (allIdx < 0) return;
    const next = [...rows];
    next[allIdx] = { ...target, [map.email]: newEmail };
    setRows(next);
  };

  const removeFailed = (idxInFailed: number) => {
    const target = failed[idxInFailed];
    setRows(rows.filter((r) => r !== target));
  };

  const filteredValid = useMemo(() => {
    let list = valid;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = String(a[sortKey] ?? "").toLowerCase();
        const bv = String(b[sortKey] ?? "").toLowerCase();
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (sortDir === "asc" ? 1 : -1);
      });
    }
    return list;
  }, [valid, search, sortKey, sortDir]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    if (valid.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(valid), "Cleaned");
    if (failed.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(failed), "Failed");
    const base = filename.replace(/\.[^.]+$/, "") || "list";
    XLSX.writeFile(wb, `${base}-cleaned.xlsx`);
  };

  const submit = async () => {
    if (!orgId || !user || valid.length === 0) return;
    if (!sourceLabel.trim()) return toast.error("Give it a source label");
    if (!map.email) return toast.error("Map the email column");
    setBusy(true);
    const { data: list, error: listErr } = await supabase
      .from("imported_lists")
      .insert({
        org_id: orgId,
        created_by: user.id,
        source_label: sourceLabel,
        original_filename: filename,
        row_count: valid.length,
      })
      .select()
      .single();
    if (listErr || !list) {
      setBusy(false);
      return toast.error(listErr?.message ?? "Could not create list");
    }
    const payload = valid.map((r) => ({
      list_id: list.id,
      org_id: orgId,
      email: (r[map.email] ?? "").trim(),
      first_name: map.first_name ? r[map.first_name] ?? null : null,
      last_name: map.last_name ? r[map.last_name] ?? null : null,
      company: map.company ? r[map.company] ?? null : null,
      source_attribution: sourceLabel,
      raw: r,
    }));
    // Smaller batches: each row re-evaluates the org-membership RLS check, so
    // large inserts can exceed the database statement timeout.
    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < payload.length; i += BATCH) {
      const slice = payload.slice(i, i + BATCH);
      const { error } = await supabase.from("imported_contacts").insert(slice);
      if (error) {
        // Keep the list consistent with what actually landed instead of leaving
        // a half-imported list claiming the full row count.
        if (inserted === 0) {
          await supabase.from("imported_lists").delete().eq("id", list.id);
        } else {
          await supabase.from("imported_lists").update({ row_count: inserted }).eq("id", list.id);
        }
        setBusy(false);
        return toast.error(
          inserted === 0
            ? `Import failed, nothing was saved. ${error.message}`
            : `Import stopped after ${inserted.toLocaleString()} of ${valid.length.toLocaleString()} contacts. The list was saved with what imported — remove it and retry with a smaller file.`,
        );
      }
      inserted += slice.length;
    }
    setBusy(false);
    toast.success(`Imported ${valid.length} contacts`);
    setRows([]);
    setHeaders([]);
    setFilename("");
    setSourceLabel("");
    setMap({ email: "", first_name: "", last_name: "", company: "" });
    setSearch("");
    setSortKey("");
  };

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <div className="flex items-center gap-4">
          <PageHexBadge hue={150} icon={<IconImport size={26} />} aria-label="List import" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/70">List</div>
            <h1 className="font-display text-3xl">List import</h1>
          </div>
        </div>
      )}

      <div className="glass flex items-start gap-3 rounded-xl border border-glass-border px-4 py-3 text-sm text-muted-foreground">
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold">i</span>
        <span>
          CSV / XLSX upload works out of the box.{" "}
          <Link to="/connectors" className="text-primary hover:underline">Connect a CRM</Link>{" "}
          to import lists directly from it.
        </span>
      </div>

      <div
        {...getRootProps()}
        className={`relative cursor-pointer rounded-3xl border-2 border-dashed p-14 text-center transition ${
          isDragActive ? "border-primary bg-primary/5" : "border-glass-border glass"
        }`}
      >
        <input {...getInputProps()} />
        <div className="font-display text-2xl">
          {filename || (isDragActive ? "Drop it." : "Drop a CSV or XLSX, or click to browse")}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Post-event lists, partner exports, anything with emails.
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground/85">Source attribution label</div>
            <div className="flex items-center gap-2 rounded-2xl glass border border-glass-border px-3 py-2 focus-within:border-primary/60 transition-colors">
              <input
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder="SaaStr 2025 booth scans"
                className="flex-1 bg-transparent px-2 py-1.5 text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              <VoiceMicButton value={sourceLabel} onChange={setSourceLabel} label="Dictate source label" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(["email", "first_name", "last_name", "company"] as const).map((k) => (
              <div key={k}>
                <div className="text-sm font-medium text-foreground/85">{k}</div>
                <select
                  value={map[k]}
                  onChange={(e) => setMap({ ...map, [k]: e.target.value })}
                  className="field-glass mt-2 w-full rounded-xl px-3 py-2 font-mono text-sm"
                >
                  <option value="" className="bg-card">— skip —</option>
                  {headers.map((h) => (
                    <option key={h} value={h} className="bg-card">{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <GlassPanel className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/70">Total</div>
              <div className="mt-1 font-display text-3xl">{rows.length.toLocaleString()}</div>
            </GlassPanel>
            <GlassPanel className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-400">Valid</div>
              <div className="mt-1 font-display text-3xl text-emerald-400">{valid.length.toLocaleString()}</div>
            </GlassPanel>
            <GlassPanel className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-400">Needs fixing</div>
              <div className="mt-1 font-display text-3xl text-amber-400">{failed.length.toLocaleString()}</div>
            </GlassPanel>
          </div>

          {/* Failed editor */}
          {failed.length > 0 && map.email && (
            <GlassPanel className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-display text-xl">Fix failed rows</div>
                  <div className="text-sm text-muted-foreground">
                    Bad / missing emails. Edit in place or drop the row.
                  </div>
                </div>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-glass-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-glass/80 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Other fields</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failed.map((r, i) => (
                      <tr key={i} className="border-t border-glass-border">
                        <td className="px-3 py-2">
                          <input
                            value={r[map.email] ?? ""}
                            onChange={(e) => fixFailedEmail(i, e.target.value)}
                            className="w-full rounded-md border border-glass-border bg-background/40 px-2 py-1 font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {Object.entries(r)
                            .filter(([k]) => k !== map.email)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => removeFailed(i)}
                            className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-1 text-xs hover:bg-glass-strong"
                          >
                            <IconClose size={12} /> Drop
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          )}

          {/* Cleaned table preview */}
          {valid.length > 0 && (
            <GlassPanel className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="font-display text-xl">Cleaned rows</div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-56 rounded-full border border-glass-border bg-glass/30 px-4 py-1.5 text-sm outline-none focus:border-primary/60"
                />
              </div>
              <div className="max-h-80 overflow-auto rounded-xl border border-glass-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-glass/80 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      {headers.map((h) => (
                        <th
                          key={h}
                          onClick={() => toggleSort(h)}
                          className="cursor-pointer px-3 py-2 hover:text-foreground"
                        >
                          {h}
                          {sortKey === h ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredValid.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t border-glass-border">
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-xs">{r[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredValid.length > 100 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Showing first 100 of {filteredValid.length.toLocaleString()}
                </div>
              )}
            </GlassPanel>
          )}

          <GlassPanel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-xl">{valid.length.toLocaleString()} ready to import</div>
                <div className="text-sm text-muted-foreground">{filename}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportXlsx}
                  disabled={valid.length === 0 && failed.length === 0}
                  className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-5 py-2.5 text-sm hover:bg-glass-strong disabled:opacity-50"
                >
                  Export XLSX
                </button>
                <button
                  onClick={submit}
                  disabled={busy || valid.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <IconCheck size={14} /> {busy ? "Importing…" : "Import contacts"}
                </button>
              </div>
            </div>
          </GlassPanel>
        </>
      )}
    </div>
  );
}
