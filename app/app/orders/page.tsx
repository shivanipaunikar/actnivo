import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOrdersWorkspace } from "@/lib/data/orders";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const orderRowStyle = {
  display: "grid",
  gridTemplateColumns: "2fr .8fr .6fr .8fr .4fr",
  gap: 14,
  alignItems: "center",
  minHeight: 56,
  padding: "11px 24px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-secondary)",
  fontSize: 9,
  textDecoration: "none",
} as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ imported?: string }> }) {
  const [{ organization }, query] = await Promise.all([requireAppContext(), searchParams]);
  const supabase = await createClient();
  const data = await getOrdersWorkspace(supabase as any, organization.id);

  return <div className="product-page">
    <header className="product-page-header"><div><p>OPERATIONS</p><h1>Orders</h1><span>Unified fulfillment health across channels, ranked by financial exposure.</span></div><div style={{ display: "flex", gap: 10, alignItems: "center" }}><Link className="saas-primary" href="/app/orders/import">Import order file</Link><Link href="/app/integrations">Manage data sources →</Link></div></header>
    {query.imported && <p className="product-alert success">Imported {Number(query.imported).toLocaleString("en-IN")} order{Number(query.imported) === 1 ? "" : "s"}. Order health and Copilot are using the new data.</p>}
    <section className="saas-metrics">
      <article><small>OPEN ORDERS</small><strong>{data.summary.openOrders}</strong><p>{money.format(data.summary.openOrderValue)} open value</p></article>
      <article><small>REVENUE AT RISK</small><strong>{money.format(data.summary.revenueAtRisk)}</strong><p>Across active order exceptions</p></article>
      <article><small>DELAYED</small><strong>{data.summary.delayedOrders}</strong><p>Past promised ship time</p></article>
      <article><small>STUCK</small><strong>{data.summary.stuckOrders}</strong><p>24h+ past promised shipment</p></article>
      <article><small>RTO RISK</small><strong>{data.summary.rtoRiskOrders}</strong><p>COD delivery-attempt risk</p></article>
    </section>

    <section className="product-card" style={{ marginTop: 18 }}>
      <header><div><small>ORDER HEALTH</small><h2>Unified order queue</h2></div><span>{data.orders.length} orders</span></header>
      {data.orders.length ? <div className="simple-table"><div className="simple-table-head"><span>Order</span><span>Channel</span><span>Fulfillment</span><span>Value</span><span>Risk</span></div>
        {data.orders.map((order: any) => <Link href={`/app/orders/${order.id}`} key={order.id} style={orderRowStyle}>
          <span><strong>{order.external_order_id}</strong><small>{new Date(order.order_placed_at).toLocaleString("en-IN")}</small></span>
          <span>{order.channel ? String(order.channel).replaceAll("_", " ") : "Direct"}</span>
          <span>{String(order.fulfillment_status).replaceAll("_", " ")}</span>
          <span>{money.format(Number(order.order_value ?? 0))}</span>
          <span>{order.exception ? <><strong>{order.exception.type.replaceAll("_", " ")}</strong><small>{money.format(order.exception.revenueAtRisk)} at risk</small></> : "Healthy"}</span>
        </Link>)}
      </div> : <div className="product-empty"><span>▱</span><h3>No orders connected yet.</h3><p>Orders will use the same normalized model whether they arrive by API, OMS, marketplace connector, or file bootstrap.</p><Link className="saas-primary" href="/app/orders/import">Import test orders</Link></div>}
    </section>
  </div>;
}
