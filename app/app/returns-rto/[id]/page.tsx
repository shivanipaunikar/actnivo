import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReturnRtoDetail } from "@/lib/data/returns-rto";

const money=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0});
export default async function ReturnDetailPage({params}:{params:Promise<{id:string}>}){
  const [{id},context]=await Promise.all([params,requireAppContext()]);const supabase=await createClient();const row=await getReturnRtoDetail(supabase as any,context.organization.id,id);if(!row)notFound();
  return <div className="product-page"><header className="product-page-header"><div><p>RETURNS & RTO / {row.kind}</p><h1>{row.external_return_id}</h1><span>{row.order?.external_order_id??"Order"} · {String(row.status).replaceAll("_"," ")}</span></div><Link href="/app/returns-rto">← Back</Link></header>
  {row.exception&&<section className="issue-hero"><div><small>WHAT NEEDS ATTENTION</small><h2>{row.exception.title}</h2><p>{row.exception.summary}</p></div><aside><small>VALUE EXPOSED</small><strong>{money.format(row.exception.revenueAtRisk)}</strong><p>{row.exception.type.replaceAll("_"," ")}</p></aside></section>}
  <div className="issue-detail-grid"><section className="issue-facts"><article><small>KIND</small><strong>{row.kind}</strong><p>{row.reason??"No reason provided"}</p></article><article><small>REFUND AMOUNT</small><strong>{money.format(Number(row.refund_amount??0))}</strong><p>{row.refunded_at?`Refunded ${new Date(row.refunded_at).toLocaleDateString("en-IN")}`:row.refund_due_at?`Due ${new Date(row.refund_due_at).toLocaleDateString("en-IN")}`:"No refund due date"}</p></article><article><small>REVERSE LOGISTICS</small><strong>{money.format(Number(row.reverse_logistics_cost??0))}</strong><p>{row.picked_up_at?`Picked up ${new Date(row.picked_up_at).toLocaleDateString("en-IN")}`:"Not picked up"}</p></article><article><small>WAREHOUSE RECEIPT</small><strong>{row.received_at?new Date(row.received_at).toLocaleDateString("en-IN"):"Pending"}</strong><p>{row.status.replaceAll("_"," ")}</p></article></section>
  <section className="issue-action-panel"><small>LINE ITEMS</small>{row.lines.map((line:any)=><div key={line.id} style={{marginTop:14}}><strong>{line.sku?.master_sku??"SKU"}</strong><p>{line.sku?.product_name??"Product"} · {line.quantity} units · {money.format(Number(line.unit_value??0))}/unit</p></div>)}</section></div></div>;
}
