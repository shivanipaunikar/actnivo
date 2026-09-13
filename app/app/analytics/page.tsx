import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildAnalytics } from "@/lib/analytics/metrics";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const pct = (value: number) => `${Math.round(value * 100)}%`;

function ExposureList({ rows, empty }: { rows: Array<{ key: string; label: string; count: number; value: number }>; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <div className="product-empty"><span>⌁</span><h3>{empty}</h3><p>Analytics will populate from normalized operational issues.</p></div>;
  return <div style={{ display: "grid", gap: 14, padding: "20px 24px 26px" }}>{rows.slice(0, 8).map((row) => <div key={row.key} style={{ display: "grid", gap: 7 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}><span><strong>{row.label}</strong><small style={{ display: "block", opacity: .65 }}>{row.count} active issue{row.count === 1 ? "" : "s"}</small></span><strong>{money.format(row.value)}</strong></div><div style={{ height: 8, borderRadius: 99, background: "rgba(91,80,255,.09)", overflow: "hidden" }}><div style={{ width: `${Math.max(4, (row.value / max) * 100)}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#5b50ff,#8580ff)" }} /></div></div>)}</div>;
}

export default async function AnalyticsPage() {
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const db = supabase as any;
  const [issuesResult, actionsResult, outcomesResult, skusResult, locationsResult] = await Promise.all([
    db.from("issues").select("*").eq("organization_id", organization.id).order("detected_at", { ascending: false }),
    db.from("actions").select("*").eq("organization_id", organization.id).order("created_at", { ascending: false }),
    db.from("action_outcomes").select("*").eq("organization_id", organization.id),
    db.from("skus").select("id,master_sku,product_name").eq("organization_id", organization.id),
    db.from("locations").select("id,name").eq("organization_id", organization.id),
  ]);
  for (const result of [issuesResult, actionsResult, outcomesResult, skusResult, locationsResult]) if (result.error) throw new Error(result.error.message);
  const analytics = buildAnalytics({ issues: issuesResult.data ?? [], actions: actionsResult.data ?? [], outcomes: outcomesResult.data ?? [], skus: skusResult.data ?? [], locations: locationsResult.data ?? [] });
  const s = analytics.summary;
  const hasData = (issuesResult.data ?? []).length > 0 || (actionsResult.data ?? []).length > 0;
  const metrics = [
    ["ACTIVE ISSUES", s.activeIssues.toLocaleString("en-IN"), "Current operating exceptions"],
    ["REVENUE AT RISK", money.format(s.revenueAtRisk), "Across active issues"],
    ["RESOLUTION RATE", pct(s.resolutionRate), `${s.resolvedIssues} issues resolved`],
    ["WAITING APPROVAL", s.waitingApproval.toLocaleString("en-IN"), "Actions needing operator review"],
    ["AUTOPILOT PREPARED", s.autopilotPrepared.toLocaleString("en-IN"), "Policy-generated actions"],
  ];

  return <div className="product-page"><header className="product-page-header"><div><p>INTELLIGENCE</p><h1>Analytics</h1><span>Operational risk, action throughput, and verified outcomes from your normalized commerce data.</span></div><Link href="/app/ai-copilot">Ask Copilot →</Link></header>
    <section className="saas-metrics">{metrics.map(([label, value, note]) => <article key={label}><small>{label}</small><strong>{value}</strong><p>{note}</p></article>)}</section>
    {!hasData ? <section className="inventory-empty" style={{ marginTop: 18 }}><span>⌁</span><small>NO OPERATING HISTORY YET</small><h2>Analytics appears after Actnivo detects issues and prepares actions.</h2><p>Connect or import commerce data, refresh intelligence, and run the operating loop.</p><Link className="saas-primary" href="/app/ops">Open Ops Inbox</Link></section> : <>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, marginTop: 18 }}>
        <article className="product-card"><header><div><small>RISK MIX</small><h2>Revenue at risk by workflow</h2></div></header><ExposureList rows={analytics.byWorkflow} empty="No active workflow risk." /></article>
        <article className="product-card"><header><div><small>CHANNEL HEALTH</small><h2>Risk by channel</h2></div></header><ExposureList rows={analytics.byChannel} empty="No channel-level risk." /></article>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, marginTop: 18 }}>
        <article className="product-card"><header><div><small>SKU EXPOSURE</small><h2>Top risky SKUs</h2></div></header><ExposureList rows={analytics.bySku} empty="No SKU-level risk." /></article>
        <article className="product-card"><header><div><small>LOCATION EXPOSURE</small><h2>Risk by location</h2></div></header><ExposureList rows={analytics.byLocation} empty="No location-level risk." /></article>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, marginTop: 18 }}>
        <article className="product-card"><header><div><small>SEVERITY</small><h2>Issue severity</h2></div></header><ExposureList rows={analytics.bySeverity} empty="No active severity exposure." /></article>
        <article className="product-card"><header><div><small>ACTION ENGINE</small><h2>Action lifecycle</h2></div></header><div style={{ padding: "18px 24px 26px", display: "grid", gap: 12 }}>{analytics.actionStatus.length ? analytics.actionStatus.map((row) => <div key={row.status} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(20,20,40,.08)", paddingBottom: 10 }}><span>{row.status.replaceAll("_", " ")}</span><strong>{row.count}</strong></div>) : <p>No actions yet.</p>}<div style={{ marginTop: 4, paddingTop: 10 }}><small>VERIFICATION RATE</small><strong style={{ display: "block", fontSize: 28, marginTop: 5 }}>{pct(s.verificationRate)}</strong><p>{s.verifiedActions} verified action{s.verifiedActions === 1 ? "" : "s"}</p></div></div></article>
      </section>
      <section className="product-card" style={{ marginTop: 18 }}><header><div><small>OUTCOMES</small><h2>Value protection</h2></div><Link href="/app/value">Open Value Generated →</Link></header><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, padding: "20px 24px 26px" }}><article><small>ESTIMATED VALUE PROTECTED</small><strong style={{ display: "block", fontSize: 30, marginTop: 7 }}>{money.format(s.estimatedValueProtected)}</strong><p>Across tracked action outcomes</p></article><article><small>ACTUAL VERIFIED VALUE</small><strong style={{ display: "block", fontSize: 30, marginTop: 7 }}>{money.format(s.actualValueProtected)}</strong><p>Only successful verification counts</p></article><article><small>AUTOPILOT SHARE</small><strong style={{ display: "block", fontSize: 30, marginTop: 7 }}>{(actionsResult.data ?? []).length ? pct(s.autopilotPrepared / (actionsResult.data ?? []).length) : "0%"}</strong><p>Of recorded actions prepared by policy</p></article></div></section>
    </>}
  </div>;
}
