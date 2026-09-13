import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildProfitability } from "@/lib/profitability/metrics";
import { updateSkuCost } from "./actions";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const pct = (value: number) => `${Math.round(value * 100)}%`;

function MarginRows({ rows, empty }: { rows: any[]; empty: string }) {
  if (!rows.length) return <div className="product-empty"><span>₹</span><h3>{empty}</h3><p>Profitability populates from sales, product cost, and return/RTO data.</p></div>;
  return <div style={{ padding: "18px 24px 26px", display: "grid", gap: 14 }}>{rows.slice(0, 10).map((row) => <div key={row.key} style={{ display: "grid", gap: 7 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}><span><strong>{row.label}</strong><small style={{ display: "block", opacity: .65 }}>{money.format(row.revenue)} revenue · {pct(row.costCoverage)} cost coverage</small></span><span style={{ textAlign: "right" }}><strong>{money.format(row.knownContribution)}</strong><small style={{ display: "block", opacity: .65 }}>{pct(row.contributionMargin)} contribution</small></span></div><div style={{ height: 8, borderRadius: 99, background: "rgba(91,80,255,.09)", overflow: "hidden" }}><div style={{ width: `${Math.max(3, Math.min(100, Math.max(0, row.contributionMargin) * 100))}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#5b50ff,#8580ff)" }} /></div>{row.leakage > 0 ? <small style={{ opacity: .7 }}>Returns/RTO leakage {money.format(row.leakage)}</small> : null}</div>)}</div>;
}

export default async function ProfitabilityPage() {
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const db = supabase as any;
  const [salesResult, skusResult, returnsResult, returnLinesResult, ordersResult] = await Promise.all([
    db.from("sales_daily").select("*").eq("organization_id", organization.id),
    db.from("skus").select("id,master_sku,product_name,cost_price,selling_price").eq("organization_id", organization.id).order("master_sku"),
    db.from("returns_rto").select("*").eq("organization_id", organization.id),
    db.from("return_rto_lines").select("*").eq("organization_id", organization.id),
    db.from("orders").select("id,channel").eq("organization_id", organization.id),
  ]);
  for (const result of [salesResult, skusResult, returnsResult, returnLinesResult, ordersResult]) if (result.error) throw new Error(result.error.message);
  const profitability = buildProfitability({ sales: salesResult.data ?? [], skus: skusResult.data ?? [], returns: returnsResult.data ?? [], returnLines: returnLinesResult.data ?? [], orders: ordersResult.data ?? [] });
  const s = profitability.summary;
  const hasSales = (salesResult.data ?? []).length > 0;
  const metrics = [
    ["NET SALES", money.format(s.revenue), `${s.units.toLocaleString("en-IN")} units sold`],
    ["KNOWN COGS", money.format(s.knownCogs), `${pct(s.costCoverage)} of revenue has product cost`],
    ["RETURNS / RTO LEAKAGE", money.format(s.leakage), `${money.format(s.refunds)} refunds + ${money.format(s.reverseCost)} reverse cost`],
    ["KNOWN CONTRIBUTION", money.format(s.knownContribution), `${pct(s.contributionMargin)} contribution margin`],
    ["COST COVERAGE", pct(s.costCoverage), `${s.missingCostSkus} SKU${s.missingCostSkus === 1 ? "" : "s"} missing cost`],
  ];

  return <div className="product-page"><header className="product-page-header"><div><p>INTELLIGENCE</p><h1>Profitability</h1><span>Contribution economics from uploaded sales, product cost, refunds, and reverse-logistics spend.</span></div></header>
    <section className="saas-metrics">{metrics.map(([label, value, note]) => <article key={label}><small>{label}</small><strong>{value}</strong><p>{note}</p></article>)}</section>
    {!hasSales ? <section className="inventory-empty" style={{ marginTop: 18 }}><span>₹</span><small>NO SALES HISTORY YET</small><h2>Import sales before calculating profitability.</h2><p>Actnivo will use net sales when available and never invent missing product cost.</p></section> : <>
      {s.costCoverage < 1 ? <section className="product-card" style={{ marginTop: 18, padding: "18px 22px" }}><small style={{ color: "#5b50ff", fontWeight: 700 }}>DATA QUALITY</small><h2 style={{ margin: "6px 0" }}>Profit is partial until product cost is complete.</h2><p style={{ margin: 0 }}>Actnivo is currently showing known contribution only. Missing COGS is not assumed to be zero.</p></section> : null}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 18, marginTop: 18 }}>
        <article className="product-card"><header><div><small>SKU ECONOMICS</small><h2>Profitability by SKU</h2></div></header><MarginRows rows={profitability.bySku} empty="No SKU profitability yet." /></article>
        <article className="product-card"><header><div><small>CHANNEL ECONOMICS</small><h2>Profitability by channel</h2></div></header><MarginRows rows={profitability.byChannel} empty="No channel profitability yet." /></article>
      </section>
      <section className="product-card" style={{ marginTop: 18 }}><header><div><small>SKU × CHANNEL</small><h2>Contribution detail</h2></div></header><div className="simple-table"><div className="simple-table-head"><span>SKU / channel</span><span>Revenue</span><span>COGS</span><span>Leakage</span><span>Contribution</span></div>{profitability.rows.slice(0, 20).map((row) => <div key={row.key}><span><strong>{row.label}</strong><small>{row.units.toLocaleString("en-IN")} units · {pct(row.costCoverage)} cost coverage</small></span><span>{money.format(row.revenue)}</span><span>{money.format(row.knownCogs)}</span><span>{money.format(row.leakage)}</span><span><strong>{money.format(row.knownContribution)}</strong><small>{pct(row.contributionMargin)}</small></span></div>)}</div></section>
    </>}
    <section className="product-card" style={{ marginTop: 18 }}><header><div><small>COST CATALOG</small><h2>Product cost</h2></div><span style={{ opacity: .65 }}>Used for deterministic COGS</span></header><div style={{ padding: "18px 24px 26px", display: "grid", gap: 10 }}>{(skusResult.data ?? []).map((sku: any) => <form action={updateSkuCost} key={sku.id} style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) 160px 100px", gap: 12, alignItems: "center", paddingBottom: 10, borderBottom: "1px solid rgba(20,20,40,.08)" }}><input type="hidden" name="sku_id" value={sku.id} /><span><strong>{sku.master_sku}</strong><small style={{ display: "block", opacity: .65 }}>{sku.product_name}</small></span><label style={{ display: "grid", gap: 4 }}><small>UNIT COST (₹)</small><input name="cost_price" type="number" min="0" step="0.01" defaultValue={sku.cost_price ?? ""} required style={{ minHeight: 38, border: "1px solid rgba(20,20,40,.14)", borderRadius: 8, padding: "0 10px" }} /></label><button className="saas-primary" type="submit">Save cost</button></form>)}</div></section>
  </div>;
}
