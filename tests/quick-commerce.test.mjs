import assert from "node:assert/strict";
import test from "node:test";
import { buildQuickCommerceCommandCenter } from "../lib/data/quick-commerce.ts";

const now = new Date("2026-09-12T12:00:00Z");
const created = "2026-09-12T08:00:00Z";

function sku(id, organizationId, code, name) {
  return { id, organization_id: organizationId, master_sku: code, product_name: name, brand: "Actnivo Test", category: "Skin care", variant: null, barcode: null, mrp: "599", selling_price: "400", cost_price: null, pack_size: null, active: true, created_at: created, updated_at: created };
}

function location(id, organizationId, name, city, type = "marketplace_fc") {
  return { id, organization_id: organizationId, name, type, city, state: "Maharashtra", country: "IN", external_id: null, created_at: created, updated_at: created };
}

function snapshot(id, organizationId, skuId, locationId, channel, available) {
  return { id, organization_id: organizationId, sku_id: skuId, location_id: locationId, channel, available_quantity: available, reserved_quantity: 0, inbound_quantity: 0, snapshot_at: created, source_import_id: "import-inventory", source_row_id: `row-${id}`, created_at: created };
}

function sale(id, organizationId, skuId, locationId, channel, date, units, gross) {
  return { id, organization_id: organizationId, sku_id: skuId, location_id: locationId, channel, date, units_sold: units, gross_sales: String(gross), net_sales: null, source_import_id: "import-sales", source_row_id: `row-${id}`, created_at: created, updated_at: created };
}

function forecast(id, organizationId, skuId, locationId, channel, available, velocity, cover) {
  return { id, organization_id: organizationId, sku_id: skuId, location_id: locationId, channel, calculated_at: created, anchor_date: "2026-09-12", available_quantity: available, seven_day_daily_avg: String(velocity), fourteen_day_daily_avg: String(velocity), twenty_eight_day_daily_avg: String(velocity), weighted_daily_velocity: String(velocity), days_of_cover: String(cover), lead_time_days: 7, safety_days: 3, minimum_safety_stock: 0, minimum_safe_denominator: "0.25", estimated_shortage_units: 70, estimated_revenue_at_risk: "28400", projected_stockout_at: "2026-09-14T00:00:00Z", confidence: "0.91", formula_version: "v1", inputs: {} };
}

function issue(id, organizationId, skuId, locationId, channel, risk, severity = "high") {
  return { id, organization_id: organizationId, type: "STOCKOUT_RISK", severity, status: "needs_approval", sku_id: skuId, location_id: locationId, channel, forecast_calculation_id: `forecast-${id}`, title: "Stockout risk", summary: "Deterministic fixture", detected_at: created, days_of_cover: "1.4", estimated_shortage_units: 70, estimated_revenue_at_risk: String(risk), confidence: "0.91", metadata: {}, assigned_to: null, resolved_at: null, updated_at: created };
}

function fixture() {
  const organizationId = "org-a";
  const vc = sku("sku-vc", organizationId, "VC-30", "Vitamin C Serum");
  const niac = sku("sku-niac", organizationId, "NIAC-30", "Niacinamide Serum");
  const bangalore = location("loc-bangalore", organizationId, "Bangalore FC", "Bangalore");
  const mumbai = location("loc-mumbai", organizationId, "Mumbai Warehouse", "Mumbai", "warehouse");
  const blinkitIssue = issue("issue-vc", organizationId, vc.id, bangalore.id, "blinkit", 28400);
  const niacIssue = issue("issue-niac", organizationId, niac.id, bangalore.id, "blinkit", 50000, "critical");
  const recommendation = { id: "rec-vc", organization_id: organizationId, issue_id: blinkitIssue.id, source_location_id: mumbai.id, destination_location_id: bangalore.id, quantity: 70, reason: "Move safe excess inventory", estimated_revenue_protected: "28000", source_coverage_after: "14", destination_coverage_after: "8", calculation: {}, created_at: created, updated_at: created };
  const action = { id: "action-vc", organization_id: organizationId, issue_id: blinkitIssue.id, type: "CREATE_TRANSFER_PLAN", status: "VERIFIED", requested_by: "user-a", approved_by: "user-a", execution_mode: "assisted", payload: {}, idempotency_key: "fixture-action", external_reference: null, created_at: created, approved_at: created, executed_at: created, updated_at: created };
  const dates = Array.from({ length: 7 }, (_, index) => `2026-09-${String(12 - index).padStart(2, "0")}`);

  return {
    organizationId,
    skus: [vc, niac, sku("sku-other", "org-b", "OTHER", "Other Organization Product")],
    locations: [bangalore, mumbai, location("loc-other", "org-b", "Other FC", "Delhi")],
    listings: [],
    snapshots: [
      snapshot("vc-blinkit", organizationId, vc.id, bangalore.id, "blinkit", 43),
      snapshot("vc-zepto", organizationId, vc.id, bangalore.id, "zepto", 118),
      snapshot("vc-instamart", organizationId, vc.id, bangalore.id, "swiggy_instamart", 276),
      snapshot("niac-blinkit", organizationId, niac.id, bangalore.id, "blinkit", 0),
      snapshot("other", "org-b", "sku-other", "loc-other", "blinkit", 999),
    ],
    sales: dates.flatMap((date, index) => [
      sale(`vc-b-${index}`, organizationId, vc.id, bangalore.id, "blinkit", date, 5, 2000),
      sale(`vc-z-${index}`, organizationId, vc.id, bangalore.id, "zepto", date, 3, 1200),
    ]).concat(sale("other", "org-b", "sku-other", "loc-other", "blinkit", "2026-09-12", 999, 999999)),
    forecasts: [
      forecast("forecast-vc-b", organizationId, vc.id, bangalore.id, "blinkit", 43, 30, 1.4),
      forecast("forecast-vc-z", organizationId, vc.id, bangalore.id, "zepto", 118, 24.6, 4.8),
      forecast("forecast-vc-i", organizationId, vc.id, bangalore.id, "swiggy_instamart", 276, 24.6, 11.2),
      forecast("forecast-niac-b", organizationId, niac.id, bangalore.id, "blinkit", 0, 8, 0),
      forecast("forecast-other", "org-b", "sku-other", "loc-other", "blinkit", 999, 1, 999),
    ],
    issues: [blinkitIssue, niacIssue, issue("issue-other", "org-b", "sku-other", "loc-other", "blinkit", 999999)],
    recommendations: [recommendation, { ...recommendation, id: "rec-other", organization_id: "org-b", issue_id: "issue-other" }],
    actions: [action, { ...action, id: "action-other", organization_id: "org-b", issue_id: "issue-other" }],
  };
}

test("aggregates channel health and inventory-backed in-stock percentage", () => {
  const result = buildQuickCommerceCommandCenter(fixture(), {}, now);
  const blinkit = result.channelHealth.find((row) => row.channel === "blinkit");
  assert.equal(blinkit.connected, true);
  assert.equal(blinkit.activeSkus, 2);
  assert.equal(blinkit.inventoryInStockPercent, 50);
  assert.equal(blinkit.stockoutRiskSkus, 2);
  assert.equal(blinkit.revenueAtRisk, 78400);
  assert.equal(blinkit.availabilityConnected, false);
});

test("applies channel and location filters to operating rows", () => {
  const result = buildQuickCommerceCommandCenter(fixture(), { channel: "zepto", city: "Bangalore", location: "loc-bangalore" }, now);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].channel, "zepto");
  assert.equal(result.rows[0].location.city, "Bangalore");
});

test("orders dimensions by revenue risk descending", () => {
  const result = buildQuickCommerceCommandCenter(fixture(), {}, now);
  assert.deepEqual(result.rows.slice(0, 2).map((row) => row.sku.id), ["sku-niac", "sku-vc"]);
});

test("compares the same SKU across quick-commerce channels", () => {
  const result = buildQuickCommerceCommandCenter(fixture(), {}, now);
  const comparison = result.comparisons.find((row) => row.sku.id === "sku-vc");
  assert.ok(comparison);
  assert.equal(comparison.channels.length, 3);
  assert.equal(comparison.channels.find((row) => row.channel === "blinkit").available, 43);
  assert.equal(comparison.channels.find((row) => row.channel === "zepto").available, 118);
});

test("reuses existing recommendation and action records for replenishment", () => {
  const result = buildQuickCommerceCommandCenter(fixture(), {}, now);
  assert.equal(result.replenishments.length, 1);
  assert.equal(result.replenishments[0].recommendation.id, "rec-vc");
  assert.equal(result.replenishments[0].action.id, "action-vc");
  assert.equal(result.opportunities[0].source.id, "loc-mumbai");
});

test("excludes records belonging to another organization", () => {
  const result = buildQuickCommerceCommandCenter(fixture(), {}, now);
  assert.equal(result.rows.some((row) => row.sku.organization_id === "org-b"), false);
  assert.equal(result.summary.sevenDayGmv, 22400);
  assert.equal(result.summary.revenueAtRisk, 78400);
  assert.equal(result.replenishments.some((row) => row.issue.organization_id === "org-b"), false);
});
