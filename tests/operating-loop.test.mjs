import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateStockoutForecast,
  canTransitionAction,
  createActionIdempotencyKey,
  selectTransferRecommendation,
  verifyInventoryOutcome,
} from "../lib/operations/forecasting.ts";

function sales(days, units, end = "2026-09-28") {
  const anchor = new Date(`${end}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(anchor); date.setUTCDate(date.getUTCDate() - index);
    return { date: date.toISOString().slice(0, 10), units };
  });
}

test("stockout forecast uses weighted 7, 14, and 28-day daily averages", () => {
  const history = [...sales(7, 10), ...sales(7, 5, "2026-09-21"), ...sales(14, 2, "2026-09-14")];
  const result = calculateStockoutForecast({ availableQuantity: 43, sellingPrice: 400, sales: history, anchorDate: "2026-09-28", settings: { leadTimeDays: 7, safetyDays: 3 } });
  assert.equal(result.sevenDayDailyAvg, 10);
  assert.equal(result.fourteenDayDailyAvg, 7.5);
  assert.equal(result.twentyEightDayDailyAvg, 4.75);
  assert.equal(result.weightedDailyVelocity, 8.2);
  assert.equal(Number(result.daysOfCover.toFixed(2)), 5.24);
  assert.equal(result.stockoutRisk, true);
});

test("minimum safe denominator keeps days of cover finite", () => {
  const result = calculateStockoutForecast({ availableQuantity: 12, sellingPrice: 100, sales: [], anchorDate: "2026-09-28", settings: { minimumSafeDenominator: 0.25 } });
  assert.equal(result.daysOfCover, 48);
  assert.equal(Number.isFinite(result.daysOfCover), true);
});

test("revenue risk is expected shortage units times selling price", () => {
  const result = calculateStockoutForecast({ availableQuantity: 20, sellingPrice: 599, sales: sales(28, 5), anchorDate: "2026-09-28", settings: { leadTimeDays: 7, safetyDays: 3, minimumSafetyStock: 5 } });
  assert.equal(result.estimatedShortageUnits, 35);
  assert.equal(result.estimatedRevenueAtRisk, 35 * 599);
});

test("rebalancing selects the safest source and protects its coverage", () => {
  const result = selectTransferRecommendation({ destinationAvailable: 10, destinationVelocity: 10, shortageUnits: 70, sellingPrice: 400, settings: { targetDaysOfCover: 14, safetyDays: 5 }, candidates: [
    { locationId: "small", locationName: "Small FC", availableQuantity: 120, weightedDailyVelocity: 8 },
    { locationId: "mumbai", locationName: "Mumbai Warehouse", availableQuantity: 300, weightedDailyVelocity: 10 },
  ] });
  assert.ok(result);
  assert.equal(result.sourceLocationId, "mumbai");
  assert.equal(result.quantity, 70);
  assert.equal(result.sourceCoverageAfter, 23);
  assert.ok(result.sourceCoverageAfter >= 5);
  assert.equal(result.destinationCoverageAfter, 8);
  assert.equal(result.estimatedRevenueProtected, 28_000);
});

test("rebalancing refuses a source that would fall below protected coverage", () => {
  const result = selectTransferRecommendation({ destinationAvailable: 3, destinationVelocity: 5, shortageUnits: 40, sellingPrice: 300, settings: { targetDaysOfCover: 21, safetyDays: 7, minimumSafetyStock: 20 }, candidates: [
    { locationId: "unsafe", locationName: "Unsafe FC", availableQuantity: 80, weightedDailyVelocity: 4 },
  ] });
  assert.equal(result, null);
});

test("action idempotency and lifecycle are deterministic", () => {
  assert.equal(createActionIdempotencyKey("org-a", "issue-a"), createActionIdempotencyKey("org-a", "issue-a"));
  assert.notEqual(createActionIdempotencyKey("org-a", "issue-a"), createActionIdempotencyKey("org-b", "issue-a"));
  const valid = [["CREATED", "VALIDATED"], ["VALIDATED", "AWAITING_APPROVAL"], ["AWAITING_APPROVAL", "APPROVED"], ["APPROVED", "EXECUTING"], ["EXECUTING", "EXECUTED"], ["EXECUTED", "VERIFYING"], ["VERIFYING", "VERIFIED"]];
  for (const [from, to] of valid) assert.equal(canTransitionAction(from, to), true);
  assert.equal(canTransitionAction("CREATED", "EXECUTED"), false);
  assert.equal(canTransitionAction("VERIFIED", "EXECUTING"), false);
});

test("verification succeeds within tolerance and calculates actual protected value", () => {
  const result = verifyInventoryOutcome({ beforeQuantity: 43, expectedQuantity: 113, actualQuantity: 109, sellingPrice: 400, tolerancePercent: 10 });
  assert.equal(result.success, true);
  assert.equal(result.actualIncrease, 66);
  assert.equal(result.actualValueProtected, 26_400);
});

test("verification fails outside tolerance", () => {
  const result = verifyInventoryOutcome({ beforeQuantity: 43, expectedQuantity: 113, actualQuantity: 90, sellingPrice: 400, tolerancePercent: 10 });
  assert.equal(result.success, false);
  assert.equal(result.actualValueProtected, 18_800);
});

test("migration prevents duplicate active issues and enforces tenant RLS", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260912213038_operating_loop.sql", import.meta.url), "utf8");
  for (const table of ["organization_operating_settings", "forecast_calculations", "issues", "issue_recommendations", "actions", "action_outcomes", "audit_events"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`private\\.(?:is_org_member|can_manage_inventory)\\(organization_id\\)`, "i"));
  }
  assert.match(sql, /create unique index issues_one_active_stockout_key[\s\S]*nulls not distinct[\s\S]*where status in \('open', 'needs_approval', 'running'\)/i);
  assert.match(sql, /idempotency_key text not null unique/i);
  assert.match(sql, /create trigger actions_validate_transition/i);
  assert.doesNotMatch(sql, /grant[^;]*(update|delete)[^;]*audit_events/i);
  assert.doesNotMatch(sql, /grant[^;]*(update|delete)[^;]*forecast_calculations/i);
});
