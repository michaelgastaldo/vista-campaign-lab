/**
 * Pure list parser shared by List Import + List Cleaner. Runs in the
 * browser via the dropped File; no native deps. Validates emails and
 * surfaces per-row reasons so the FailedRowsEditor can group them.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedRow = Record<string, string>;

export type ColumnMap = {
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  job_title: string;
  phone: string;
  city: string;
  country: string;
  num_employees: string;
};

export type FailureReason =
  | "missing_email"
  | "invalid_email_format"
  | "duplicate_in_file"
  | "missing_required";

export type ValidatedRow = {
  index: number;
  row: ParsedRow;
  reasons: FailureReason[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CANONICAL_HEADERS = [
  "First Name",
  "Last Name",
  "Email",
  "Job Title",
  "Company Name",
  "Phone",
  "City",
  "Country/Region",
  "Number of Employees",
];

export function guessMap(headers: string[]): ColumnMap {
  const find = (keys: string[]) =>
    headers.find((h) => keys.some((k) => h.toLowerCase().includes(k))) ?? "";
  return {
    email: find(["email", "mail"]),
    first_name: find(["first", "fname", "given"]),
    last_name: find(["last", "surname", "lname"]),
    company: find(["company", "org", "account"]),
    job_title: find(["title", "role", "position"]),
    phone: find(["phone", "mobile", "tel"]),
    city: find(["city", "town"]),
    country: find(["country", "region"]),
    num_employees: find(["employees", "headcount", "size"]),
  };
}

export async function parseListFile(
  file: File,
): Promise<{ rows: ParsedRow[]; headers: string[] }> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "xlsx" || ext === "xls") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: "", raw: false });
          const headers = rows.length ? Object.keys(rows[0]) : [];
          resolve({ rows, headers });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
  return new Promise((resolve, reject) => {
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve({ rows: res.data, headers: res.meta.fields ?? [] }),
      error: reject,
    });
  });
}

export function validateRows(
  rows: ParsedRow[],
  map: ColumnMap,
): { valid: ParsedRow[]; failed: ValidatedRow[] } {
  const valid: ParsedRow[] = [];
  const failed: ValidatedRow[] = [];
  const seenEmails = new Set<string>();
  rows.forEach((row, index) => {
    const reasons: FailureReason[] = [];
    const raw = (row[map.email] ?? "").trim().toLowerCase();
    if (!raw) reasons.push("missing_email");
    else if (!EMAIL_RE.test(raw)) reasons.push("invalid_email_format");
    else if (seenEmails.has(raw)) reasons.push("duplicate_in_file");
    if (!map.email) reasons.push("missing_required");

    if (reasons.length === 0) {
      seenEmails.add(raw);
      valid.push(row);
    } else {
      failed.push({ index, row, reasons });
    }
  });
  return { valid, failed };
}

export function toCanonicalCsv(rows: ParsedRow[], map: ColumnMap): string {
  const headers = CANONICAL_HEADERS;
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      r[map.first_name] ?? "",
      r[map.last_name] ?? "",
      r[map.email] ?? "",
      r[map.job_title] ?? "",
      r[map.company] ?? "",
      r[map.phone] ?? "",
      r[map.city] ?? "",
      r[map.country] ?? "",
      r[map.num_employees] ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export function downloadTemplate() {
  const sample = "John,Doe,john@acme.test,Director of Marketing,Acme Inc,+15551234567,Brooklyn,United States,250";
  const csv = `${CANONICAL_HEADERS.join(",")}\n${sample}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "list-import-template.csv";
  a.click();
}
