import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { getInventoryData, titleCaseChannel } from "@/lib/data/inventory";
import { getActions, getOpsInbox, getValueMetrics } from "@/lib/data/operations";
import { createClient } from "@/lib/supabase/server";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const commerceTimezone = "Asia/Kolkata";

function dateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatIssueType(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AppDashboardPage() {
  const context = await requireAppContext();
  const supabase = await createClient();
  const [inventory, opsItems, actions, value] = await Promise.all([
    getInventoryData(supabase, context.organization.id),
    getOpsInbox(supabase, context.organization.id),
    getActions(supabase, context.organization.id),
    getValueMetrics(supabase, context.organization.id),
  ]);

  const firstName = context.user.fullName.split(/\s+/)[0];
  const today = dateInTimezone(commerceTimezone);
  const todaysSalesRows = inventory.sales.filter((row) => row.date === today);
  const todaysSales = todaysSalesRows.reduce((sum, row) => sum + Number(row.gross_sales), 0);
  const openIssues = opsItems.filter(({ issue }) => !["resolved", "ignored"].includes(issue.status));
  const protectedRevenue = value.actualRevenueProtected;
  const inventoryWithCost = inventory.summaries.filter(({ sku }) => sku.cost_price !== null);
  const inventoryValue = inventoryWithCost.length === inventory.summaries.length && inventory.summaries.length
    ? inventory.summaries.reduce((sum, row) => sum + row.available * Number(row.sku.cost_price), 0)
    : null;
  const hasAnyData = inventory.snapshots.length > 0 || inventory.sales.length > 0 || opsItems.length > 0 || actions.length > 0;
  const hasSales = inventory.sales.length > 0;
  const hasInventory = inventory.snapshots.length > 0;

  const channelRows = new Map<string, { sales: number; units: number; listings: number }>();
  for (const listing of inventory.listings) {
    const current = channelRows.get(listing.channel) ?? { sales: 0, units: 0, listings: 0 };
    current.listings += 1;
    channelRows.set(listing.channel, current);
  }
  for (const sale of inventory.sales.filter((row) => row.date === today)) {
    const current = channelRows.get(sale.channel) ?? { sales: 0, units: 0, listings: 0 };
    current.sales += Number(sale.gross_sales);
    current.units += sale.units_sold;
    channelRows.set(sale.channel, current);
  }
  const channels = [...channelRows.entries()].sort((a, b) => b[1].sales - a[1].sales);
  const quickCommerceChannels = new Set(["blinkit", "zepto", "swiggy_instamart", "bigbasket"]);
  const quickCommerce = channels.filter(([channel]) => quickCommerceChannels.has(channel));
  const inventoryRisks = inventory.summaries.filter((row) => row.status === "Low stock" || row.status === "Overstock");

  const metrics = [
    {
      label: "TODAY’S SALES",
      value: hasSales ? currency.format(todaysSales) : "—",
      helper: hasSales ? `${todaysSalesRows.reduce((sum, row) => sum + row.units_sold, 0).toLocaleString("en-IN")} units recorded today` : "Connect sales data",
      tone: "default",
    },
    { label: "ORDERS TODAY", value: "—", helper: "Connect order data", tone: "default" },
    {
      label: "INVENTORY VALUE",
      value: inventoryValue === null ? "—" : currency.format(inventoryValue),
      helper: !hasInventory ? "Connect inventory data" : inventoryValue === null ? "Add cost prices to calculate" : `${inventory.summaries.length.toLocaleString("en-IN")} active SKUs`,
      tone: "default",
    },
    {
      label: "REVENUE AT RISK",
      value: openIssues.length ? currency.format(openIssues.reduce((sum, row) => sum + Number(row.issue.estimated_revenue_at_risk ?? 0), 0)) : "—",
      helper: openIssues.length ? `${openIssues.length} open ${openIssues.length === 1 ? "issue" : "issues"}` : "No detected risk yet",
      tone: openIssues.length ? "risk" : "default",
    },
    {
      label: "REVENUE PROTECTED",
      value: protectedRevenue > 0 ? currency.format(protectedRevenue) : "—",
      helper: protectedRevenue > 0 ? "Verified action outcomes" : "No verified outcomes yet",
      tone: protectedRevenue > 0 ? "protected" : "default",
    },
  ] as const;

  return (
    <div className="saas-dashboard">
      <header className="saas-topbar">
        <div className="saas-topbar-workspace"><i /><span><strong>{context.organization.name}</strong><small>Workspace secure</small></span></div>
        <div className="saas-topbar-actions">
          <label className="saas-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search workspace" aria-label="Search workspace (coming soon)" disabled /></label>
          <button type="button" aria-label="Notifications (coming soon)" title="Notifications coming soon" disabled>○</button>
          <Link href="/app/settings" aria-label="Open settings">Settings</Link>
          <Link className="saas-profile-link" href="/app/settings" aria-label="Open profile settings">{firstName.slice(0, 1).toUpperCase()}</Link>
        </div>
      </header>

      <div className="saas-page">
        <div className="saas-welcome">
          <div><p>COMMAND CENTER</p><h1>Welcome, {firstName}.</h1><span>{context.organization.name} · {context.organization.country}</span></div>
          <time>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: commerceTimezone }).format(new Date())}</time>
        </div>

        {/* Visual placeholders only; connect these controls to server queries in a later filtering sprint. */}
        <section className="dashboard-filterbar" aria-label="Dashboard view controls">
          <div className="dashboard-filter-label"><span>VIEW</span><small>Controls coming with data filtering</small></div>
          <div className="dashboard-range" aria-label="Date range">
            <button className="active" type="button" disabled>Today</button>
            <button type="button" disabled>7 days</button>
            <button type="button" disabled>30 days</button>
          </div>
          <label><span>Channel</span><select disabled aria-label="Channel filter (coming soon)"><option>All channels</option></select></label>
          <label><span>Location</span><select disabled aria-label="Location filter (coming soon)"><option>All locations</option></select></label>
        </section>

        {!hasAnyData && <section className="saas-empty-hero">
          <span>01</span>
          <div><small>CONNECT YOUR OPERATIONS</small><h2>No data connected yet.</h2><p>Import a source or connect an integration to start building your unified commerce operations view.</p><div><Link className="saas-primary" href="/app/integrations/import">Import your first data source</Link><Link href="/app/integrations">Connect integration →</Link></div></div>
          <aside><i /><i /><i /><strong>Waiting for your first source</strong></aside>
        </section>}

        <section className="saas-metrics" aria-label="Commerce metrics">
          {metrics.map((metric) => <article className={metric.tone} key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong><p>{metric.helper}</p></article>)}
        </section>

        <div className="dashboard-primary-grid">
          <section className="dashboard-panel dashboard-ops-panel">
            <header><div><small>OPS INBOX</small><h2>Issues that need attention</h2></div><Link href="/app/ops">View all <span aria-hidden="true">→</span></Link></header>
            {!openIssues.length ? <div className="dashboard-empty-state"><i aria-hidden="true">✓</i><p><strong>{hasAnyData ? "No open issues." : "You’re ready to connect."}</strong><span>{hasAnyData ? "New operational risks will appear here when detected." : "Operational issues will appear here after your first import."}</span></p></div> : <div className="dashboard-issue-list">
              {openIssues.slice(0, 4).map(({ issue, sku, location, recommendation }) => <article key={issue.id}>
                <span className={`dashboard-severity ${issue.severity}`}><i />{issue.severity}</span>
                <div><small>{formatIssueType(issue.type)}</small><strong>{sku?.product_name ?? issue.title}</strong><p>{sku?.master_sku ?? "SKU unavailable"} · {issue.channel ? titleCaseChannel(issue.channel) : location?.name ?? "All operations"}</p></div>
                <div className="dashboard-issue-time"><small>TIME REMAINING</small><strong>{issue.days_of_cover === null ? "—" : `${Number(issue.days_of_cover).toFixed(1)} days`}</strong></div>
                <div className="dashboard-issue-value"><small>REVENUE AT RISK</small><strong>{currency.format(Number(issue.estimated_revenue_at_risk ?? 0))}</strong></div>
                <div className="dashboard-issue-action"><small>RECOMMENDED</small><span>{recommendation ? `Move ${recommendation.quantity} units` : "Review replenishment"}</span></div>
                <Link href={`/app/ops/issues/${issue.id}`}>Review</Link>
              </article>)}
            </div>}
          </section>

          <section className="dashboard-panel dashboard-channel-panel">
            <header><div><small>CHANNEL HEALTH</small><h2>Commerce channels</h2></div><Link href="/app/integrations">Manage</Link></header>
            {!channels.length ? <div className="dashboard-empty-compact"><span aria-hidden="true">⇄</span><strong>No channels reporting yet</strong><p>Connect a channel or import sales data to see its health.</p></div> : <div className="dashboard-channel-list">
              {channels.slice(0, 6).map(([channel, data]) => <article key={channel}><span>{titleCaseChannel(channel as Parameters<typeof titleCaseChannel>[0]).slice(0, 1)}</span><div><strong>{titleCaseChannel(channel as Parameters<typeof titleCaseChannel>[0])}</strong><small>{data.listings} listings</small></div><div><strong>{hasSales ? currency.format(data.sales) : "—"}</strong><small>{hasSales ? `${data.units} units today` : "Sales not connected"}</small></div></article>)}
            </div>}
          </section>
        </div>

        <div className="dashboard-secondary-grid">
          <section className="dashboard-panel">
            <header><div><small>INVENTORY RISK</small><h2>Stock coverage</h2></div><Link href="/app/inventory">Inventory</Link></header>
            {!hasInventory ? <div className="dashboard-empty-compact"><span aria-hidden="true">◇</span><strong>Inventory not connected</strong><p>Import inventory to monitor availability and coverage.</p></div> : <div className="dashboard-summary-list"><article><span>Low stock</span><strong>{inventoryRisks.filter((row) => row.status === "Low stock").length}</strong></article><article><span>Overstock</span><strong>{inventoryRisks.filter((row) => row.status === "Overstock").length}</strong></article><article><span>Healthy</span><strong>{inventory.summaries.filter((row) => row.status === "Healthy").length}</strong></article></div>}
          </section>
          <section className="dashboard-panel">
            <header><div><small>QUICK COMMERCE</small><h2>Network pulse</h2></div><Link href="/app/quick-commerce">Open</Link></header>
            {!quickCommerce.length ? <div className="dashboard-empty-compact"><span aria-hidden="true">◫</span><strong>No quick-commerce data</strong><p>Blinkit, Zepto and Instamart activity will appear here.</p></div> : <div className="dashboard-summary-list">{quickCommerce.slice(0, 3).map(([channel, data]) => <article key={channel}><span>{titleCaseChannel(channel as Parameters<typeof titleCaseChannel>[0])}</span><strong>{data.units} units</strong></article>)}</div>}
          </section>
          <section className="dashboard-panel">
            <header><div><small>RECENT ACTIONS</small><h2>Execution activity</h2></div><Link href="/app/actions">View all</Link></header>
            {!actions.length ? <div className="dashboard-empty-compact"><span aria-hidden="true">↯</span><strong>No actions executed yet</strong><p>Approved and verified operational actions will appear here.</p></div> : <div className="dashboard-action-list">{actions.slice(0, 3).map(({ action, issue }) => <Link href={`/app/actions/${action.id}`} key={action.id}><span className={`action-state ${action.status.toLowerCase()}`}>{action.status.replaceAll("_", " ")}</span><strong>{issue?.title ?? formatIssueType(action.type)}</strong><small>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(action.created_at))}</small></Link>)}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
