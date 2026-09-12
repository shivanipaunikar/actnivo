import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { getActions } from "@/lib/data/operations";
import { createClient } from "@/lib/supabase/server";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function ActionsPage() {
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const rows = await getActions(supabase, organization.id);
  return <div className="product-page actions-page"><header className="product-page-header"><div><p>AUTOMATION</p><h1>Actions</h1><span>Assisted execution plans with explicit approval and verification.</span></div></header>
    {!rows.length ? <section className="inventory-empty"><span>↯</span><small>NO ACTIONS YET</small><h2>Approved recommendations will appear here.</h2><p>Actnivo never pretends a marketplace API was called. MVP execution produces an assisted transfer artifact and internal task.</p><Link className="saas-primary" href="/app/ops">Open Ops Inbox</Link></section> : <section className="action-list">{rows.map(({ action, outcome, issue }) => { const payload = action.payload as Record<string, unknown>; return <Link key={action.id} href={`/app/actions/${action.id}`}><span className={`action-state ${action.status.toLowerCase()}`}>{action.status.replaceAll("_", " ")}</span><div><small>{action.type.replaceAll("_", " ")}</small><h2>{String(payload.product_name ?? issue?.title ?? "Assisted action")}</h2><p>{String(payload.internal_task ?? "Operational task")}</p></div><aside><small>ESTIMATED VALUE</small><strong>{currency.format(Number(outcome?.estimated_value_protected ?? 0))}</strong><span>{action.execution_mode} execution</span></aside><b>→</b></Link>; })}</section>}
  </div>;
}
