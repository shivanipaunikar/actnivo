import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { getQuickCommerceCommandCenter, quickCommerceChannels, type QuickCommerceChannel } from "@/lib/data/quick-commerce";
import { titleCaseChannel } from "@/lib/data/inventory";
import { createClient } from "@/lib/supabase/server";
import { approveIssue, ignoreIssue, modifyRecommendation } from "../ops/actions";
import { refreshQuickCommerce } from "./actions";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

function channelName(channel: QuickCommerceChannel) {
  return titleCaseChannel(channel);
}

function metricValue(available: boolean, value: string) {
  return available ? value : "—";
}

export default async function QuickCommercePage({ searchParams }: {
  searchParams: Promise<{ channel?: string; city?: string; location?: string; scan?: string; error?: string }>;
}) {
  const [query, context] = await Promise.all([searchParams, requireAppContext()]);
  const supabase = await createClient();
  const data = await getQuickCommerceCommandCenter(supabase, context.organization.id, query);
  const manageable = canManageInventory(context.role);
  const hasRiskAnalysis = data.summary.hasRiskAnalysis;

  if (!data.hasQuickCommerceData) return <div className="product-page quick-commerce-page">
    <header className="qc-page-header"><div><p>OPERATIONS</p><h1>Quick Commerce</h1><span>Blinkit, Zepto and Swiggy Instamart operations from your imported data.</span></div></header>
    <section className="qc-empty-state"><span aria-hidden="true">◫</span><small>QUICK COMMERCE COMMAND CENTER</small><h2>No quick-commerce data connected.</h2><p>Import inventory or sales tagged with Blinkit, Zepto or Swiggy Instamart to start monitoring channel and location risk.</p><Link className="saas-primary" href="/app/integrations/import">Import quick-commerce data</Link></section>
  </div>;

  return <div className="product-page quick-commerce-page">
    <header className="qc-page-header">
      <div><p>OPERATIONS</p><h1>Quick Commerce Command Center</h1><span>Imported inventory, demand and deterministic risk across Blinkit, Zepto and Swiggy Instamart.</span></div>
      <div><Link href="/app/integrations/import">Import data</Link>{manageable && <form action={refreshQuickCommerce}><button className="saas-primary" type="submit">Refresh risk analysis</button></form>}</div>
    </header>
    {query.scan !== undefined && <p className="product-alert success">Risk analysis refreshed across {query.scan} inventory dimensions.</p>}
    {query.error && <p className="product-alert error">{query.error}</p>}

    <section className="qc-summary-grid" aria-label="Quick-commerce summary">
      <article><small>7-DAY QUICK-COMMERCE GMV</small><strong>{metricValue(data.summary.hasSales, currency.format(data.summary.sevenDayGmv))}</strong><span>{data.summary.hasSales ? "From imported sales" : "Sales data not connected"}</span></article>
      <article className={data.summary.revenueAtRisk > 0 ? "risk" : ""}><small>REVENUE AT RISK</small><strong>{metricValue(hasRiskAnalysis, currency.format(data.summary.revenueAtRisk))}</strong><span>{hasRiskAnalysis ? "Deterministic forecast" : "Run risk analysis"}</span></article>
      <article><small>SKUS AT RISK</small><strong>{metricValue(hasRiskAnalysis, data.summary.skusAtRisk.toLocaleString("en-IN"))}</strong><span>{hasRiskAnalysis ? "Across current filters" : "Run risk analysis"}</span></article>
      <article><small>UNAVAILABLE LISTINGS</small><strong>—</strong><span>Availability data not connected</span></article>
      <article><small>RECOMMENDED REPLENISHMENTS</small><strong>{metricValue(hasRiskAnalysis, data.summary.recommendedReplenishments.toLocaleString("en-IN"))}</strong><span>Existing action engine</span></article>
      <article className={data.summary.estimatedValueProtected > 0 ? "protected" : ""}><small>EST. VALUE PROTECTED</small><strong>{metricValue(hasRiskAnalysis, currency.format(data.summary.estimatedValueProtected))}</strong><span>From current recommendations</span></article>
    </section>

    <section className="qc-section">
      <header><div><small>CHANNEL HEALTH</small><h2>Three channels. One operating view.</h2></div><span>Marketplace availability requires a direct connection.</span></header>
      <div className="qc-channel-grid">{data.channelHealth.map((channel) => <article className={`qc-channel-card ${channel.health.toLowerCase().replace(" ", "-")}`} key={channel.channel}>
        <header><div><span>{channelName(channel.channel).slice(0, 1)}</span><h3>{channelName(channel.channel)}</h3></div><strong><i />{channel.health}</strong></header>
        {!channel.connected ? <div className="qc-disconnected"><strong>Not connected</strong><p>No imported inventory, listings or sales found for this channel.</p><Link href="/app/integrations/import">Import {channelName(channel.channel)} data →</Link></div> : <>
          <div className="qc-channel-stats"><span><small>ACTIVE SKUS</small><strong>{channel.activeSkus}</strong></span><span><small>IN-STOCK</small><strong>{channel.inventoryInStockPercent === null ? "—" : `${decimal.format(channel.inventoryInStockPercent)}%`}</strong></span><span><small>LOW STOCK</small><strong>{channel.lowStockSkus}</strong></span><span><small>AT RISK</small><strong>{channel.stockoutRiskSkus}</strong></span></div>
          <dl><div><dt>Revenue at risk</dt><dd>{hasRiskAnalysis ? currency.format(channel.revenueAtRisk) : "—"}</dd></div><div><dt>Recent sales</dt><dd>{channel.recentSales > 0 ? currency.format(channel.recentSales) : "—"}</dd></div></dl>
          {!channel.availabilityConnected && <p className="qc-availability-note">Availability data not connected.</p>}
        </>}
      </article>)}</div>
    </section>

    <section className="qc-section qc-location-section">
      <header><div><small>LOCATION / CITY VIEW</small><h2>Inventory pressure by operating node</h2></div><span>Sorted by revenue at risk</span></header>
      <form className="qc-filters" method="get">
        <label>City<select name="city" defaultValue={query.city ?? "all"}><option value="all">All cities</option>{data.filters.cities.map((city) => <option value={city} key={city}>{city}</option>)}</select></label>
        <label>Location<select name="location" defaultValue={query.location ?? "all"}><option value="all">All locations</option>{data.filters.locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
        <label>Channel<select name="channel" defaultValue={query.channel ?? "all"}><option value="all">All channels</option>{quickCommerceChannels.map((channel) => <option value={channel} key={channel}>{channelName(channel)}</option>)}</select></label>
        <button type="submit">Apply filters</button>
        {(query.city && query.city !== "all" || query.location && query.location !== "all" || query.channel && query.channel !== "all") && <Link href="/app/quick-commerce">Clear</Link>}
      </form>
      {!data.rows.length ? <div className="qc-inline-empty"><strong>No inventory matches these filters.</strong><span>Adjust the city, location or channel selection.</span></div> : <div className="qc-table-scroll"><table className="qc-location-table"><thead><tr><th>Product</th><th>Channel</th><th>City / location</th><th>Available</th><th>Daily velocity</th><th>Days cover</th><th>Projected stockout</th><th>Revenue risk</th><th>Recommendation</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id}><td><Link href={`/app/inventory/${row.sku.id}`}>{row.sku.product_name}</Link><small>{row.sku.master_sku}</small></td><td><span className="qc-channel-pill">{channelName(row.channel)}</span></td><td>{row.location.city && <small>{row.location.city}</small>}<strong>{row.location.name}</strong></td><td><strong>{row.available}</strong></td><td>{row.dailyVelocity > 0 ? `${decimal.format(row.dailyVelocity)}/day` : "—"}</td><td className={row.issue ? "risk-text" : ""}>{row.daysOfCover === null ? "—" : `${decimal.format(row.daysOfCover)} days`}</td><td>{row.projectedStockoutAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(row.projectedStockoutAt)) : "—"}</td><td className={row.revenueAtRisk > 0 ? "risk-text" : ""}>{row.revenueAtRisk > 0 ? currency.format(row.revenueAtRisk) : "—"}</td><td>{row.recommendation ? <><strong>Move {row.recommendation.quantity}</strong><small>{row.recommendedSource?.name ?? "Source unavailable"} → {row.location.name}</small></> : "—"}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="qc-section qc-replenishment-section">
      <header><div><small>REPLENISHMENT BOARD</small><h2>Recommended replenishments</h2></div><span>{data.replenishments.length} ready for review</span></header>
      {!data.replenishments.length ? <div className="qc-inline-empty"><strong>No replenishments recommended.</strong><span>Recommendations will appear after deterministic risk analysis finds a safe source.</span></div> : <div className="qc-replenishment-list">{data.replenishments.map((item) => <article key={item.issue.id}>
        <div className="qc-replenishment-product"><span className={`qc-severity ${item.issue.severity}`}><i />{item.issue.severity}</span><h3>{item.sku.product_name}</h3><p>{channelName(item.channel)} · {item.destination.name}</p></div>
        <div><small>ROUTE</small><strong>{item.source?.name ?? "Source unavailable"} → {item.destination.name}</strong><span>{item.recommendation.quantity} units to move</span></div>
        <div><small>COVERAGE</small><strong>{item.currentDaysCover === null ? "—" : `${decimal.format(item.currentDaysCover)} → ${decimal.format(item.expectedDaysCover)} days`}</strong><span>Confidence {Math.round(item.confidence * 100)}%</span></div>
        <div><small>VALUE PROTECTED</small><strong className="protected-text">{currency.format(item.revenueProtected)}</strong><span>{item.action?.status.replaceAll("_", " ") ?? "Ready for approval"}</span></div>
        <div className="qc-replenishment-actions"><Link href={`/app/ops/issues/${item.issue.id}`}>Review</Link>{item.action ? <Link className="primary" href={`/app/actions/${item.action.id}`}>View action</Link> : manageable ? <><form action={approveIssue}><input type="hidden" name="issue_id" value={item.issue.id}/><button className="primary" type="submit">Approve</button></form><details><summary>Modify</summary><form action={modifyRecommendation}><input type="hidden" name="issue_id" value={item.issue.id}/><input aria-label={`Units for ${item.sku.product_name}`} type="number" name="quantity" min="1" max={item.recommendation.quantity} defaultValue={item.recommendation.quantity}/><button type="submit">Save</button></form></details><form action={ignoreIssue}><input type="hidden" name="issue_id" value={item.issue.id}/><button className="ignore" type="submit">Ignore</button></form></> : null}</div>
      </article>)}</div>}
    </section>

    <div className="qc-lower-grid">
      <section className="qc-section qc-comparison-section"><header><div><small>CHANNEL COMPARISON</small><h2>Cross-channel imbalance</h2></div></header>{!data.comparisons.length ? <div className="qc-inline-empty"><strong>No comparable SKUs yet.</strong><span>Import the same SKU across two quick-commerce channels to compare coverage.</span></div> : <div className="qc-comparison-list">{data.comparisons.slice(0, 5).map((comparison) => <article key={comparison.sku.id}><h3>{comparison.sku.product_name}</h3><small>{comparison.sku.master_sku}</small><div>{comparison.channels.map((channel) => <span key={channel.channel}><b>{channelName(channel.channel)}</b><strong>{channel.available} units</strong><small>{channel.daysOfCover === null ? "No sales velocity" : `${decimal.format(channel.daysOfCover)} days cover`}</small>{channel.revenueAtRisk > 0 && <em>{currency.format(channel.revenueAtRisk)} risk</em>}</span>)}</div></article>)}</div>}</section>
      <section className="qc-section qc-opportunity-section"><header><div><small>ALLOCATION OPPORTUNITY</small><h2>Inventory that can move</h2></div></header>{!data.opportunities.length ? <div className="qc-inline-empty"><strong>No safe reallocations found.</strong><span>The deterministic rebalance engine protects source coverage before recommending a transfer.</span></div> : <div className="qc-opportunity-list">{data.opportunities.slice(0, 5).map((item) => <article key={item.issue.id}><span>✦</span><div><strong>{item.recommendation.quantity} units could be reallocated from {item.source?.name ?? "a safe source"} to {item.destination.name}.</strong><p>{item.sku.product_name} · {channelName(item.channel)}</p></div><Link href={`/app/ops/issues/${item.issue.id}`}>Review →</Link></article>)}</div>}</section>
    </div>
  </div>;
}
