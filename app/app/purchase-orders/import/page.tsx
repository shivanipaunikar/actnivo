import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { uploadImport } from "@/app/app/integrations/import/actions";

export default async function PurchaseOrderImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, context] = await Promise.all([searchParams, requireAppContext()]);
  const canUpload = canManageInventory(context.role);
  return (
    <div className="product-page import-page">
      <header className="product-page-header"><div><p>PURCHASE ORDERS / FILE ADAPTER</p><h1>Import purchase orders</h1><span>Use this for onboarding, backfills, and testing. Live API connections remain the primary path.</span></div><Link href="/app/purchase-orders">Back to Purchase Orders</Link></header>
      {error && <p className="product-alert error">{error}</p>}
      <section className="product-card upload-card">
        <header><div><small>FILE ADAPTER</small><h2>Upload CSV or XLSX</h2></div><span>Fallback ingestion</span></header>
        <form action={uploadImport} className="upload-form">
          <input type="hidden" name="source_type" value="purchase_orders" />
          <label className="file-drop"><input type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={!canUpload} /><span>Choose PO file</span><small>Maximum 10 MB · up to 25,000 rows</small></label>
          <button className="saas-primary" type="submit" disabled={!canUpload}>{canUpload ? "Upload and preview" : "Your role cannot upload data"}</button>
        </form>
        <p className="privacy-note">Required: PO Number · Supplier · Destination · Order Date · ETA · SKU · Ordered Quantity</p>
      </section>
    </div>
  );
}
