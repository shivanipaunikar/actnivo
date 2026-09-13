import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { getPurchaseOrderWorkspace } from "@/lib/data/purchase-orders";
import { createClient } from "@/lib/supabase/server";
import { refreshPurchaseOrders } from "./actions";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; risk?: string; scan?: string; error?: string }> }) {
  const [query, context] = await Promise.all([searchParams, requireAppContext()]);
  const supabase = await createClient();
  const workspace = await getPurchaseOrderWorkspace(supabase as any, context.organization.id);
  const filtered = workspace.purchaseOrders.filter((po: any) => {
    if (query.status && po.status !== query.status) return false;
    if (query.risk === "at-risk" && po.atRiskLines <= 0) return false;
    return true;
  });
  const active = workspace.purchaseOrders.filter((po: any) => !["RECEIVED", "CANCELLED"].includes(po.status));
  const openValue = active.reduce((sum: number, po: any) => sum + Number(po.total_value ?? 0), 0);
  const inbound = active.reduce((sum: number, po: any) => sum + Number(po.inboundUnits ?? 0), 0);
  const riskValue = workspace.risks.reduce((sum, risk) => sum + risk.revenueAtRisk, 0);
  const statuses = [...new Set<string>(workspace.purchaseOrders.map((po: any) => String(po.status)))].sort();

  return <div className="product-page">
    <header className="product-page-header"><div><p>OPERATIONS / SUPPLY</p><h1>Purchase Orders</h1><span>Will incoming supply arrive in time to protect demand?</span></div>{canManageInventory(context.role) && <form action={refreshPurchaseOrders}><button className="saas-primary" type="submit">Refresh supply intelligence</button></form>}</header>
    {query.scan !== undefined && <p className="product-alert success">Supply intelligence refreshed across {query.scan} PO lines. {query.risk ?? "0"} arrival risks found.</p>}
    {query.error && <p className="product-alert error">{query.error}</p>}
    <section className="saas-metrics"><article><small>OPEN POS</small><strong>{active.length}</strong><p>Active inbound orders</p></article><article><small>PO VALUE</small><strong>{money.format(openValue)}</strong><p>Open purchase value</p></article><article><small>LATE POS</small><strong>{workspace.purchaseOrders.filter((po: any) => po.status === "LATE").length}</strong><p>Past expected arrival</p></article><article><small>AT-RISK LINES</small><strong>{workspace.risks.length}</strong><p>{money.format(riskValue)} revenue at risk</p></article><article><small>INBOUND UNITS</small><strong>{inbound.toLocaleString("en-IN")}</strong><p>Remaining confirmed supply</p></article></section>
    <section className="product-card compact" style={{ marginTop: 16 }}><header><div><small>FILTERS</small><h2>Incoming supply</h2></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Link href="/app/purchase-orders">All</Link><Link href="/app/purchase-orders?risk=at-risk">At risk</Link>{statuses.map((status) => <Link key={status} href={`/app/purchase-orders?status=${status}`}>{status.replaceAll("_", " ")}</Link>)}</div></header></section>
    <section className="product-card" style={{ marginTop: 16 }}><header><div><small>INCOMING SUPPLY</small><h2>Purchase order health</h2></div><Link href="/app/integrations">Manage data sources →</Link></header>{filtered.length ? <div className="simple-table"><div className="simple-table-head"><span>PO</span><span>Supplier / destination</span><span>Arrival</span><span>Status</span><span>Inbound</span><span>Risk</span><span /></div>{filtered.map((po: any) => <div key={po.id}><span><strong>{po.external_po_number}</strong><small>{po.source_type}</small></span><span><strong>{po.supplier_name}</strong><small>{po.destination?.name ?? "Unknown destination"}</small></span><span>{new Date(`${po.expected_delivery_date}T00:00:00Z`).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span><span>{po.status.replaceAll("_", " ")}</span><span>{Number(po.inboundUnits).toLocaleString("en-IN")} units</span><span><strong>{money.format(Number(po.revenueRisk ?? 0))}</strong><small>{po.atRiskLines ? `${po.atRiskLines} line${po.atRiskLines === 1 ? "" : "s"}` : "Protected"}</small></span><Link href={`/app/purchase-orders/${po.id}`}>Review →</Link></div>)}</div> : <div className="product-empty"><span>▱</span><h3>No purchase orders in this view.</h3><p>Connect an ERP, OMS, supplier API, or use the file adapter for onboarding and historical backfills.</p></div>}</section>
    <section className="formula-note"><small>HOW ACTNIVO USES PO DATA</small><p>Incoming supply is normalized from any connector, compared with projected stockout dates, ranked by financial impact, and routed into the same Ops Inbox and Action Engine. CSV/XLSX is only a fallback adapter.</p></section>
  </div>;
}
