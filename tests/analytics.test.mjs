import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalytics } from "../lib/analytics/metrics.ts";

test("analytics ranks active risk and excludes resolved exposure", () => {
  const result = buildAnalytics({
    issues: [
      { id: "1", status: "open", type: "STOCKOUT_RISK", severity: "critical", sku_id: "s1", location_id: "l1", channel: "blinkit", estimated_revenue_at_risk: 50000, metadata: {} },
      { id: "2", status: "needs_approval", type: "REFUND_DELAYED", severity: "high", sku_id: "s2", location_id: null, channel: "amazon", estimated_revenue_at_risk: 12000, metadata: { recommendation_type: "CREATE_RETURN_RECOVERY_TASK" } },
      { id: "3", status: "resolved", type: "ORDER_STUCK", severity: "high", sku_id: "s1", location_id: "l1", channel: "shopify", estimated_revenue_at_risk: 99999, metadata: { recommendation_type: "CREATE_ORDER_RECOVERY_TASK" } },
    ],
    actions: [], outcomes: [],
    skus: [{ id: "s1", master_sku: "SKU-1", product_name: "One" }, { id: "s2", master_sku: "SKU-2", product_name: "Two" }],
    locations: [{ id: "l1", name: "Bangalore FC" }],
  });
  assert.equal(result.summary.activeIssues, 2);
  assert.equal(result.summary.revenueAtRisk, 62000);
  assert.equal(result.summary.resolvedIssues, 1);
  assert.equal(result.byWorkflow[0].label, "Inventory");
  assert.equal(result.byWorkflow[0].value, 50000);
  assert.equal(result.byChannel[0].label, "blinkit");
});

test("analytics counts autopilot, approvals and verified outcomes deterministically", () => {
  const result = buildAnalytics({
    issues: [{ id: "1", status: "resolved", type: "STOCKOUT_RISK", severity: "high", estimated_revenue_at_risk: 10000, metadata: {} }],
    actions: [
      { id: "a1", status: "VERIFIED", payload: { prepared_by: "AUTOPILOT" } },
      { id: "a2", status: "AWAITING_APPROVAL", payload: { prepared_by: "AUTOPILOT" } },
      { id: "a3", status: "APPROVED", payload: {} },
    ],
    outcomes: [
      { action_id: "a1", verification_status: "SUCCESS", success: true, estimated_value_protected: 8000, actual_value_protected: 7500 },
      { action_id: "a3", verification_status: "PENDING", success: null, estimated_value_protected: 3000, actual_value_protected: null },
    ],
    skus: [], locations: [],
  });
  assert.equal(result.summary.autopilotPrepared, 2);
  assert.equal(result.summary.waitingApproval, 1);
  assert.equal(result.summary.verifiedActions, 1);
  assert.equal(result.summary.verificationRate, 0.5);
  assert.equal(result.summary.estimatedValueProtected, 11000);
  assert.equal(result.summary.actualValueProtected, 7500);
  assert.equal(result.summary.resolutionRate, 1);
});
