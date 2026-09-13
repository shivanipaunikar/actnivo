import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { getPurchaseOrderDetail } from "@/lib/data/purchase-orders";
import { createClient } from "@/lib/supabase/server";
import { recordPurchaseOrderReceipt } from "../actions";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function PurchaseOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; received?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, requireAppContext()]);
  const supabase = await createClient();
  const data = await getPurchaseOrderDetail(supabase as any, context.organization.id, id);
  if (!data) notFound();
  const { purchaseOrder: po, lines, risks } = data as any;
  const manageable = canManageInventory(context.role);
  const totalRisk = risks.reduce((sum: number, risk: any) => sum + risk.revenueAtRisk, 0);
  return <div className="product-page">
    <header className="product-page-header"><div><p>PURCHASE ORDERS / {po.status.replaceAll("_", " ")}</p><h1>{po.external_po_number}</h1><span>{po.supplier_name} · {po.destination?.name ?? "Unknown destination"}</span></div><Link href="/app/purchase-orders">← All purchase orders</Link></header>
    {query.error && <p className="product-alert error">{query.error}</p>}{query.received && <p className="product-alert success">Receipt updated. Supply intelligence was recalculated.</p>}
    <section className="saas-metrics"><article><small>EXPECTED ARRIVAL</small><strong>{new Date(`${po.expected_delivery_date}T00:00:00Z`).toLocaleDateString("en-IN")}</strong><p>{po.actual_delivery_date ? `Actual ${new Date(po.actual_delivery_date).toLocaleDateString("en-IN")}` : "Not fully received"}</p></article><article><small>PO VALUE</small><strong>{money.format(Number(po.total_value ?? 0))}</strong><p>{po.currency}</p></article><article><small>INBOUND UNITS</small><strong>{Number(po.inboundUnits).toLocaleString("en-IN")}</strong><p>{po.skuCount} SKUs</p></article><article><small>REVENUE AT RISK</small><strong>{money.format(totalRisk)}</strong><p>{risks.length} at-risk lines</p></article></section>
    <section className="assisted-banner"><span>SUPPLY IMPACT</span><h2>{risks.length ? `${risks.length} inbound line${risks.length === 1 ? "" : "s"} may arrive after stockout.` : "Current inbound supply is on time for known demand."}</h2><p>Expected arrival is compared with the latest deterministic stockout forecast.</p></section>
    <section className="product-card" style={{ marginTop: 16 }}><header><div><small>LINE ITEMS</small><h2>Supply coverage by SKU</h2></div></header><div className="simple-table"><div className="simple-table-head"><span>SKU</span><span>Ordered</span><span>Received</span><span>Expected</span><span>Gap</span><span>Risk</span><span>Receipt</span></div>{lines.map((line: any) => {
      const target = Number(line.confirmed_quantity ?? line.ordered_quantity);
      const risk = line.risk;
      return <div key={line.id}><span><strong>{line.sku?.product_name ?? "Unknown product"}</strong><small>{line.sku?.master_sku ?? line.sku_id}</small></span><span>{line.ordered_quantity}<small>confirmed {line.confirmed_quantity ?? "—"}</small></span><span>{line.received_quantity}<small>{Math.max(0, target - line.received_quantity)} remaining</small></span><span>{new Date(`${line.expected_delivery_date ?? po.expected_delivery_date}T00:00:00Z`).toLocaleDateString("en-IN")}</span><span>{risk ? `${risk.gapDays} days` : "Protected"}</span><span>{risk ? money.format(risk.revenueAtRisk) : "—"}</span><span>{manageable && !["RECEIVED", "CANCELLED"].includes(po.status) ? <form action={recordPurchaseOrderReceipt}><input type="hidden" name="po_id" value={po.id} /><input type="hidden" name="line_id" value={line.id} /><input type="number" name="received_quantity" min="0" max={target} defaultValue={line.received_quantity} required style={{ width: 70 }} /><button type="submit">Save</button></form> : "—"}</span></div>;
    })}</div></section>
    <section className="formula-note"><small>SUPPLY-GAP MATH</small><p>Gap days × weighted daily demand = units at risk; units at risk × selling price = estimated revenue at risk.</p></section>
  </div>;
}
