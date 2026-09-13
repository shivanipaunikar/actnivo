import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildValueGenerated } from "@/lib/value-generated/metrics";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const pct = (value: number) => `${Math.round(value * 100)}%`;

function ValueList({ rows, empty }: { rows: Array<{ key: string; label: string; value: number }>; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <div className="product-empty"><span>↑</span><h3>{empty}</h3><p>Only successfully verified outcomes are attributed here.</p></div>;
  return <div style={{ display: "grid", gap: 14, padding: "20px 24px 26px" }}>{rows.slice(0, 8).map((row) => <div key={row.key} style={{ display: "grid", gap: 7 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><strong>{row.label}</strong><strong>{money.format(row.value)}</strong></div><div style={{ height: 8, borderRadius: 99, background: "rgba(91,80,255,.09)", overflow: "hidden" }}><div style={{ width: `${Math.max(4, row.value / max * 100)}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#5b50ff,#8580ff)" }} /></div></div>)}</div>;
}

export default async function ValuePage() {
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const db = supabase as any;
  const [issues, actions, outcomes, recommendations, skus, locations] = await Promise.all([
    db.from("issues").select("*").eq("organization_id", organization.id),
    db.from("actions").select("*").eq("organization_id", organization.id),
    db.from("action_outcomes").select("*").eq("organization_id", organization.id),
    db.from("issue_recommendations").select("*").eq("organization_id", organization.id),
    db.from("skus").select("id,master_sku,product_name,selling_price,cost_price").eq("organization_id", organization.id),
    db.from("locations").select("id,name").eq("organization_id", organization.id),
  ]);
  for (const result of [issues, actions, outcomes, recommendations, skus, locations]) if (result.error) throw new Error(result.error.message);
  const value = buildValueGenerated({ issues: issues.data ?? [], actions: actions.data ?? [], outcomes: outcomes.data ?? [], recommendations: recommendations.data ?? [], skus: skus.data ?? [], locations: locations.data ?? [] });
  const s = value.summary;
  const hasHistory = (issues.data ?? []).length > 0 || (actions.data ?? []).length > 0;
  const metrics = [
    ["RISK IDENTIFIED", money.format(s.identifiedRisk), "Detected operational exposure"],
    ["ESTIMATED VALUE", money.format(s.estimatedValue), "Expected protection from tracked actions"],
    ["VERIFIED VALUE", money.format(s.actualValue), "Successful verification only"],
    ["EST. MARGIN PROTECTED", money.format(s.estimatedMarginProtected), `${pct(s.marginCoveragePercent)} of verified value has known cost`],
    ["VERIFICATION RATE", pct(s.verificationRate), `${s.verifiedActions} verified of ${s.approvedActions} approved`],
  ];

  return <div className="product-page value-page"><header className="product-page-header"><div><p>INTELLIGENCE</p><h1>Value Generated</h1><span>What Actnivo protected, grounded in actions and verified outcomes.</span></div><Link href="/app/analytics">Open Analytics →</Link></header>
    <section className="saas-metrics">{metrics.map(([label, amount, note]) => <article key={label}><small>{label}</small><strong>{amount}</strong><p>{note}</p></article>)}</section>
    {!hasHistory ? <section className="inventory-empty" style={{ marginTop: 18 }}><span>↑</span><small>NO OPERATING HISTORY YET</small><h2>Value appears after the operating loop runs.</h2><p>Detect an issue, prepare and approve an action, then verify the outcome.</p><Link className="saas-primary" href="/app/ops">Open Ops Inbox</Link></section> : <>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, marginTop: 18 }}>
        <article className="product-card"><header><div><small>WORKFLOW VALUE</small><h2>Verified value by workflow</h2></div></header><ValueList rows={value.byWorkflow} empty="No verified workflow value yet." /></article>
        <article className="product-card"><header><div><small>SKU VALUE</small><h2>Top value-generating SKUs</h2></div></header><ValueList rows={value.bySku} empty="No verified SKU value yet." /></article>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, marginTop: 18 }}>
        <article className="product-card"><header><div><small>CHANNEL VALUE</small><h2>Verified value by channel</h2></div></header><ValueList rows={value.byChannel} empty="No verified channel value yet." /></article>
        <article className="product-card"><header><div><small>LOCATION VALUE</small><h2>Verified value by location</h2></div></header><ValueList rows={value.byLocation} empty="No verified location value yet." /></article>
      </section>
      <section className="product-card" style={{ marginTop: 18 }}><header><div><small>OPERATING IMPACT</small><h2>What Actnivo changed</h2></div></header><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 18, padding: "22px 24px 26px" }}>
        <article><small>STOCKOUTS PREVENTED</small><strong style={{ display: "block", fontSize: 30, marginTop: 6 }}>{s.stockoutsPrevented}</strong><p>Successful stockout-risk verifications</p></article>
        <article><small>INVENTORY REBALANCED</small><strong style={{ display: "block", fontSize: 30, marginTop: 6 }}>{s.inventoryRebalanced.toLocaleString("en-IN")} units</strong><p>Executed/verified transfer recommendations</p></article>
        <article><small>AVG RESOLUTION TIME</small><strong style={{ display: "block", fontSize: 30, marginTop: 6 }}>{s.averageResolutionHours == null ? "—" : `${s.averageResolutionHours.toFixed(1)} hrs`}</strong><p>Action created to verified</p></article>
        <article><small>AUTOPILOT VERIFIED VALUE</small><strong style={{ display: "block", fontSize: 30, marginTop: 6 }}>{money.format(s.autopilotActual)}</strong><p>Verified value from policy-prepared actions</p></article>
        <article><small>MANUAL VERIFIED VALUE</small><strong style={{ display: "block", fontSize: 30, marginTop: 6 }}>{money.format(s.manualActual)}</strong><p>Verified value from operator-prepared actions</p></article>
      </div></section>
      <section className="product-card" style={{ marginTop: 18 }}><header><div><small>VALUE TREND</small><h2>Verified value over time</h2></div></header><div style={{ padding: "20px 24px 26px" }}>{value.trend.length ? <div style={{ display: "grid", gap: 12 }}>{value.trend.map((row) => <div key={row.month} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(20,20,40,.08)", paddingBottom: 10 }}><span>{row.month}</span><strong>{money.format(row.value)}</strong></div>)}</div> : <p>No verified value trend yet.</p>}</div></section>
      <section className="product-card" style={{ marginTop: 18 }}><header><div><small>ROI READINESS</small><h2>ROI is intentionally not fabricated</h2></div></header><div style={{ padding: "20px 24px 26px" }}><p>Actnivo can calculate product ROI once workspace software cost is configured in Settings. Until then, this page shows verified business value only.</p></div></section>
    </>}
  </div>;
}
