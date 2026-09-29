import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconSpark, IconClose, IconCheck } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { Button } from "@/components/ui/button";
import {
  parseListFile,
  guessMap,
  validateRows,
  toCanonicalCsv,
  downloadTemplate,
  type ParsedRow,
  type ColumnMap,
  type FailureReason,
  CANONICAL_HEADERS,
} from "@/lib/parse-list-file";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tools/list-cleaner")({
  component: ListCleanerContent,
});

const REASON_LABELS: Record<FailureReason, string> = {
  missing_email: "Missing email",
  invalid_email_format: "Bad email format",
  duplicate_in_file: "Duplicate in this file",
  missing_required: "Email column not mapped",
};

export function ListCleanerContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filename, setFilename] = useState("");
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [reasonFilter, setReasonFilter] = useState<FailureReason | "all">("all");

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    try {
      const { rows: r, headers: h } = await parseListFile(f);
      setRows(r);
      setHeaders(h);
      setFilename(f.name);
      setMap(guessMap(h));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
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

  const { valid, failed } = useMemo(() => {
    if (!map) return { valid: [] as ParsedRow[], failed: [] };
    return validateRows(rows, map);
  }, [rows, map]);

  const visibleFailed = useMemo(() => {
    if (reasonFilter === "all") return failed;
    return failed.filter((f) => f.reasons.includes(reasonFilter));
  }, [failed, reasonFilter]);

  const fixEmail = (rowIndex: number, value: string) => {
    if (!map) return;
    setRows((cur) => {
      const next = [...cur];
      next[rowIndex] = { ...next[rowIndex], [map.email]: value };
      return next;
    });
  };

  const dropRow = (rowIndex: number) => {
    setRows((cur) => cur.filter((_, i) => i !== rowIndex));
  };

  const exportCsv = () => {
    if (!map || valid.length === 0) return;
    const csv = toCanonicalCsv(valid, map);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename.replace(/\.[^.]+$/, "") || "cleaned"}.csv`;
    a.click();
    toast.success(`Exported ${valid.length} contacts`);
  };

  const reasonCounts: Record<FailureReason, number> = {
    missing_email: 0,
    invalid_email_format: 0,
    duplicate_in_file: 0,
    missing_required: 0,
  };
  for (const f of failed) for (const r of f.reasons) reasonCounts[r]++;

  return (
    <div className="space-y-8">
      {!hideHeader && <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <PageHexBadge hue={150} icon={<IconSpark size={26} />} aria-label="List cleaner" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">List</div>
            <h1 className="font-display text-3xl">List cleaner</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          Download template
        </Button>
      </div>}

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
          Standalone validation — nothing is written to your CRM.
        </div>
      </div>

      {rows.length > 0 && map && (
        <>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-9">
            {(Object.keys(map) as (keyof ColumnMap)[]).map((k) => (
              <div key={k}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {k.replace(/_/g, " ")}
                </div>
                <select
                  value={map[k]}
                  onChange={(e) => setMap({ ...map, [k]: e.target.value })}
                  className="field-glass mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                >
                  <option value="" className="bg-card">
                    —
                  </option>
                  {headers.map((h) => (
                    <option key={h} value={h} className="bg-card">
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Total" value={rows.length} />
            <Stat label="Valid" value={valid.length} tone="success" />
            <Stat label="Needs fixing" value={failed.length} tone="warn" />
          </div>

          {failed.length > 0 && (
            <GlassPanel className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="font-display text-xl">Failed rows</div>
                <div className="flex flex-wrap gap-1.5">
                  <ReasonChip
                    label="All"
                    count={failed.length}
                    active={reasonFilter === "all"}
                    onClick={() => setReasonFilter("all")}
                  />
                  {(Object.keys(REASON_LABELS) as FailureReason[]).map((r) =>
                    reasonCounts[r] > 0 ? (
                      <ReasonChip
                        key={r}
                        label={REASON_LABELS[r]}
                        count={reasonCounts[r]}
                        active={reasonFilter === r}
                        onClick={() => setReasonFilter(r)}
                      />
                    ) : null,
                  )}
                </div>
              </div>
              <div className="max-h-80 overflow-auto rounded-xl border border-glass-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-glass/80 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Reasons</th>
                      <th className="px-3 py-2">Other</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFailed.map((f) => (
                      <tr key={f.index} className="border-t border-glass-border">
                        <td className="px-3 py-2">
                          <input
                            value={f.row[map.email] ?? ""}
                            onChange={(e) => fixEmail(f.index, e.target.value)}
                            className="w-full rounded-md border border-glass-border bg-background/40 px-2 py-1 font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {f.reasons.map((r) => (
                              <span
                                key={r}
                                className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300"
                              >
                                {REASON_LABELS[r]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {Object.entries(f.row)
                            .filter(([k]) => k !== map.email)
                            .slice(0, 2)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => dropRow(f.index)}
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

          <GlassPanel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-xl">
                  {valid.length.toLocaleString()} ready to export
                </div>
                <div className="text-sm text-muted-foreground">
                  Will produce a CSV with headers: {CANONICAL_HEADERS.join(", ")}.
                </div>
              </div>
              <Button onClick={exportCsv} disabled={valid.length === 0} className="gap-2">
                <IconCheck size={14} /> Export cleaned CSV
              </Button>
            </div>
          </GlassPanel>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warn";
}) {
  const color =
    tone === "success"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : "text-foreground";
  return (
    <GlassPanel className="p-5">
      <div className={`text-xs uppercase tracking-[0.2em] ${color}`}>{label}</div>
      <div className={`mt-1 font-display text-3xl ${color}`}>{value.toLocaleString()}</div>
    </GlassPanel>
  );
}

function ReasonChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] ${
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-glass-border bg-glass/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label} <span className="ml-1 font-mono">{count}</span>
    </button>
  );
}
