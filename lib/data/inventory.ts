import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelListing, CommerceChannel, Database, InventorySnapshot, Location, SalesDaily, Sku } from "@/lib/supabase/database.types";

export type InventoryStatus = "Low stock" | "Healthy" | "Overstock" | "No sales data";

export type InventorySummary = {
  sku: Sku;
  available: number;
  reserved: number;
  inbound: number;
  locations: Location[];
  channels: CommerceChannel[];
  sevenDaySales: number;
  daysOfCover: number | null;
  status: InventoryStatus;
  lastUpdated: string;
};

function latestSnapshots(snapshots: InventorySnapshot[]) {
  const latest = new Map<string, InventorySnapshot>();
  for (const snapshot of [...snapshots].sort((a, b) => b.snapshot_at.localeCompare(a.snapshot_at))) {
    const key = `${snapshot.sku_id}|${snapshot.location_id}|${snapshot.channel ?? "direct"}`;
    if (!latest.has(key)) latest.set(key, snapshot);
  }
  return [...latest.values()];
}

export function aggregateInventory(
  skus: Sku[],
  locations: Location[],
  listings: ChannelListing[],
  snapshots: InventorySnapshot[],
  sales: SalesDaily[],
  now = new Date(),
) {
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - 6);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const current = latestSnapshots(snapshots);
  return skus.map((sku): InventorySummary => {
    const skuSnapshots = current.filter((snapshot) => snapshot.sku_id === sku.id);
    const skuSales = sales.filter((sale) => sale.sku_id === sku.id && sale.date >= cutoffDate);
    const available = skuSnapshots.reduce((sum, snapshot) => sum + snapshot.available_quantity, 0);
    const sevenDaySales = skuSales.reduce((sum, sale) => sum + sale.units_sold, 0);
    const velocity = sevenDaySales / 7;
    const daysOfCover = velocity > 0 ? available / velocity : null;
    const status: InventoryStatus = daysOfCover === null ? "No sales data" : daysOfCover <= 7 ? "Low stock" : daysOfCover > 60 ? "Overstock" : "Healthy";
    const channelSet = new Set<CommerceChannel>();
    skuSnapshots.forEach((snapshot) => { if (snapshot.channel) channelSet.add(snapshot.channel); });
    listings.filter((listing) => listing.sku_id === sku.id).forEach((listing) => channelSet.add(listing.channel));
    return {
      sku,
      available,
      reserved: skuSnapshots.reduce((sum, snapshot) => sum + snapshot.reserved_quantity, 0),
      inbound: skuSnapshots.reduce((sum, snapshot) => sum + snapshot.inbound_quantity, 0),
      locations: [...new Set(skuSnapshots.map((snapshot) => snapshot.location_id))].map((id) => locationById.get(id)).filter((location): location is Location => Boolean(location)),
      channels: [...channelSet],
      sevenDaySales,
      daysOfCover,
      status,
      lastUpdated: skuSnapshots.map((snapshot) => snapshot.snapshot_at).sort().at(-1) ?? sku.updated_at,
    };
  }).filter((summary) => current.some((snapshot) => snapshot.sku_id === summary.sku.id));
}

async function readAll<T>(loader: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await loader(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return all;
}

export async function getInventoryData(supabase: SupabaseClient<Database>, organizationId: string) {
  const [skus, locations, listings, snapshots, sales] = await Promise.all([
    readAll<Sku>((from, to) => supabase.from("skus").select("*").eq("organization_id", organizationId).eq("active", true).order("product_name").range(from, to)),
    readAll<Location>((from, to) => supabase.from("locations").select("*").eq("organization_id", organizationId).order("name").range(from, to)),
    readAll<ChannelListing>((from, to) => supabase.from("channel_listings").select("*").eq("organization_id", organizationId).range(from, to)),
    readAll<InventorySnapshot>((from, to) => supabase.from("inventory_snapshots").select("*").eq("organization_id", organizationId).order("snapshot_at", { ascending: false }).range(from, to)),
    readAll<SalesDaily>((from, to) => supabase.from("sales_daily").select("*").eq("organization_id", organizationId).order("date", { ascending: false }).range(from, to)),
  ]);
  return { skus, locations, listings, snapshots, sales, summaries: aggregateInventory(skus, locations, listings, snapshots, sales) };
}

export function titleCaseChannel(channel: CommerceChannel) {
  return channel.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
