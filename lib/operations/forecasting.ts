export type ForecastSettings = {
  leadTimeDays: number;
  safetyDays: number;
  minimumSafetyStock: number;
  targetDaysOfCover: number;
  minimumSafeDenominator: number;
  verificationTolerancePercent: number;
};

export const defaultForecastSettings: ForecastSettings = {
  leadTimeDays: 7,
  safetyDays: 3,
  minimumSafetyStock: 0,
  targetDaysOfCover: 21,
  minimumSafeDenominator: 0.1,
  verificationTolerancePercent: 10,
};

export type DailySale = { date: string; units: number };

function utcDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function averageForWindow(sales: DailySale[], anchor: Date, days: number) {
  const start = new Date(anchor);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const total = sales.reduce((sum, sale) => {
    const date = utcDate(sale.date);
    return date >= start && date <= anchor ? sum + Math.max(0, sale.units) : sum;
  }, 0);
  return total / days;
}

export type StockoutForecast = {
  sevenDayDailyAvg: number;
  fourteenDayDailyAvg: number;
  twentyEightDayDailyAvg: number;
  weightedDailyVelocity: number;
  daysOfCover: number;
  stockoutRisk: boolean;
  estimatedShortageUnits: number;
  estimatedRevenueAtRisk: number;
  projectedStockoutAt: string | null;
  confidence: number;
};

export function calculateStockoutForecast(input: {
  availableQuantity: number;
  sellingPrice: number;
  sales: DailySale[];
  anchorDate: string | Date;
  settings?: Partial<ForecastSettings>;
}): StockoutForecast {
  const settings = { ...defaultForecastSettings, ...input.settings };
  const anchor = utcDate(input.anchorDate);
  const sevenDayDailyAvg = averageForWindow(input.sales, anchor, 7);
  const fourteenDayDailyAvg = averageForWindow(input.sales, anchor, 14);
  const twentyEightDayDailyAvg = averageForWindow(input.sales, anchor, 28);
  const weightedDailyVelocity = 0.5 * sevenDayDailyAvg + 0.3 * fourteenDayDailyAvg + 0.2 * twentyEightDayDailyAvg;
  const denominator = Math.max(weightedDailyVelocity, settings.minimumSafeDenominator);
  const availableQuantity = Math.max(0, input.availableQuantity);
  const daysOfCover = availableQuantity / denominator;
  const requiredUnits = (settings.leadTimeDays + settings.safetyDays) * weightedDailyVelocity + settings.minimumSafetyStock;
  const estimatedShortageUnits = Math.max(0, Math.ceil(requiredUnits - availableQuantity));
  const stockoutRisk = daysOfCover < settings.leadTimeDays + settings.safetyDays;
  const projected = weightedDailyVelocity > 0 ? new Date(anchor.getTime() + daysOfCover * 86_400_000).toISOString() : null;
  const observedDays = new Set(input.sales.filter((sale) => sale.units >= 0).map((sale) => sale.date.slice(0, 10))).size;
  return {
    sevenDayDailyAvg,
    fourteenDayDailyAvg,
    twentyEightDayDailyAvg,
    weightedDailyVelocity,
    daysOfCover,
    stockoutRisk,
    estimatedShortageUnits,
    estimatedRevenueAtRisk: estimatedShortageUnits * Math.max(0, input.sellingPrice),
    projectedStockoutAt: projected,
    confidence: Math.min(1, observedDays / 28),
  };
}

export function issueSeverity(daysOfCover: number, leadTimeDays: number) {
  if (daysOfCover <= Math.max(1, leadTimeDays * 0.25)) return "critical" as const;
  if (daysOfCover <= leadTimeDays) return "high" as const;
  if (daysOfCover <= leadTimeDays * 1.5) return "medium" as const;
  return "low" as const;
}

export type TransferCandidate = {
  locationId: string;
  locationName: string;
  availableQuantity: number;
  weightedDailyVelocity: number;
};

export type TransferRecommendation = {
  sourceLocationId: string;
  sourceLocationName: string;
  quantity: number;
  estimatedRevenueProtected: number;
  sourceCoverageAfter: number;
  destinationCoverageAfter: number;
  reason: string;
};

export function selectTransferRecommendation(input: {
  destinationAvailable: number;
  destinationVelocity: number;
  shortageUnits: number;
  sellingPrice: number;
  candidates: TransferCandidate[];
  settings?: Partial<ForecastSettings>;
}): TransferRecommendation | null {
  const settings = { ...defaultForecastSettings, ...input.settings };
  const candidates = input.candidates.map((candidate) => {
    const targetUnits = settings.targetDaysOfCover * candidate.weightedDailyVelocity;
    const safetyUnits = Math.max(settings.minimumSafetyStock, settings.safetyDays * candidate.weightedDailyVelocity);
    const transferable = Math.max(0, Math.floor(Math.min(candidate.availableQuantity - targetUnits, candidate.availableQuantity - safetyUnits)));
    return { ...candidate, transferable };
  }).filter((candidate) => candidate.transferable > 0)
    .sort((a, b) => b.transferable - a.transferable || a.locationId.localeCompare(b.locationId));
  const source = candidates[0];
  if (!source || input.shortageUnits <= 0) return null;
  const quantity = Math.min(input.shortageUnits, source.transferable);
  if (quantity <= 0) return null;
  const sourceDenominator = Math.max(source.weightedDailyVelocity, settings.minimumSafeDenominator);
  const destinationDenominator = Math.max(input.destinationVelocity, settings.minimumSafeDenominator);
  return {
    sourceLocationId: source.locationId,
    sourceLocationName: source.locationName,
    quantity,
    estimatedRevenueProtected: quantity * Math.max(0, input.sellingPrice),
    sourceCoverageAfter: (source.availableQuantity - quantity) / sourceDenominator,
    destinationCoverageAfter: (input.destinationAvailable + quantity) / destinationDenominator,
    reason: `Move ${quantity} units from ${source.locationName}; the source remains above its protected coverage threshold.`,
  };
}

export type ActionState = "CREATED" | "VALIDATED" | "AWAITING_APPROVAL" | "APPROVED" | "EXECUTING" | "EXECUTED" | "VERIFYING" | "VERIFIED" | "FAILED" | "CANCELLED";
const transitions: Record<ActionState, ActionState[]> = {
  CREATED: ["VALIDATED", "CANCELLED", "FAILED"], VALIDATED: ["AWAITING_APPROVAL", "CANCELLED", "FAILED"],
  AWAITING_APPROVAL: ["APPROVED", "CANCELLED"], APPROVED: ["EXECUTING", "CANCELLED", "FAILED"],
  EXECUTING: ["EXECUTED", "FAILED"], EXECUTED: ["VERIFYING", "FAILED"], VERIFYING: ["VERIFIED", "FAILED"],
  VERIFIED: [], FAILED: [], CANCELLED: [],
};

export function canTransitionAction(from: ActionState, to: ActionState) {
  return transitions[from].includes(to);
}

export function createActionIdempotencyKey(organizationId: string, issueId: string, action = "transfer", version = "v1") {
  return `${organizationId}:issue:${issueId}:${action}:${version}`;
}

export function verifyInventoryOutcome(input: {
  beforeQuantity: number;
  expectedQuantity: number;
  actualQuantity: number;
  sellingPrice: number;
  tolerancePercent?: number;
}) {
  const plannedIncrease = Math.max(0, input.expectedQuantity - input.beforeQuantity);
  const tolerance = Math.max(2, plannedIncrease * ((input.tolerancePercent ?? 10) / 100));
  const success = input.actualQuantity >= input.expectedQuantity - tolerance;
  const actualIncrease = Math.max(0, input.actualQuantity - input.beforeQuantity);
  return {
    success,
    toleranceUnits: tolerance,
    actualIncrease,
    actualValueProtected: Math.min(plannedIncrease, actualIncrease) * Math.max(0, input.sellingPrice),
  };
}
