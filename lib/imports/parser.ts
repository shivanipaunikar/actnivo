import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";
import type { ParsedImport, RawImportRow, RawValue } from "./types";

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 25_000;

function cellValue(value: unknown): RawValue {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function detectHeaderRow(rows: unknown[][]) {
  const candidates = rows.slice(0, 10);
  let bestIndex = -1;
  let bestCount = 0;
  candidates.forEach((row, index) => {
    const count = row.filter((cell) => String(cell ?? "").trim()).length;
    if (count > bestCount) {
      bestIndex = index;
      bestCount = count;
    }
  });
  if (bestIndex < 0 || bestCount < 2) throw new Error("We could not detect a header row. Add at least two named columns.");
  return bestIndex;
}

function rowsToRecords(rows: unknown[][]): ParsedImport {
  const headerIndex = detectHeaderRow(rows);
  const headers = rows[headerIndex].map((cell) => String(cell ?? "").trim());
  if (headers.some((header) => !header)) throw new Error("Every used column must have a header.");
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new Error("Column headers must be unique.");

  const records: RawImportRow[] = rows.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, cellValue(row[index])])));
  if (!records.length) throw new Error("The file has headers but no data rows.");
  if (records.length > MAX_IMPORT_ROWS) throw new Error(`Imports are limited to ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} rows per file.`);
  return { headers, rows: records };
}

export async function parseImportFile(filename: string, bytes: Uint8Array): Promise<ParsedImport> {
  if (bytes.byteLength === 0) throw new Error("The selected file is empty.");
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error("Files must be 10 MB or smaller.");
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "csv") {
    let rows: unknown[][];
    try {
      rows = parse(Buffer.from(bytes).toString("utf8"), {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as unknown[][];
    } catch {
      throw new Error("We could not read this CSV file. Check its quotes, delimiters, and header row.");
    }
    return rowsToRecords(rows);
  }
  if (extension === "xlsx") {
    let rows: unknown[][];
    try {
      rows = await readSheet(Buffer.from(bytes));
    } catch {
      throw new Error("We could not read this XLSX file. Check that it is a valid, unencrypted Excel workbook.");
    }
    return rowsToRecords(rows);
  }
  throw new Error("Upload a CSV or XLSX file.");
}

export function sha256(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function safeFilename(filename: string) {
  const parts = filename.split(".");
  const extension = parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : "";
  const base = parts.join(".").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "import";
  return `${base}${extension}`;
}
