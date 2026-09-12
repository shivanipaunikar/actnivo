import type { SupabaseClient } from "@supabase/supabase-js";
import { getInventoryData } from "@/lib/data/inventory";
import type { CommerceChannel, Database, InventorySnapshot, Json, SalesDaily } from "@/lib/supabase/database.types";
import {
  calculateStockoutForecast,
  defaultForecastSettings,
  issueSeverity,
  selectTransferRecommendation,
  verifyInventoryOutcome,
  type ForecastSettings,
} from "./forecasting";

type Dimension = {
  skuId: string;
  locationId: string;
  channel: CommerceChannel | null;
  available: number;
  snapshotAt: string;
  createdAt: string;
};

function currentDimensions(snapshots: InventorySnapshot[]) {
  const latest = new Map<string, InventorySnapshot>();
  for (const snapshot of [...snapshots].sort((a, b) => b.snapshot_at.localeCompare(a.snapshot_at) || b.created_at.localeCompare(a.created_at))) {
    const key = `${snapshot.sku_id}|${snapshot.location_id}|${snapshot.channel ?? "direct"}`;
    if (!latest.has(key)) latest.set(key, snapshot);
  }
  return [...latest.values()].map((snapshot): Dimension => ({
    skuId: snapshot.sku_id,
    locationId: snapshot.location_id,
    channel: snapshot.channel,
    available: snapshot.available_quantity,
    snapshotAt: snapshot.snapshot_at,
    createdAt: snapshot.created_at,
  }));
}

function matchingSales(sales: SalesDaily[], dimension: Dimension) {
  return sales.filter((sale) => sale.sku_id === dimension.skuId
    && sale.location_id === dimension.locationId
    && (dimension.channel === null || sale.channel === dimension.channel));
}

function money(value: number) { return value.toFixed(2); }
function decimal(value: number, digits = 6) { return value.toFixed(digits); }

async function getSettings(supabase: SupabaseClient<Database>, organizationId: string, actorId: string) {
  const existing = await supabase.from("organization_operating_settings").select("*").eq("organization_id", organizationId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data) {
    const created = await supabase.from("organization_operating_settings").insert({ organization_id: organizationId, updated_by: actorId }).select("*").single();
    if (created.error) throw new Error(created.error.message);
    return created.data;
  }
  return existing.data;
}

function settingsFromRow(row: Awaited<ReturnType<typeof getSettings>>): ForecastSettings {
  return {
    leadTimeDays: row.replenishment_lead_time_days,
    safetyDays: row.safety_days,
    minimumSafetyStock: row.minimum_safety_stock,
    targetDaysOfCover: row.target_days_of_cover,
    minimumSafeDenominator: Number(row.minimum_safe_denominator),
    verificationTolerancePercent: Number(row.verification_tolerance_percent),
  };
}

async function audit(supabase: SupabaseClient<Database>, organizationId: string, actorId: string, entityType: string, entityId: string, eventType: string, before: Json | null, after: Json | null) {
  const { error } = await supabase.from("audit_events").insert({ organization_id: organizationId, actor_id: actorId, entity_type: entityType, entity_id: entityId, event_type: eventType, before_state: before, after_state: after });
  if (error) throw new Error(error.message);
}

async function existingActiveIssue(supabase: SupabaseClient<Database>, organizationId: string, dimension: Dimension) {
  let query = supabase.from("issues").select("*").eq("organization_id", organizationId).eq("type", "STOCKOUT_RISK")
    .eq("sku_id", dimension.skuId).eq("location_id", dimension.locationId).in("status", ["open", "needs_approval", "running"]);
  query = dimension.channel ? query.eq("channel", dimension.channel) : query.is("channel", null);
  const result = await query.maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function verifyPendingActions(supabase: SupabaseClient<Database>, organizationId: string, actorId: string, settings: ForecastSettings, dimensions: Dimension[]) {
  const pending = await supabase.from("actions").select("*").eq("organization_id", organizationId).eq("status", "VERIFYING");
  if (pending.error) throw new Error(pending.error.message);
  for (const action of pending.data ?? []) {
    const payload = action.payload as Record<string, unknown>;
    const destinationLocationId = String(payload.destination_location_id ?? "");
    const skuId = String(payload.sku_id ?? "");
    const channel = (payload.channel || null) as CommerceChannel | null;
    const beforeQuantity = Number(payload.before_quantity ?? 0);
    const expectedQuantity = Number(payload.expected_quantity ?? 0);
    const sellingPrice = Number(payload.selling_price ?? 0);
    const actual = dimensions.find((item) => item.skuId === skuId && item.locationId === destinationLocationId && item.channel === channel);
    if (!actual || (action.executed_at && actual.createdAt <= action.executed_at)) continue;
    const verification = verifyInventoryOutcome({ beforeQuantity, expectedQuantity, actualQuantity: actual.available, sellingPrice, tolerancePercent: settings.verificationTolerancePercent });
    const outcome = await supabase.from("action_outcomes").select("*").eq("organization_id", organizationId).eq("action_id", action.id).single();
    if (outcome.error) throw new Error(outcome.error.message);
    const actualState = { available_quantity: actual.available, snapshot_at: actual.snapshotAt, tolerance_units: verification.toleranceUnits } as Json;
    const outcomeUpdate = await supabase.from("action_outcomes").update({ actual_state: actualState, actual_value_protected: money(verification.actualValueProtected), success: verification.success, verification_status: verification.success ? "SUCCESS" : "FAILED", verified_at: new Date().toISOString() })
      .eq("organization_id", organizationId).eq("id", outcome.data.id);
    if (outcomeUpdate.error) throw new Error(outcomeUpdate.error.message);
    const actionUpdate = await supabase.from("actions").update({ status: verification.success ? "VERIFIED" : "FAILED" }).eq("organization_id", organizationId).eq("id", action.id);
    if (actionUpdate.error) throw new Error(actionUpdate.error.message);
    if (action.issue_id) {
      const issueUpdate = await supabase.from("issues").update({ status: verification.success ? "resolved" : "needs_approval", resolved_at: verification.success ? new Date().toISOString() : null }).eq("organization_id", organizationId).eq("id", action.issue_id);
      if (issueUpdate.error) throw new Error(issueUpdate.error.message);
    }
    await audit(supabase, organizationId, actorId, "action", action.id, "verification_completed", outcome.data.actual_state, actualState);
  }
}

export async function runOperatingLoop(supabase: SupabaseClient<Database>, organization: { id: string; country: string }, actorId: string, now = new Date()) {
  const [data, settingsRow] = await Promise.all([getInventoryData(supabase, organization.id), getSettings(supabase, organization.id, actorId)]);
  const settings = settingsFromRow(settingsRow);
  const dimensions = currentDimensions(data.snapshots);
  await verifyPendingActions(supabase, organization.id, actorId, settings, dimensions);
  if (!dimensions.length || !data.sales.length) return { calculations: 0, issues: 0, recommendations: 0 };

  const locationById = new Map(data.locations.map((location) => [location.id, location]));
  const skuById = new Map(data.skus.map((sku) => [sku.id, sku]));
  const forecasts = dimensions.map((dimension) => {
    const sales = matchingSales(data.sales, dimension);
    const anchorCandidates = [now.toISOString().slice(0, 10), ...sales.map((sale) => sale.date), dimension.snapshotAt.slice(0, 10)].sort();
    const anchorDate = anchorCandidates.at(-1)!;
    const sku = skuById.get(dimension.skuId)!;
    return { dimension, sku, anchorDate, sales, forecast: calculateStockoutForecast({ availableQuantity: dimension.available, sellingPrice: Number(sku.selling_price), sales: sales.map((sale) => ({ date: sale.date, units: sale.units_sold })), anchorDate, settings }) };
  });

  let issueCount = 0;
  let recommendationCount = 0;
  for (const item of forecasts) {
    const { dimension, sku, forecast, anchorDate, sales } = item;
    const calculation = await supabase.from("forecast_calculations").insert({
      organization_id: organization.id, sku_id: dimension.skuId, location_id: dimension.locationId, channel: dimension.channel,
      anchor_date: anchorDate, available_quantity: dimension.available, seven_day_daily_avg: decimal(forecast.sevenDayDailyAvg),
      fourteen_day_daily_avg: decimal(forecast.fourteenDayDailyAvg), twenty_eight_day_daily_avg: decimal(forecast.twentyEightDayDailyAvg),
      weighted_daily_velocity: decimal(forecast.weightedDailyVelocity), days_of_cover: decimal(forecast.daysOfCover, 4),
      lead_time_days: settings.leadTimeDays, safety_days: settings.safetyDays, minimum_safety_stock: settings.minimumSafetyStock,
      minimum_safe_denominator: decimal(settings.minimumSafeDenominator, 4), estimated_shortage_units: forecast.estimatedShortageUnits,
      estimated_revenue_at_risk: money(forecast.estimatedRevenueAtRisk), projected_stockout_at: forecast.projectedStockoutAt,
      confidence: decimal(forecast.confidence, 4), inputs: { sales_days: sales.length, selling_price: Number(sku.selling_price), weights: { seven: 0.5, fourteen: 0.3, twenty_eight: 0.2 } },
    }).select("*").single();
    if (calculation.error) throw new Error(calculation.error.message);
    const existing = await existingActiveIssue(supabase, organization.id, dimension);
    if (!forecast.stockoutRisk) {
      if (existing) {
        const resolved = await supabase.from("issues").update({ status: "resolved", resolved_at: new Date().toISOString(), forecast_calculation_id: calculation.data.id }).eq("organization_id", organization.id).eq("id", existing.id);
        if (resolved.error) throw new Error(resolved.error.message);
        await audit(supabase, organization.id, actorId, "issue", existing.id, "issue_resolved", existing as unknown as Json, { reason: "coverage_recovered" });
      }
      continue;
    }
    const location = locationById.get(dimension.locationId)!;
    const issueRecord = {
      organization_id: organization.id, type: "STOCKOUT_RISK" as const, severity: issueSeverity(forecast.daysOfCover, settings.leadTimeDays),
      status: existing?.status ?? "open", sku_id: dimension.skuId, location_id: dimension.locationId, channel: dimension.channel,
      forecast_calculation_id: calculation.data.id, title: `${sku.product_name} may stock out`,
      summary: `${dimension.available} units remain at ${location.name}; weighted demand is ${forecast.weightedDailyVelocity.toFixed(1)} units/day.`,
      days_of_cover: decimal(forecast.daysOfCover, 4), estimated_shortage_units: forecast.estimatedShortageUnits,
      estimated_revenue_at_risk: money(forecast.estimatedRevenueAtRisk), confidence: decimal(forecast.confidence, 4),
      metadata: { formula: "expected_shortage_units × current_selling_price", formula_version: "stockout-v1", selling_price: Number(sku.selling_price) } as Json,
    };
    let issueId: string;
    if (existing) {
      const updated = await supabase.from("issues").update(issueRecord).eq("organization_id", organization.id).eq("id", existing.id).select("id").single();
      if (updated.error) throw new Error(updated.error.message);
      issueId = updated.data.id;
    } else {
      const created = await supabase.from("issues").insert(issueRecord).select("id").single();
      if (created.error) throw new Error(created.error.message);
      issueId = created.data.id;
      await audit(supabase, organization.id, actorId, "issue", issueId, "issue_detected", null, issueRecord as unknown as Json);
    }
    issueCount += 1;

    const candidatesByLocation = new Map<string, { available: number; velocity: number }>();
    for (const source of forecasts.filter((candidate) => candidate.dimension.skuId === dimension.skuId && candidate.dimension.locationId !== dimension.locationId)) {
      const current = candidatesByLocation.get(source.dimension.locationId) ?? { available: 0, velocity: 0 };
      current.available += source.dimension.available;
      current.velocity += source.forecast.weightedDailyVelocity;
      candidatesByLocation.set(source.dimension.locationId, current);
    }
    const recommendation = selectTransferRecommendation({
      destinationAvailable: dimension.available, destinationVelocity: forecast.weightedDailyVelocity, shortageUnits: forecast.estimatedShortageUnits,
      sellingPrice: Number(sku.selling_price), settings,
      candidates: [...candidatesByLocation].map(([locationId, source]) => ({ locationId, locationName: locationById.get(locationId)?.name ?? "Source location", availableQuantity: source.available, weightedDailyVelocity: source.velocity })),
    });
    if (recommendation) {
      const recommendationRecord = {
        organization_id: organization.id, issue_id: issueId, source_location_id: recommendation.sourceLocationId,
        destination_location_id: dimension.locationId, quantity: recommendation.quantity, reason: recommendation.reason,
        estimated_revenue_protected: money(recommendation.estimatedRevenueProtected), source_coverage_after: decimal(recommendation.sourceCoverageAfter, 4),
        destination_coverage_after: decimal(recommendation.destinationCoverageAfter, 4), calculation: {
          formula_version: "rebalance-v1", target_days_of_cover: settings.targetDaysOfCover, safety_days: settings.safetyDays,
          source_available: candidatesByLocation.get(recommendation.sourceLocationId)?.available ?? 0,
          destination_available: dimension.available,
          source_velocity: candidatesByLocation.get(recommendation.sourceLocationId)?.velocity ?? 0,
          destination_velocity: forecast.weightedDailyVelocity,
          minimum_safe_denominator: settings.minimumSafeDenominator,
          selling_price: Number(sku.selling_price),
        } as Json,
      };
      const saved = await supabase.from("issue_recommendations").upsert(recommendationRecord, { onConflict: "issue_id" });
      if (saved.error) throw new Error(saved.error.message);
      const issueStatus = await supabase.from("issues").update({ status: "needs_approval" }).eq("organization_id", organization.id).eq("id", issueId).eq("status", "open");
      if (issueStatus.error) throw new Error(issueStatus.error.message);
      if (!existing) await audit(supabase, organization.id, actorId, "issue", issueId, "recommendation_generated", null, recommendationRecord as unknown as Json);
      recommendationCount += 1;
    }
  }
  return { calculations: forecasts.length, issues: issueCount, recommendations: recommendationCount };
}

export { defaultForecastSettings };
