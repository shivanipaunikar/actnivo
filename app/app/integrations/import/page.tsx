import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getRecentImportJobs } from "@/lib/data/imports";
import { ImportSteps } from "@/components/app/ImportSteps";
import { StatusBadge } from "@/components/app/StatusBadge";
import { uploadImport } from "./actions";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const context = await requireAppContext();
  const supabase = await createClient();
  const jobs = await getRecentImportJobs(supabase, context.organization.id);
  const canUpload = canManageInventory(context.role);
  return (
    <div className="product-page import-page">
      <header className="product-page-header"><div><p>INTEGRATIONS / FILE IMPORT</p><h1>Import commerce data</h1><span>Upload the original file, review its structure, and approve every mapping before import.</span></div><Link href="/app/integrations">Back to integrations</Link></header>
      <ImportSteps current={1} />
      {error && <p className="product-alert error">{error}</p>}
      <div className="import-layout">
        <section className="product-card upload-card">
          <header><div><small>STEP 1</small><h2>Upload a source file</h2></div><span>Private storage</span></header>
          <form action={uploadImport} className="upload-form">
            <fieldset disabled={!canUpload}>
              <legend>What are you importing?</legend>
              <label><input type="radio" name="source_type" value="inventory" defaultChecked /><span><b>Inventory</b><small>Availability by SKU and location</small></span></label>
              <label><input type="radio" name="source_type" value="sales" /><span><b>Sales</b><small>Daily units and revenue by SKU</small></span></label>
              <label><input type="radio" name="source_type" value="purchase_orders" /><span><b>Purchase Orders</b><small>Supplier, ETA, quantities and receipts</small></span></label>
            </fieldset>
            <label className="file-drop"><input type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={!canUpload} /><span>Choose CSV or XLSX</span><small>Maximum 10 MB · up to 25,000 rows</small></label>
            <button className="saas-primary" type="submit" disabled={!canUpload}>{canUpload ? "Upload and preview" : "Your role cannot upload data"}</button>
          </form>
          <p className="privacy-note"><i>⌁</i> Original files stay private in an organization-scoped storage path.</p>
        </section>
        <aside className="import-guidance"><small>BEFORE YOU UPLOAD</small><h2>Use one header row.</h2><p>Keep SKU, dates and quantities in separate columns. You will map your own headers on the next screen.</p><div><strong>Inventory requires</strong><span>SKU · Location · Available Quantity · Snapshot Date</span></div><div><strong>Sales requires</strong><span>SKU · Channel · Date · Units Sold · Gross Sales</span></div><div><strong>Purchase Orders require</strong><span>PO Number · Supplier · Destination · Order Date · ETA · SKU · Ordered Quantity</span></div></aside>
      </div>
      <section className="product-card compact"><header><div><small>RECENT IMPORTS</small><h2>Continue where you left off</h2></div></header>{jobs.length ? <div className="simple-table"><div className="simple-table-head"><span>File</span><span>Type</span><span>Rows</span><span>Status</span><span /></div>{jobs.map((job) => <div key={job.id}><span><strong>{job.filename}</strong><small>{new Date(job.created_at).toLocaleDateString("en-IN")}</small></span><span>{String(job.source_type).replaceAll("_", " ")}</span><span>{job.total_rows}</span><StatusBadge status={job.status} /><Link href={`/app/integrations/import/${job.id}`}>Continue →</Link></div>)}</div> : <div className="product-empty small"><p>No import jobs yet.</p></div>}</section>
    </div>
  );
}
