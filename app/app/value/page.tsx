import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { getValueMetrics } from "@/lib/data/operations";
import { createClient } from "@/lib/supabase/server";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function ValuePage() {
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const value = await getValueMetrics(supabase, organization.id);
  const hasValue = value.revenueAtRisk > 0 || value.actionsApproved > 0;
  const metrics = [
    ["REVENUE AT RISK IDENTIFIED", currency.format(value.revenueAtRisk), "From actual detected issues"],
    ["ESTIMATED REVENUE PROTECTED", currency.format(value.estimatedRevenueProtected), "From approved actions"],
    ["ACTUAL REVENUE PROTECTED", currency.format(value.actualRevenueProtected), "Verified outcomes only"],
    ["STOCKOUTS PREVENTED", value.stockoutsPrevented.toLocaleString("en-IN"), "Successful verifications"],
    ["INVENTORY REBALANCED", `${value.inventoryRebalanced.toLocaleString("en-IN")} units`, "Approved transfer plans"],
    ["ACTIONS APPROVED", value.actionsApproved.toLocaleString("en-IN"), "Explicit user approvals"],
    ["ACTIONS VERIFIED", value.actionsVerified.toLocaleString("en-IN"), "Matched new inventory"],
    ["AVERAGE RESOLUTION TIME", value.averageResolutionHours === null ? "—" : `${value.averageResolutionHours.toFixed(1)} hrs`, "Created to verified"],
  ];
  return <div className="product-page value-page"><header className="product-page-header"><div><p>INTELLIGENCE</p><h1>Value Generated</h1><span>Only actual issues, approvals, and verified outcomes are counted.</span></div></header>{!hasValue ? <section className="inventory-empty"><span>↑</span><small>NO VERIFIED VALUE YET</small><h2>Value appears after the operating loop runs.</h2><p>Detect an issue, approve an assisted action, and upload a new inventory snapshot to verify the result.</p><Link className="saas-primary" href="/app/ops">Open Ops Inbox</Link></section> : <section className="value-metric-grid">{metrics.map(([label, amount, note]) => <article key={label}><small>{label}</small><strong>{amount}</strong><p>{note}</p></article>)}</section>}</div>;
}
