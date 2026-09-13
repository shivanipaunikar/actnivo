import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { importOrders } from "./actions";

export default async function OrderImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, context] = await Promise.all([searchParams, requireAppContext()]);
  const manageable = canManageInventory(context.role);
  return <div className="product-page import-page">
    <header className="product-page-header"><div><p>ORDERS / FILE BOOTSTRAP</p><h1>Import orders</h1><span>Use CSV/XLSX for onboarding and testing. Production connectors will feed the same normalized order model.</span></div><Link href="/app/orders">← Back to Orders</Link></header>
    {error && <p className="product-alert error">{error}</p>}
    <div className="import-layout">
      <section className="product-card upload-card">
        <header><div><small>BOOTSTRAP ADAPTER</small><h2>Upload order data</h2></div><span>CSV / XLSX</span></header>
        <form action={importOrders} className="upload-form">
          <label className="file-drop"><input type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={!manageable} /><span>Choose order file</span><small>Maximum 10 MB</small></label>
          <button className="saas-primary" type="submit" disabled={!manageable}>{manageable ? "Import orders" : "Your role cannot import orders"}</button>
        </form>
        <p className="privacy-note"><i>⌁</i> This is a bootstrap adapter. Shopify, OMS and marketplace APIs will later call the same normalized ingestion layer automatically.</p>
      </section>
      <aside className="import-guidance">
        <small>REQUIRED COLUMNS</small><h2>One row per order line.</h2>
        <p>Repeat the order-level fields when an order has multiple SKU lines.</p>
        <div><strong>Required</strong><span>Order ID · Order Date · SKU · Quantity · Unit Price</span></div>
        <div><strong>Recommended</strong><span>Channel · Location · Status · Fulfillment Status · Payment Method · Order Value · Promised Ship At · Delivery Attempts</span></div>
        <div><strong>Optional customer context</strong><span>Customer Name · Customer City · Shipped At · Delivered At · Cancelled At</span></div>
      </aside>
    </div>
  </div>;
}
