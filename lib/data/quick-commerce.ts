import type { SupabaseClient } from "@supabase/supabase-js";
import { getInventoryData } from "./inventory.ts";
import { getActions, getOpsInbox } from "./operations.ts";
import type {
  Action,
  ChannelListing,
  CommerceChannel,
  Database,
  ForecastCalculation,
  InventorySnapshot,
  Issue,
  IssueRecommendation,
  Location,
  SalesDaily,
  Sku,
} from "@/lib/supabase/database.types";

export const quickCommerceChannels = ["blinkit", "zepto", "swiggy_instamart"] as const;
export type QuickCommerceChannel = (typeof quickCommerceChannels)[number];
export type QuickCommerceHealth = "Healthy" | "Needs Attention" | "Critical" | "Disconnected";

export type QuickCommerceFilters = {
  channel?: string;
  city?: string;
  location?: string;
};

export type QuickCommerceInput = {
  organizationId: string;
  skus: Sku[];
  locations: Location[];
  listings: ChannelListing[];
  snapshots: InventorySnapshot[];
  sales: SalesDaily[];
  forecasts: ForecastCalculation[];
  issues: Issue[];
  recommendations: IssueRecommendation[];
  actions: Action[];
};

function scoped<T extends { organization_id: string }>(rows: T[], organizationId: string) {
  return rows.filter((row) => row.organization_id === organizationId);
}

function isQuickChannel(channel: CommerceChannel | null): channel is QuickCommerceChannel {
  return channel !== null && quickCommerceChannels.includes(channel as QuickCommerceChannel);
}

function dimensionKey(skuId: string, locationId: string, channel: CommerceChannel | null) {
  return `${skuId}|${locationId}|${channel ?? "direct"}`;
}

function latestSnapshots(rows: InventorySnapshot[]) {
  const latest = new Map<string, InventorySnapshot>();
  for (const row of [...rows].sort((a, b) => b.snapshot_at.localeCompare(a.snapshot_at) || b.created_at.localeCompare(a.created_at))) {
    const key = dimensionKey(row.sku_id, row.location_id, row.channel);
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()];
}

function latestForecasts(rows: ForecastCalculation[]) {
  const latest = new Map<string, ForecastCalculation>();
  for (const row of [...rows].sort((a, b) => b.calculated_at.localeCompare(a.calculated_at))) {
    const key = dimensionKey(row.sku_id, row.location_id, row.channel);
    if (!latest.has(key)) latest.set(key, row);
  }
  return latest;
}

function recentCutoff(now: Date, days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

export function buildQuickCommerceCommandCenter(input: QuickCommerceInput, filters: QuickCommerceFilters = {}, now = new Date()) {
  const organizationId = input.organizationId;
  const skus = scoped(input.skus, organizationId);
  const locations = scoped(input.locations, organizationId);
  const listings = scoped(input.listings, organizationId).filter((row) => quickCommerceChannels.includes(row.channel as QuickCommerceChannel));
  const snapshots = scoped(input.snapshots, organizationId).filter((row) => isQuickChannel(row.channel));
  const sales = scoped(input.sales, organizationId).filter((row) => isQuickChannel(row.channel));
  const forecasts = scoped(input.forecasts, organizationId).filter((row) => isQuickChannel(row.channel));
  const issues = scoped(input.issues, organizationId).filter((row) => isQuickChannel(row.channel));
  const recommendations = scoped(input.recommendations, organizationId);
  const actions = scoped(input.actions, organizationId);

  const skuById = new Map(skus.map((row) => [row.id, row]));
  const locationById = new Map(locations.map((row) => [row.id, row]));
  const forecastByDimension = latestForecasts(forecasts);
  const activeIssueByDimension = new Map(
    issues.filter((row) => !["resolved", "ignored"].includes(row.status)).map((row) => [dimensionKey(row.sku_id, row.location_id ?? "", row.channel), row]),
  );
  const recommendationByIssue = new Map(recommendations.map((row) => [row.issue_id, row]));
  const latestActionByIssue = new Map<string, Action>();
  for (const action of [...actions].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (action.issue_id && !latestActionByIssue.has(action.issue_id)) latestActionByIssue.set(action.issue_id, action);
  }

  const sevenDayCutoff = recentCutoff(now, 7);
  const currentSnapshots = latestSnapshots(snapshots);
  const allRows = currentSnapshots.flatMap((snapshot) => {
    const sku = skuById.get(snapshot.sku_id);
    const location = locationById.get(snapshot.location_id);
    if (!sku || !location || !isQuickChannel(snapshot.channel)) return [];
    const key = dimensionKey(snapshot.sku_id, snapshot.location_id, snapshot.channel);
    const forecast = forecastByDimension.get(key);
    const issue = activeIssueByDimension.get(key);
    const recommendation = issue ? recommendationByIssue.get(issue.id) : undefined;
    const recentSales = sales.filter((sale) => sale.sku_id === snapshot.sku_id
      && sale.location_id === snapshot.location_id
      && sale.channel === snapshot.channel
      && sale.date >= sevenDayCutoff);
    const fallbackVelocity = recentSales.reduce((sum, sale) => sum + sale.units_sold, 0) / 7;
    const dailyVelocity = forecast ? Number(forecast.weighted_daily_velocity) : fallbackVelocity;
    const daysOfCover = forecast ? Number(forecast.days_of_cover) : dailyVelocity > 0 ? snapshot.available_quantity / dailyVelocity : null;
    return [{
      id: key,
      sku,
      location,
      channel: snapshot.channel,
      available: snapshot.available_quantity,
      dailyVelocity,
      daysOfCover,
      projectedStockoutAt: forecast?.projected_stockout_at ?? null,
      revenueAtRisk: Number(issue?.estimated_revenue_at_risk ?? 0),
      issue,
      recommendation,
      recommendedSource: recommendation?.source_location_id ? locationById.get(recommendation.source_location_id) : undefined,
      action: issue ? latestActionByIssue.get(issue.id) : undefined,
      confidence: Number(issue?.confidence ?? forecast?.confidence ?? 0),
      snapshotAt: snapshot.snapshot_at,
    }];
  });

  const cities = [...new Set(allRows.map((row) => row.location.city).filter((city): city is string => Boolean(city)))].sort();
  const locationOptions = [...new Map(allRows.map((row) => [row.location.id, row.location])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const filteredRows = allRows.filter((row) => (!filters.channel || filters.channel === "all" || row.channel === filters.channel)
    && (!filters.city || filters.city === "all" || row.location.city === filters.city)
    && (!filters.location || filters.location === "all" || row.location.id === filters.location))
    .sort((a, b) => b.revenueAtRisk - a.revenueAtRisk || (a.daysOfCover ?? Number.POSITIVE_INFINITY) - (b.daysOfCover ?? Number.POSITIVE_INFINITY));

  const filteredLocationIds = new Set(filteredRows.map((row) => row.location.id));
  const relevantSales = sales.filter((sale) => sale.date >= sevenDayCutoff
    && (!filters.channel || filters.channel === "all" || sale.channel === filters.channel)
    && (!filters.location || filters.location === "all" || sale.location_id === filters.location)
    && (!filters.city || filters.city === "all" || (sale.location_id ? filteredLocationIds.has(sale.location_id) : false)));

  const channelHealth = quickCommerceChannels.map((channel) => {
    const channelRows = allRows.filter((row) => row.channel === channel);
    const channelSales = sales.filter((row) => row.channel === channel && row.date >= sevenDayCutoff);
    const channelListings = listings.filter((row) => row.channel === channel && row.status === "active");
    const channelIssues = channelRows.filter((row) => row.issue);
    const activeSkus = new Set([...channelRows.map((row) => row.sku.id), ...channelListings.map((row) => row.sku_id)]).size;
    const inStockPercent = channelRows.length ? channelRows.filter((row) => row.available > 0).length / channelRows.length * 100 : null;
    const lowStockSkus = new Set(channelRows.filter((row) => row.daysOfCover !== null && row.daysOfCover <= 7).map((row) => row.sku.id)).size;
    const stockoutRiskSkus = new Set(channelIssues.map((row) => row.sku.id)).size;
    const connected = activeSkus > 0 || channelSales.length > 0;
    const health: QuickCommerceHealth = !connected ? "Disconnected" : channelIssues.some((row) => row.issue?.severity === "critical") ? "Critical" : stockoutRiskSkus > 0 || lowStockSkus > 0 ? "Needs Attention" : "Healthy";
    return {
      channel,
      connected,
      activeSkus,
      inventoryInStockPercent: inStockPercent,
      lowStockSkus,
      stockoutRiskSkus,
      revenueAtRisk: channelIssues.reduce((sum, row) => sum + row.revenueAtRisk, 0),
      recentSales: channelSales.reduce((sum, row) => sum + Number(row.gross_sales), 0),
      health,
      availabilityConnected: false,
    };
  });

  const replenishments = filteredRows.filter((row) => row.recommendation).map((row) => ({
    issue: row.issue!,
    recommendation: row.recommendation!,
    sku: row.sku,
    destination: row.location,
    source: row.recommendedSource,
    channel: row.channel,
    currentDaysCover: row.daysOfCover,
    expectedDaysCover: Number(row.recommendation!.destination_coverage_after),
    revenueProtected: Number(row.recommendation!.estimated_revenue_protected),
    confidence: row.confidence,
    action: row.action,
  })).sort((a, b) => b.revenueProtected - a.revenueProtected);

  const comparisonGroups = new Map<string, typeof filteredRows>();
  for (const row of filteredRows) {
    const current = comparisonGroups.get(row.sku.id) ?? [];
    current.push(row);
    comparisonGroups.set(row.sku.id, current);
  }
  const comparisons = [...comparisonGroups.values()].flatMap((rows) => {
    const channels = [...new Set(rows.map((row) => row.channel))];
    if (channels.length < 2) return [];
    return [{
      sku: rows[0].sku,
      channels: channels.map((channel) => {
        const channelRows = rows.filter((row) => row.channel === channel);
        const available = channelRows.reduce((sum, row) => sum + row.available, 0);
        const velocity = channelRows.reduce((sum, row) => sum + row.dailyVelocity, 0);
        return {
          channel,
          available,
          daysOfCover: velocity > 0 ? available / velocity : null,
          revenueAtRisk: channelRows.reduce((sum, row) => sum + row.revenueAtRisk, 0),
        };
      }).sort((a, b) => (a.daysOfCover ?? Number.POSITIVE_INFINITY) - (b.daysOfCover ?? Number.POSITIVE_INFINITY)),
    }];
  });

  return {
    hasQuickCommerceData: channelHealth.some((row) => row.connected),
    summary: {
      hasRiskAnalysis: forecasts.length > 0,
      sevenDayGmv: relevantSales.reduce((sum, row) => sum + Number(row.gross_sales), 0),
      hasSales: relevantSales.length > 0,
      revenueAtRisk: filteredRows.reduce((sum, row) => sum + row.revenueAtRisk, 0),
      skusAtRisk: new Set(filteredRows.filter((row) => row.issue).map((row) => row.sku.id)).size,
      unavailableListings: null as number | null,
      recommendedReplenishments: replenishments.length,
      estimatedValueProtected: replenishments.reduce((sum, row) => sum + row.revenueProtected, 0),
    },
    channelHealth,
    rows: filteredRows,
    replenishments,
    comparisons,
    opportunities: replenishments,
    filters: { cities, locations: locationOptions },
  };
}

async function readRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getQuickCommerceCommandCenter(supabase: SupabaseClient<Database>, organizationId: string, filters: QuickCommerceFilters = {}) {
  const [inventory, opsItems, actionItems, forecasts] = await Promise.all([
    getInventoryData(supabase, organizationId),
    getOpsInbox(supabase, organizationId),
    getActions(supabase, organizationId),
    readRows<ForecastCalculation>(supabase.from("forecast_calculations").select("*").eq("organization_id", organizationId).order("calculated_at", { ascending: false })),
  ]);
  return buildQuickCommerceCommandCenter({
    organizationId,
    ...inventory,
    forecasts,
    issues: opsItems.map((row) => row.issue),
    recommendations: opsItems.flatMap((row) => row.recommendation ? [row.recommendation] : []),
    actions: actionItems.map((row) => row.action),
  }, filters);
}
