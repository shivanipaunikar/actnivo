import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { getOpsInbox } from "@/lib/data/operations";
import { titleCaseChannel } from "@/lib/data/inventory";
import { createClient } from "@/lib/supabase/server";
import { refreshOperations } from "./actions";

const tabs = [["all", "All"], ["critical", "Critical"], ["needs_approval", "Needs Approval"], ["running", "Running"], ["resolved", "Resolved"], ["ignored", "Ignored"]] as const;
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function recommendationCopy(issue: any, recommendation: any, sourceLocation: any, location: any) {
  if (recommendation) return { title: `Move ${recommendation.quantity} units`, detail: `${sourceLocation?.name ?? "Source"} → ${location?.name ?? "Destination"}` };
  const metadata = issue.metadata as Record<string, unknown>;
  if (String(metadata.recommendation_type ?? "") === "EXPEDITE_PO") return { title: "Expedite purchase order", detail: `${String(metadata.po_number ?? "PO")} · ${String(metadata.supplier_name ?? "Supplier")}` };
  return { title: "Replenishment required", detail: "No safe source location found" };
}

export default async function OpsInboxPage({ searchParams }: { searchParams: Promise<{ status?: string; scan?: string; error?: string }> }) {
  const [query, context] = await Promise.all([searchParams, requireAppContext()]);
  const supabase = await createClient();
  const all = await getOpsInbox(supabase, context.organization.id);
  const active = query.status ?? "all";
  const items = all.filter(({ issue }) => active === "all" || (active === "critical" ? issue.severity === "critical" && !["resolved", "ignored"].includes(issue.status) : issue.status === active));
  return <div className="product-page ops-page">
    <header className="product-page-header"><div><p>OPERATIONS</p><h1>Ops Inbox</h1><span>Prioritized by estimated financial impact—not alert count.</span></div>{canManageInventory(context.role) && <form action={refreshOperations}><button className="saas-primary" type="submit">Run detection</button></form>}</header>
    {query.scan !== undefined && <p className="product-alert success">Detection complete. {query.scan} auditable forecast calculations were stored.</p>}
    {query.error && <p className="product-alert error">{query.error}</p>}
    <nav className="ops-tabs" aria-label="Issue status">{tabs.map(([value, label]) => <Link key={value} className={active === value ? "active" : ""} href={value === "all" ? "/app/ops" : `/app/ops?status=${value}`}>{label}<span>{all.filter(({ issue }) => value === "all" || (value === "critical" ? issue.severity === "critical" && !["resolved", "ignored"].includes(issue.status) : issue.status === value)).length}</span></Link>)}</nav>
    {!all.length ? <section className="inventory-empty"><span>◎</span><small>NO OPERATIONAL ISSUES</small><h2>There’s nothing to prioritize yet.</h2><p>Connect inventory, sales, and inbound supply data, then run deterministic detection.</p><Link className="saas-primary" href="/app/integrations/import">Upload operations data</Link></section> : !items.length ? <section className="ops-empty-filter"><p>No issues match this view.</p></section> : <section className="ops-list">{items.map(({ issue, sku, location, recommendation, sourceLocation }, index) => {
      const copy = recommendationCopy(issue, recommendation, sourceLocation, location);
      const metadata = issue.metadata as Record<string, unknown>;
      const isPo = String(issue.type).startsWith("PO_");
      return <Link href={`/app/ops/issues/${issue.id}`} key={issue.id} className="ops-issue-card">
        <span className={`ops-severity ${issue.severity}`}><i />{issue.severity}</span>
        <div className="ops-issue-main"><small>{String(index + 1).padStart(2, "0")} · {String(issue.type).replaceAll("_", " ")}</small><h2>{sku?.product_name ?? issue.title}</h2><p>{issue.summary}</p><div><span>{issue.channel ? titleCaseChannel(issue.channel) : "All channels"}</span><span>{location?.name ?? "All locations"}</span><span>{isPo ? String(metadata.po_number ?? "Incoming supply") : `${Number(issue.days_of_cover ?? 0).toFixed(1)} days remaining`}</span></div></div>
        <div className="ops-impact"><small>REVENUE AT RISK</small><strong>{currency.format(Number(issue.estimated_revenue_at_risk ?? 0))}</strong><span>{issue.estimated_shortage_units ?? 0} units at risk</span></div>
        <div className="ops-recommend"><small>RECOMMENDED ACTION</small><strong>{copy.title}</strong><span>{copy.detail}</span></div>
        <b>→</b>
      </Link>;
    })}</section>}
  </div>;
}
