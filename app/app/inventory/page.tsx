import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getInventoryData, titleCaseChannel, type InventoryStatus } from "@/lib/data/inventory";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; location?: string; channel?: string; status?: string; category?: string }> }) {
  const filters = await searchParams;
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const data = await getInventoryData(supabase, organization.id);
  const categories = [...new Set(data.skus.map((sku) => sku.category).filter((category): category is string => Boolean(category)))].sort();
  const channels = [...new Set(data.summaries.flatMap((item) => item.channels))].sort();
  const statuses: InventoryStatus[] = ["Low stock", "Healthy", "Overstock", "No sales data"];
  const search = filters.q?.trim().toLowerCase() ?? "";
  const summaries = data.summaries.filter((item) =>
    (!search || `${item.sku.product_name} ${item.sku.master_sku}`.toLowerCase().includes(search)) &&
    (!filters.location || item.locations.some((location) => location.id === filters.location)) &&
    (!filters.channel || item.channels.includes(filters.channel as never)) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.category || item.sku.category === filters.category)
  );
  const hasSales = data.sales.length > 0;
  return (
    <div className="product-page inventory-page">
      <header className="product-page-header"><div><p>OPERATIONS</p><h1>Inventory</h1><span>Current availability from the latest snapshot at every location and channel.</span></div><div className="header-actions"><Link href="/app/inventory/sku-mapping">SKU mapping</Link><Link className="saas-primary" href="/app/integrations/import">Upload data</Link></div></header>
      {!data.summaries.length ? <section className="inventory-empty"><span>◇</span><small>NO INVENTORY DATA</small><h2>Import inventory to start monitoring availability.</h2><p>Upload a CSV or XLSX file, map its columns, and connect source SKUs to your master catalog.</p><Link className="saas-primary" href="/app/integrations/import">Upload inventory</Link></section> : <>
        {!hasSales && <section className="sales-empty-banner"><div><small>NEXT DATA SOURCE</small><h2>Add sales history to unlock stockout forecasting.</h2></div><Link href="/app/integrations/import">Upload sales →</Link></section>}
        <form className="inventory-filters"><label><span>Search</span><input name="q" defaultValue={filters.q} placeholder="Product or master SKU" /></label><label><span>Location</span><select name="location" defaultValue={filters.location}><option value="">All locations</option>{data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label><span>Channel</span><select name="channel" defaultValue={filters.channel}><option value="">All channels</option>{channels.map((channel) => <option key={channel} value={channel}>{titleCaseChannel(channel)}</option>)}</select></label><label><span>Status</span><select name="status" defaultValue={filters.status}><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label><span>Category</span><select name="category" defaultValue={filters.category}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><button type="submit">Apply filters</button></form>
        <section className="inventory-table-card"><header><div><small>NORMALIZED INVENTORY</small><h2>{summaries.length.toLocaleString("en-IN")} products</h2></div><span>Latest snapshot per source</span></header><div className="inventory-table-scroll"><table><thead><tr><th>Product</th><th>Master SKU</th><th>Available</th><th>Reserved</th><th>Inbound</th><th>Locations</th><th>Channels</th><th>7-day sales</th><th>Days of cover</th><th>Status</th><th>Last updated</th></tr></thead><tbody>{summaries.map((item) => <tr key={item.sku.id}><td><Link href={`/app/inventory/${item.sku.id}`}><strong>{item.sku.product_name}</strong><small>{[item.sku.variant, item.sku.pack_size].filter(Boolean).join(" · ") || item.sku.category || "—"}</small></Link></td><td><code>{item.sku.master_sku}</code></td><td><b>{item.available.toLocaleString("en-IN")}</b></td><td>{item.reserved.toLocaleString("en-IN")}</td><td>{item.inbound.toLocaleString("en-IN")}</td><td>{item.locations.map((location) => location.name).join(", ") || "—"}</td><td>{item.channels.map(titleCaseChannel).join(", ") || "—"}</td><td>{hasSales ? item.sevenDaySales.toLocaleString("en-IN") : "—"}</td><td>{item.daysOfCover === null ? "—" : item.daysOfCover.toFixed(1)}</td><td><span className={`inventory-status ${item.status.toLowerCase().replaceAll(" ", "-")}`}>{item.status}</span></td><td>{new Date(item.lastUpdated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}</tbody></table></div>{!summaries.length && <div className="product-empty small"><p>No inventory matches these filters.</p></div>}</section>
      </>}
    </div>
  );
}
