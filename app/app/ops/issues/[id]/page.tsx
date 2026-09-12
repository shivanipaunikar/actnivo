import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { getIssueDetail } from "@/lib/data/operations";
import { titleCaseChannel } from "@/lib/data/inventory";
import { createClient } from "@/lib/supabase/server";
import { approveIssue, ignoreIssue, modifyRecommendation } from "../../actions";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function IssueDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; modified?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, requireAppContext()]);
  const supabase = await createClient();
  const data = await getIssueDetail(supabase, context.organization.id, id);
  if (!data) notFound();
  const { issue, sku, location, forecast, recommendation, sourceLocation, actions } = data;
  const manageable = canManageInventory(context.role);
  const latestAction = actions[0];
  return <div className="product-page issue-detail-page">
    <header className="product-page-header"><div><p>OPS INBOX / {issue.type.replaceAll("_", " ")}</p><h1>{sku.product_name}</h1><span>{issue.channel ? titleCaseChannel(issue.channel) : "All channels"} · {location?.name ?? "All locations"}</span></div><Link href="/app/ops">← Back to inbox</Link></header>
    {query.error && <p className="product-alert error">{query.error}</p>}{query.modified && <p className="product-alert success">Recommendation quantity updated and logged.</p>}
    <section className="issue-hero"><div><small>WHAT HAPPENED</small><h2>Stockout predicted in {Number(issue.days_of_cover ?? 0).toFixed(1)} days</h2><p>{issue.summary}</p></div><aside><small>ESTIMATED REVENUE AT RISK</small><strong>{currency.format(Number(issue.estimated_revenue_at_risk ?? 0))}</strong><p>{issue.estimated_shortage_units ?? 0} units × {currency.format(Number((issue.metadata as Record<string, number>).selling_price ?? 0))}</p></aside></section>
    <div className="issue-detail-grid">
      <section className="issue-facts"><article><small>WHY</small><h3>Demand will exceed protected inventory.</h3><p>The current coverage is below lead time plus safety days. Calculations are deterministic and stored for audit.</p></article><article><small>CURRENT INVENTORY</small><strong>{forecast?.available_quantity ?? 0} units</strong><p>{location?.name} · latest imported snapshot</p></article><article><small>DEMAND VELOCITY</small><strong>{Number(forecast?.weighted_daily_velocity ?? 0).toFixed(1)} units/day</strong><p>50% 7-day + 30% 14-day + 20% 28-day average</p></article><article><small>PROJECTED STOCKOUT</small><strong>{forecast?.projected_stockout_at ? new Date(forecast.projected_stockout_at).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}</strong><p>Confidence {Math.round(Number(issue.confidence ?? 0) * 100)}%</p></article></section>
      <section className="issue-action-panel"><small>RECOMMENDED ACTION</small>{recommendation ? <><h2>Move {recommendation.quantity} units</h2><p>{sourceLocation?.name} → {location?.name}</p><div><span>Source coverage after<strong>{Number(recommendation.source_coverage_after ?? 0).toFixed(1)} days</strong></span><span>Destination coverage after<strong>{Number(recommendation.destination_coverage_after).toFixed(1)} days</strong></span><span>Revenue protected<strong>{currency.format(Number(recommendation.estimated_revenue_protected))}</strong></span></div>{latestAction ? <Link className="saas-primary" href={`/app/actions/${latestAction.id}`}>View assisted action</Link> : manageable && issue.status !== "ignored" ? <><form action={approveIssue}><input type="hidden" name="issue_id" value={issue.id} /><button className="saas-primary" type="submit">Approve transfer</button></form><form action={modifyRecommendation} className="modify-action"><input type="hidden" name="issue_id" value={issue.id} /><label>Modify quantity<input type="number" name="quantity" defaultValue={recommendation.quantity} min="1" max={recommendation.quantity} required /></label><button type="submit">Save modification</button></form></> : null}</> : <><h2>No safe transfer source found.</h2><p>Create replenishment outside Actnivo and upload a new snapshot when stock arrives.</p></>}
        {manageable && !["resolved", "ignored"].includes(issue.status) && <form action={ignoreIssue} className="ignore-action"><input type="hidden" name="issue_id" value={issue.id} /><button type="submit">Ignore issue</button></form>}
      </section>
    </div>
    <section className="formula-note"><small>FINANCIAL IMPACT FORMULA</small><p>Expected shortage units × current selling price = estimated revenue at risk. No LLM is used in this calculation.</p></section>
  </div>;
}
