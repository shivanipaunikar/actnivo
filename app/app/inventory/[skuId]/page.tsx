import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { aggregateInventory, titleCaseChannel } from "@/lib/data/inventory";
import type { ChannelListing, InventorySnapshot, Location, SalesDaily, Sku } from "@/lib/supabase/database.types";

export default async function SkuDetailPage({ params }: { params: Promise<{ skuId: string }> }) {
  const { skuId } = await params;
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const [{ data: skuData }, { data: locationsData }, { data: snapshotsData }, { data: salesData }, { data: listingsData }] = await Promise.all([
    supabase.from("skus").select("*").eq("organization_id", organization.id).eq("id", skuId).maybeSingle(),
    supabase.from("locations").select("*").eq("organization_id", organization.id),
    supabase.from("inventory_snapshots").select("*").eq("organization_id", organization.id).eq("sku_id", skuId).order("snapshot_at", { ascending: false }).limit(200),
    supabase.from("sales_daily").select("*").eq("organization_id", organization.id).eq("sku_id", skuId).order("date", { ascending: false }).limit(90),
    supabase.from("channel_listings").select("*").eq("organization_id", organization.id).eq("sku_id", skuId).order("channel"),
  ]);
  if (!skuData) notFound();
  const sku = skuData as Sku;
  const locations = (locationsData ?? []) as Location[];
  const snapshots = (snapshotsData ?? []) as InventorySnapshot[];
  const sales = (salesData ?? []) as SalesDaily[];
  const listings = (listingsData ?? []) as ChannelListing[];
  const summary = aggregateInventory([sku], locations, listings, snapshots, sales)[0];
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const latestLocationMap = new Map<string, InventorySnapshot>();
  snapshots.forEach((snapshot) => { if (!latestLocationMap.has(snapshot.location_id)) latestLocationMap.set(snapshot.location_id, snapshot); });
  const latestByLocation = [...latestLocationMap.values()];
  const importId = snapshots[0]?.source_import_id ?? sales[0]?.source_import_id;
  const { data: sourceImport } = importId ? await supabase.from("import_jobs").select("id,filename,source_type,completed_at").eq("organization_id", organization.id).eq("id", importId).maybeSingle() : { data: null };
  return (
    <div className="product-page sku-detail-page">
      <header className="product-page-header"><div><p>INVENTORY / SKU DETAIL</p><h1>{sku.product_name}</h1><span>{sku.master_sku}{sku.variant ? ` · ${sku.variant}` : ""}{sku.pack_size ? ` · ${sku.pack_size}` : ""}</span></div><Link href="/app/inventory">← Inventory</Link></header>
      <div className="sku-stat-grid"><article><small>TOTAL AVAILABLE</small><strong>{summary?.available.toLocaleString("en-IN") ?? 0}</strong></article><article><small>RESERVED</small><strong>{summary?.reserved.toLocaleString("en-IN") ?? 0}</strong></article><article><small>INBOUND</small><strong>{summary?.inbound.toLocaleString("en-IN") ?? 0}</strong></article><article><small>7-DAY SALES</small><strong>{sales.length ? summary?.sevenDaySales.toLocaleString("en-IN") : "—"}</strong></article><article><small>DAYS OF COVER</small><strong>{summary?.daysOfCover === null || summary?.daysOfCover === undefined ? "—" : summary.daysOfCover.toFixed(1)}</strong></article></div>
      <div className="sku-detail-grid"><section className="product-card"><header><div><small>LOCATION VIEW</small><h2>Inventory by location</h2></div></header><div className="simple-table location-table"><div className="simple-table-head"><span>Location</span><span>Available</span><span>Reserved</span><span>Inbound</span></div>{latestByLocation.map((snapshot) => <div key={snapshot.id}><span><strong>{locationById.get(snapshot.location_id)?.name ?? "Unknown"}</strong><small>{locationById.get(snapshot.location_id)?.city ?? ""}</small></span><span>{snapshot.available_quantity}</span><span>{snapshot.reserved_quantity}</span><span>{snapshot.inbound_quantity}</span></div>)}</div></section><section className="product-card"><header><div><small>CHANNEL VIEW</small><h2>Channel listings</h2></div></header>{listings.length ? <div className="channel-listings">{listings.map((listing) => <div key={listing.id}><span>{titleCaseChannel(listing.channel)}</span><strong>{listing.external_sku}</strong><small>{listing.status}</small></div>)}</div> : <div className="product-empty small"><p>No channel listings linked yet.</p></div>}</section></div>
      <section className="product-card history-card"><header><div><small>APPEND-ONLY HISTORY</small><h2>Recent inventory snapshots</h2></div><span>{snapshots.length} records shown</span></header><div className="simple-table history"><div className="simple-table-head"><span>Date</span><span>Location</span><span>Channel</span><span>Available</span><span>Reserved</span><span>Inbound</span></div>{snapshots.slice(0, 30).map((snapshot) => <div key={snapshot.id}><span>{new Date(snapshot.snapshot_at).toLocaleString("en-IN")}</span><span>{locationById.get(snapshot.location_id)?.name ?? "—"}</span><span>{snapshot.channel ? titleCaseChannel(snapshot.channel) : "Direct"}</span><span>{snapshot.available_quantity}</span><span>{snapshot.reserved_quantity}</span><span>{snapshot.inbound_quantity}</span></div>)}</div></section>
      <div className="sku-detail-grid"><section className="product-card"><header><div><small>SALES VELOCITY</small><h2>Recent daily sales</h2></div></header>{sales.length ? <div className="sales-bars">{sales.slice(0, 14).reverse().map((sale) => <div key={sale.id}><span style={{ height: `${Math.max(8, Math.min(100, sale.units_sold * 4))}%` }} /><small>{new Date(`${sale.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small><b>{sale.units_sold}</b></div>)}</div> : <div className="product-empty small"><p>No sales history linked to this SKU.</p><Link href="/app/integrations/import">Upload sales →</Link></div>}</section><section className="product-card source-card"><header><div><small>DATA LINEAGE</small><h2>Last import source</h2></div></header>{sourceImport ? <div><span>FILE</span><strong>{sourceImport.filename}</strong><small>{sourceImport.source_type} · {sourceImport.completed_at ? new Date(sourceImport.completed_at).toLocaleString("en-IN") : "processing"}</small><Link href={`/app/integrations/import/${sourceImport.id}`}>Open import report →</Link></div> : <div className="product-empty small"><p>No import source is available.</p></div>}</section></div>
    </div>
  );
}
