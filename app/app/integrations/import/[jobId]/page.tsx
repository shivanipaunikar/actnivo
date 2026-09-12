import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportSteps } from "@/components/app/ImportSteps";
import { StatusBadge } from "@/components/app/StatusBadge";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { getAllImportRows, getImportJob } from "@/lib/data/imports";
import { importDefinitions, suggestColumnMapping } from "@/lib/imports/validation";
import type { ColumnMapping, RawImportRow } from "@/lib/imports/types";
import { createClient } from "@/lib/supabase/server";
import { completeImport, mapImportColumns } from "../actions";

function currentStep(status: string, mapped: boolean) {
  if (status === "completed") return 6;
  if (status === "processing") return 5;
  if (mapped) return 4;
  return 2;
}

export default async function ImportJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ error?: string; validated?: string; completed?: string }>;
}) {
  const [{ jobId }, query] = await Promise.all([params, searchParams]);
  const context = await requireAppContext();
  const supabase = await createClient();
  const job = await getImportJob(supabase, context.organization.id, jobId);
  if (!job) notFound();
  const rows = await getAllImportRows(supabase, context.organization.id, job.id);
  const firstRaw = (rows[0]?.raw_data ?? {}) as RawImportRow;
  const headers = Object.keys(firstRaw);
  const savedMapping = (job.column_mapping ?? {}) as ColumnMapping;
  const suggested = { ...suggestColumnMapping(job.source_type, headers), ...savedMapping };
  const mappedOnce = Object.keys(savedMapping).length > 0;
  const counts = {
    valid: rows.filter((row) => row.status === "valid" || row.status === "pending_sku_mapping" || row.status === "imported").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
    imported: rows.filter((row) => row.status === "imported").length,
  };
  const mappingIds = [...new Set(rows.map((row) => row.sku_mapping_id).filter((id): id is string => Boolean(id)))];
  let unresolvedMappings = 0;
  if (mappingIds.length) {
    const { data } = await supabase.from("sku_mappings").select("id,status")
      .eq("organization_id", context.organization.id).in("id", mappingIds);
    unresolvedMappings = (data ?? []).filter((item) => item.status !== "mapped").length;
  }
  const manageable = canManageInventory(context.role);
  return (
    <div className="product-page import-job-page">
      <header className="product-page-header"><div><p>IMPORT / {job.source_type.toUpperCase()}</p><h1>{job.filename}</h1><span>{job.total_rows.toLocaleString("en-IN")} detected rows · uploaded {new Date(job.created_at).toLocaleString("en-IN")}</span></div><StatusBadge status={job.status} /></header>
      <ImportSteps current={currentStep(job.status, mappedOnce)} />
      {query.error && <p className="product-alert error">{query.error}</p>}
      {query.validated && <p className="product-alert success">Headers mapped and rows validated. Review SKU mappings before import.</p>}
      {query.completed && <p className="product-alert success">Import completed. Your normalized data is ready.</p>}

      <section className="product-card"><header><div><small>FILE PREVIEW</small><h2>Detected headers</h2></div><span>{headers.length} columns</span></header><div className="preview-scroll"><table><thead><tr><th>Row</th>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map((row) => { const raw = row.raw_data as RawImportRow; return <tr key={row.id}><td>{row.row_number}</td>{headers.map((header) => <td key={header}>{String(raw[header] ?? "—")}</td>)}</tr>; })}</tbody></table></div><p className="table-caption">Showing the first {Math.min(5, rows.length)} rows. The complete file remains private.</p></section>

      {job.status !== "completed" && <section className="product-card mapping-card"><header><div><small>STEP 2</small><h2>Map your columns</h2></div><span>Required fields are marked *</span></header><form action={mapImportColumns} className="column-mapping-form"><input type="hidden" name="job_id" value={job.id} /><div>{importDefinitions[job.source_type].fields.map((field) => <label key={field.key}><span>{field.label}{field.required && <b> *</b>}</span><select name={`map_${field.key}`} defaultValue={suggested[field.key] ?? ""} required={field.required} disabled={!manageable}><option value="">Not mapped</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><button className="saas-primary" type="submit" disabled={!manageable}>{mappedOnce ? "Validate again" : "Validate rows"}</button></form></section>}

      {mappedOnce && <section className="validation-section"><div className="validation-grid"><article><small>VALID ROWS</small><strong>{counts.valid}</strong><span>Ready after SKU mapping</span></article><article><small>INVALID ROWS</small><strong>{counts.invalid}</strong><span>Missing or malformed fields</span></article><article><small>DUPLICATES</small><strong>{counts.duplicates}</strong><span>Skipped safely</span></article><article><small>SKU MAPPINGS</small><strong>{unresolvedMappings}</strong><span>Need a decision</span></article></div>{rows.some((row) => row.validation_errors.length) && <div className="product-card validation-errors"><header><div><small>VALIDATION DETAILS</small><h2>Rows that will be skipped</h2></div></header><div className="simple-table errors"><div className="simple-table-head"><span>Row</span><span>SKU</span><span>Reason</span></div>{rows.filter((row) => row.validation_errors.length).slice(0, 12).map((row) => <div key={row.id}><span>{row.row_number}</span><span>{String((row.raw_data as RawImportRow)[suggested.sku] ?? "—")}</span><span>{row.validation_errors.join(" · ")}</span></div>)}</div></div>}</section>}

      {mappedOnce && job.status !== "completed" && <section className="import-decision"><div><small>STEP 4–5</small><h2>{unresolvedMappings ? "Resolve SKU mappings before import." : "Validated rows are ready to import."}</h2><p>{unresolvedMappings ? `${unresolvedMappings} source SKU${unresolvedMappings === 1 ? " needs" : "s need"} approval or a new master SKU.` : "Inventory snapshots will be appended. Existing history will not be overwritten."}</p></div><div><Link href={`/app/inventory/sku-mapping?job=${job.id}`}>{unresolvedMappings ? "Open SKU mapping" : "Review mappings"}</Link>{!unresolvedMappings && <form action={completeImport}><input type="hidden" name="job_id" value={job.id} /><button className="saas-primary" type="submit" disabled={!manageable}>Import {counts.valid} rows</button></form>}</div></section>}

      {job.status === "completed" && <section className="completion-report"><span>✓</span><div><small>IMPORT COMPLETE</small><h2>{counts.imported.toLocaleString("en-IN")} rows added to Actnivo.</h2><p>{counts.invalid + counts.duplicates ? `${counts.invalid + counts.duplicates} rows were skipped and remain visible in this audit report.` : "Every validated row was imported successfully."}</p></div><Link className="saas-primary" href="/app/inventory">View inventory</Link></section>}
    </div>
  );
}
