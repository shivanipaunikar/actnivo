import { selectTransferRecommendation, type ForecastSettings, type TransferCandidate } from "../operations/forecasting.ts";
import type { PurchaseOrderRisk } from "./types.ts";

const DAY_MS = 86_400_000;

function utcDay(value: string) {
  const date = new Date(value.length <= 10 ? `${value}T00:00:00.000Z` : value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function calculatePurchaseOrderRisk(input: {
  poId: string;
  poNumber: string;
  poLineId: string;
  skuId: string;
  masterSku: string;
  productName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  supplierName: string;
  expectedArrivalDate: string;
  projectedStockoutAt: string | null;
  weightedDailyVelocity: number;
  sellingPrice: number;
  confidence: number;
  remainingInboundQuantity: number;
  destinationAvailable: number;
  transferCandidates?: TransferCandidate[];
  settings?: Partial<ForecastSettings>;
}): PurchaseOrderRisk | null {
  if (!input.projectedStockoutAt || input.remainingInboundQuantity <= 0) return null;
  const stockout = utcDay(input.projectedStockoutAt);
  const arrival = utcDay(input.expectedArrivalDate);
  const gapDays = Math.max(0, Math.ceil((arrival.getTime() - stockout.getTime()) / DAY_MS));
  if (gapDays <= 0) return null;

  const unitsAtRisk = Math.max(1, Math.ceil(Math.max(0, input.weightedDailyVelocity) * gapDays));
  const transfer = selectTransferRecommendation({
    destinationAvailable: Math.max(0, input.destinationAvailable),
    destinationVelocity: Math.max(0, input.weightedDailyVelocity),
    shortageUnits: unitsAtRisk,
    sellingPrice: Math.max(0, input.sellingPrice),
    candidates: input.transferCandidates ?? [],
    settings: input.settings,
  });

  return {
    poId: input.poId,
    poNumber: input.poNumber,
    poLineId: input.poLineId,
    skuId: input.skuId,
    masterSku: input.masterSku,
    productName: input.productName,
    destinationLocationId: input.destinationLocationId,
    destinationLocationName: input.destinationLocationName,
    supplierName: input.supplierName,
    projectedStockoutAt: stockout.toISOString(),
    expectedArrivalDate: arrival.toISOString(),
    gapDays,
    weightedDailyVelocity: input.weightedDailyVelocity,
    unitsAtRisk,
    revenueAtRisk: unitsAtRisk * Math.max(0, input.sellingPrice),
    confidence: Math.min(1, Math.max(0, input.confidence)),
    recommendationType: transfer ? "CREATE_TRANSFER_PLAN" : "EXPEDITE_PO",
    ...(transfer ? { transfer: {
      sourceLocationId: transfer.sourceLocationId,
      sourceLocationName: transfer.sourceLocationName,
      quantity: transfer.quantity,
      sourceCoverageAfter: transfer.sourceCoverageAfter,
      destinationCoverageAfter: transfer.destinationCoverageAfter,
      estimatedRevenueProtected: transfer.estimatedRevenueProtected,
    } } : {}),
  };
}

export function classifyPurchaseOrderStatus(input: {
  currentStatus: string;
  expectedDeliveryDate: string;
  orderedQuantity: number;
  confirmedQuantity?: number | null;
  receivedQuantity: number;
  now?: Date;
}) {
  if (input.currentStatus === "CANCELLED") return "CANCELLED" as const;
  const target = Math.max(0, input.confirmedQuantity ?? input.orderedQuantity);
  if (target > 0 && input.receivedQuantity >= target) return "RECEIVED" as const;
  if (input.receivedQuantity > 0) return "PARTIALLY_RECEIVED" as const;
  const expected = utcDay(input.expectedDeliveryDate);
  const now = input.now ?? new Date();
  if (expected.getTime() < utcDay(now.toISOString()).getTime()) return "LATE" as const;
  return input.currentStatus as "DRAFT" | "OPEN" | "ACKNOWLEDGED";
}
