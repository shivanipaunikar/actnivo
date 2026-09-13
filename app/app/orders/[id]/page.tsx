import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOrderDetail } from "@/lib/data/orders";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { organization }] = await Promise.all([params, requireAppContext()]);
  const supabase = await createClient();
  const order = await getOrderDetail(supabase as any, organization.id, id);
  if (!order) notFound();

  return <div className="product-page">
    <header className="product-page-header"><div><p>ORDERS / DETAIL</p><h1>{order.external_order_id}</h1><span>{order.channel ? String(order.channel).replaceAll("_", " ") : "Direct"} · {order.customer_city ?? "Customer location unavailable"}</span></div><Link href="/app/orders">← All orders</Link></header>

    {order.exception && <section className="issue-hero"><div><small>{order.exception.type.replaceAll("_", " ")}</small><h2>{order.exception.title}</h2><p>{order.exception.summary}</p></div><aside><small>REVENUE AT RISK</small><strong>{money.format(order.exception.revenueAtRisk)}</strong><p>{order.exception.reason}</p></aside></section>}

    <section className="saas-metrics" style={{ marginTop: 18 }}>
      <article><small>ORDER VALUE</small><strong>{money.format(Number(order.order_value ?? 0))}</strong><p>{order.payment_method}</p></article>
      <article><small>STATUS</small><strong>{String(order.status).replaceAll("_", " ")}</strong><p>Order lifecycle</p></article>
      <article><small>FULFILLMENT</small><strong>{String(order.fulfillment_status).replaceAll("_", " ")}</strong><p>{order.units} units</p></article>
      <article><small>DELIVERY ATTEMPTS</small><strong>{order.delivery_attempts}</strong><p>{order.payment_method === "COD" ? "COD monitoring active" : "Prepaid / other"}</p></article>
    </section>

    <div className="issue-detail-grid" style={{ marginTop: 18 }}>
      <section className="product-card"><small>FULFILLMENT TIMELINE</small><h2>Order movement</h2><dl>
        <div><dt>Placed</dt><dd>{new Date(order.order_placed_at).toLocaleString("en-IN")}</dd></div>
        <div><dt>Promised ship</dt><dd>{order.promised_ship_at ? new Date(order.promised_ship_at).toLocaleString("en-IN") : "Not provided"}</dd></div>
        <div><dt>Shipped</dt><dd>{order.shipped_at ? new Date(order.shipped_at).toLocaleString("en-IN") : "Not shipped"}</dd></div>
        <div><dt>Delivered</dt><dd>{order.delivered_at ? new Date(order.delivered_at).toLocaleString("en-IN") : "Not delivered"}</dd></div>
      </dl></section>
      <section className="product-card"><small>ORDER LINES</small><h2>{order.lines.length} SKU line{order.lines.length === 1 ? "" : "s"}</h2>{order.lines.length ? <div className="simple-table"><div className="simple-table-head"><span>SKU</span><span>Product</span><span>Qty</span><span>Unit price</span><span>Line value</span></div>{order.lines.map((line: any) => <div key={line.id}><span><strong>{line.sku?.master_sku ?? "Unknown"}</strong></span><span>{line.sku?.product_name ?? "Unknown product"}</span><span>{line.quantity}</span><span>{money.format(Number(line.unit_price))}</span><span>{money.format(Number(line.line_value))}</span></div>)}</div> : <p>No order lines are available.</p>}</section>
    </div>
  </div>;
}
