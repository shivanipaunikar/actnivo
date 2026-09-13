import assert from "node:assert/strict";
import test from "node:test";
import { buildValueGenerated } from "../lib/value-generated/metrics.ts";

test("counts only successful verified value as actual value", () => {
  const result = buildValueGenerated({
    issues: [{ id: "i1", type: "STOCKOUT_RISK", sku_id: "s1", location_id: "l1", channel: "blinkit", estimated_revenue_at_risk: 1000 }],
    actions: [{ id: "a1", issue_id: "i1", status: "VERIFIED", approved_at: "2026-09-13T00:00:00Z", created_at: "2026-09-13T00:00:00Z", payload: {} }],
    outcomes: [
      { action_id: "a1", estimated_value_protected: 900, actual_value_protected: 700, success: true, verification_status: "SUCCESS", verified_at: "2026-09-13T02:00:00Z" },
      { action_id: "a2", estimated_value_protected: 400, actual_value_protected: 400, success: false, verification_status: "FAILED" },
    ],
    recommendations: [{ issue_id: "i1", quantity: 10 }],
    skus: [{ id: "s1", master_sku: "SKU-1", product_name: "Product", selling_price: 100, cost_price: 60 }],
    locations: [{ id: "l1", name: "Delhi FC" }],
  });
  assert.equal(result.summary.actualValue, 700);
  assert.equal(result.summary.estimatedValue, 1300);
  assert.equal(result.summary.estimatedMarginProtected, 280);
  assert.equal(result.summary.averageResolutionHours, 2);
});

test("separates autopilot and manual verified value", () => {
  const result = buildValueGenerated({
    issues: [{ id: "i1", type: "RETURN_STUCK", estimated_revenue_at_risk: 500 }, { id: "i2", type: "ORDER_STUCK", estimated_revenue_at_risk: 600 }],
    actions: [
      { id: "a1", issue_id: "i1", status: "VERIFIED", approved_at: "x", created_at: "2026-09-13T00:00:00Z", payload: { prepared_by: "AUTOPILOT" } },
      { id: "a2", issue_id: "i2", status: "VERIFIED", approved_at: "x", created_at: "2026-09-13T00:00:00Z", payload: {} },
    ],
    outcomes: [
      { action_id: "a1", actual_value_protected: 300, estimated_value_protected: 300, success: true, verification_status: "SUCCESS", verified_at: "2026-09-13T01:00:00Z" },
      { action_id: "a2", actual_value_protected: 200, estimated_value_protected: 200, success: true, verification_status: "SUCCESS", verified_at: "2026-09-13T02:00:00Z" },
    ],
    recommendations: [], skus: [], locations: [],
  });
  assert.equal(result.summary.autopilotActual, 300);
  assert.equal(result.summary.manualActual, 200);
  assert.equal(result.byWorkflow.find((row) => row.label === "Returns & RTO")?.value, 300);
  assert.equal(result.byWorkflow.find((row) => row.label === "Orders")?.value, 200);
});

test("does not estimate protected margin when product cost is missing", () => {
  const result = buildValueGenerated({
    issues: [{ id: "i1", type: "STOCKOUT_RISK", sku_id: "s1", estimated_revenue_at_risk: 1000 }],
    actions: [{ id: "a1", issue_id: "i1", status: "VERIFIED", approved_at: "x", created_at: "2026-09-13T00:00:00Z", payload: {} }],
    outcomes: [{ action_id: "a1", actual_value_protected: 500, estimated_value_protected: 500, success: true, verification_status: "SUCCESS", verified_at: "2026-09-13T01:00:00Z" }],
    recommendations: [],
    skus: [{ id: "s1", master_sku: "SKU-1", product_name: "Product", selling_price: 100, cost_price: null }],
    locations: [],
  });
  assert.equal(result.summary.estimatedMarginProtected, 0);
  assert.equal(result.summary.marginCoveragePercent, 0);
});
