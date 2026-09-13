import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePurchaseOrderRisk } from "@/lib/purchase-orders/intelligence";
import type { PurchaseOrderRisk } from "@/lib/purchase-orders/types";
import { defaultForecastSettings } from "@/lib/operations/forecasting";

function latest(rows: any[], key: (row: any) => string, stamp: (row: any) => string) {
  const result = new Map<string, any>();
  for (const row of [...rows].sort((a, b) => stamp(b).localeCompare(stamp(a)))) {
    const value = key(row);
    if (!result.has(value)) result.set(value, row);
  }
  return result;
}

export async function getPurchaseOrderWorkspace(supabase: SupabaseClient<any>, organizationId: string) {
  const db = supabase as any;
  const [pos, lines, locations, skus, forecasts, snapshots, settingsResult] = await Promise.all([
    db.from("purchase_orders").select("*").eq("organization_id", organizationId).order("expected_delivery_date", { ascending: true }),
    db.from("purchase_order_lines").select("*").eq("organization_id", organizationId),
    db.from("locations").select("id,name,city,state").eq("organization_id", organizationId),
    db.from("skus").select("id,master_sku,product_name,selling_price").eq("organization_id", organizationId),
    db.from("forecast_calculations").select("*").eq("organization_id", organizationId).order("calculated_at", { ascending: false }),
    db.from("inventory_snapshots").select("*").eq("organization_id", organizationId).order("snapshot_at", { ascending: false }),
    db.from("organization_operating_settings").select("*").eq("organization_id", organizationId).maybeSingle(),
  ]);
  for (const result of [pos, lines, locations, skus, forecasts, snapshots, settingsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const locationById = new Map((locations.data ?? []).map((row: any) => [row.id, row]));
  const skuById = new Map((skus.data ?? []).map((row: any) => [row.id, row]));
  const latestForecast = latest(forecasts.data ?? [], (row) => `${row.sku_id}|${row.location_id}|${row.channel ?? "direct"}`, (row) => row.calculated_at);
  const latestSnapshot = latest(snapshots.data ?? [], (row) => `${row.sku_id}|${row.location_id}|${row.channel ?? "direct"}`, (row) => `${row.snapshot_at}|${row.created_at}`);
  const settings = settingsResult.data ? {
    leadTimeDays: settingsResult.data.replenishment_lead_time_days,
    safetyDays: settingsResult.data.safety_days,
    minimumSafetyStock: settingsResult.data.minimum_safety_stock,
    targetDaysOfCover: settingsResult.data.target_days_of_cover,
    minimumSafeDenominator: Number(settingsResult.data.minimum_safe_denominator),
    verificationTolerancePercent: Number(settingsResult.data.verification_tolerance_percent),
  } : defaultForecastSettings;

  const risks: PurchaseOrderRisk[] = [];
  for (const line of lines.data ?? []) {
    const po = (pos.data ?? []).find((item: any) => item.id === line.purchase_order_id);
    if (!po || ["RECEIVED", "CANCELLED"].includes(po.status)) continue;
    const sku = skuById.get(line.sku_id) as any;
    const destination = locationById.get(po.destination_location_id) as any;
    if (!sku || !destination) continue;
    const dimensionKey = `${line.sku_id}|${po.destination_location_id}|${po.channel ?? "direct"}`;
    const forecast = latestForecast.get(dimensionKey);
    if (!forecast) continue;
    const destinationSnapshot = latestSnapshot.get(dimensionKey);
    const transferCandidates: Array<{ locationId: string; locationName: string; availableQuantity: number; weightedDailyVelocity: number }> = [];
    for (const [key, snapshot] of latestSnapshot) {
      const [candidateSku, candidateLocation] = key.split("|");
      if (candidateSku !== line.sku_id || candidateLocation === po.destination_location_id) continue;
      const candidateForecast = latestForecast.get(key);
      const candidate = locationById.get(candidateLocation) as any;
      if (!candidateForecast || !candidate) continue;
      transferCandidates.push({ locationId: candidateLocation, locationName: candidate.name, availableQuantity: Number(snapshot.available_quantity), weightedDailyVelocity: Number(candidateForecast.weighted_daily_velocity) });
    }
    const remainingInboundQuantity = Math.max(0, Number(line.confirmed_quantity ?? line.ordered_quantity) - Number(line.received_quantity ?? 0));
    const risk = calculatePurchaseOrderRisk({
      poId: po.id, poNumber: po.external_po_number, poLineId: line.id, skuId: line.sku_id,
      masterSku: sku.master_sku, productName: sku.product_name, destinationLocationId: po.destination_location_id,
      destinationLocationName: destination.name, supplierName: po.supplier_name,
      expectedArrivalDate: line.expected_delivery_date ?? po.expected_delivery_date,
      projectedStockoutAt: forecast.projected_stockout_at,
      weightedDailyVelocity: Number(forecast.weighted_daily_velocity), sellingPrice: Number(sku.selling_price),
      confidence: Number(forecast.confidence), remainingInboundQuantity,
      destinationAvailable: Number(destinationSnapshot?.available_quantity ?? forecast.available_quantity ?? 0),
      transferCandidates, settings,
    });
    if (risk) risks.push(risk);
  }
  risks.sort((a, b) => b.revenueAtRisk - a.revenueAtRisk || b.gapDays - a.gapDays);

  const purchaseOrders = (pos.data ?? []).map((po: any) => {
    const poLines = (lines.data ?? []).filter((line: any) => line.purchase_order_id === po.id);
    const poRisks = risks.filter((risk) => risk.poId === po.id);
    return {
      ...po,
      destination: locationById.get(po.destination_location_id) ?? null,
      skuCount: new Set(poLines.map((line: any) => line.sku_id)).size,
      inboundUnits: poLines.reduce((sum: number, line: any) => sum + Math.max(0, Number(line.confirmed_quantity ?? line.ordered_quantity) - Number(line.received_quantity ?? 0)), 0),
      revenueRisk: poRisks.reduce((sum, risk) => sum + risk.revenueAtRisk, 0),
      atRiskLines: poRisks.length,
      recommendation: poRisks[0]?.recommendationType ?? null,
    };
  });

  return { purchaseOrders, lines: lines.data ?? [], risks, locationById, skuById };
}

export async function getPurchaseOrderDetail(supabase: SupabaseClient<any>, organizationId: string, poId: string) {
  const workspace = await getPurchaseOrderWorkspace(supabase, organizationId);
  const purchaseOrder = workspace.purchaseOrders.find((po: any) => po.id === poId);
  if (!purchaseOrder) return null;
  const lines = workspace.lines.filter((line: any) => line.purchase_order_id === poId).map((line: any) => ({
    ...line,
    sku: workspace.skuById.get(line.sku_id) ?? null,
    risk: workspace.risks.find((risk) => risk.poLineId === line.id) ?? null,
  }));
  return { purchaseOrder, lines, risks: workspace.risks.filter((risk) => risk.poId === poId) };
}
