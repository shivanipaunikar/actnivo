import assert from "node:assert/strict";
import test from "node:test";
import { deterministicReply } from "../lib/copilot/respond.ts";

const context = {
  generatedAt: "2026-09-13T00:00:00.000Z",
  summary: { activeIssues: 4, revenueAtRisk: 170560, estimatedRevenueProtected: 30000, actualRevenueProtected: 12000, actionsApproved: 1, actionsVerified: 1, lowStockSkus: 2, inventorySkus: 4, openPurchaseOrders: 2, poRiskLines: 1, quickCommerceRevenueAtRisk: 42000, openOrders: 3, orderExceptions: 1, orderRevenueAtRisk: 560 },
  topRisks: [
    { id: "issue-1", type: "STOCKOUT_RISK", severity: "critical", status: "open", title: "Stockout risk", summary: "Bangalore may stock out", sku: "NIAC-30", product: "Niacinamide", location: "Bangalore FC", channel: "blinkit", daysOfCover: 2.2, shortageUnits: 40, revenueAtRisk: 80000, confidence: 0.9, recommendationType: null, purchaseOrderId: null, poNumber: null, recommendation: { quantity: 40, sourceLocation: "Delhi FC", destinationLocation: "Bangalore FC", revenueProtected: 50000, reason: "Safe source" }, href: "/app/ops/issues/issue-1" },
    { id: "issue-2", type: "PO_ARRIVES_AFTER_STOCKOUT", severity: "high", status: "needs_approval", title: "PO arrives after stockout", summary: "PO arrives too late", sku: "CLN-100", product: "Cleanser", location: "Bangalore FC", channel: "blinkit", daysOfCover: 3, shortageUnits: 20, revenueAtRisk: 45000, confidence: 0.88, recommendationType: "EXPEDITE_PO", purchaseOrderId: "po-1", poNumber: "PO-1001", recommendation: null, href: "/app/ops/issues/issue-2" },
    { id: "issue-3", type: "STOCKOUT_RISK", severity: "high", status: "open", title: "Stockout risk", summary: "No safe transfer source", sku: "HA-30", product: "Hyaluronic Acid", location: "Mumbai FC", channel: "zepto", daysOfCover: 2.8, shortageUnits: 50, revenueAtRisk: 45000, confidence: 0.82, recommendationType: null, purchaseOrderId: null, poNumber: null, recommendation: null, href: "/app/ops/issues/issue-3" },
    { id: "issue-4", type: "RTO_RISK", severity: "high", status: "open", title: "COD order ORD-1005 is at RTO risk", summary: "1 delivery attempt has failed for this COD order.", sku: "BW-200", product: "Body Wash", location: "Delhi FC", channel: "amazon", daysOfCover: null, shortageUnits: null, revenueAtRisk: 560, confidence: null, recommendationType: "CREATE_ORDER_RECOVERY_TASK", purchaseOrderId: null, poNumber: null, recommendation: null, href: "/app/ops/issues/issue-4" },
  ],
  inventoryPosition: [
    { sku: "NIAC-30", product: "Niacinamide", available: 20, reserved: 0, inbound: 0, sevenDaySales: 63, daysOfCover: 2.2, status: "Low stock", locations: ["Bangalore FC"], channels: ["blinkit"], href: "/app/inventory/sku-1" },
  ],
  purchaseOrderRisks: [
    { poId: "po-1", poNumber: "PO-1001", poLineId: "line-1", sku: "CLN-100", product: "Cleanser", supplier: "GlowLabs", destination: "Bangalore FC", expectedArrivalDate: "2026-09-20", projectedStockoutAt: "2026-09-17", gapDays: 3, unitsAtRisk: 30, revenueAtRisk: 45000, recommendationType: "EXPEDITE_PO", transfer: null, href: "/app/purchase-orders/po-1" },
  ],
  orderExceptions: [
    { orderId: "order-1", externalOrderId: "ORD-1005", channel: "amazon", fulfillmentStatus: "FULFILLED", paymentMethod: "COD", orderValue: 560, type: "RTO_RISK", severity: "high", reason: "COD order with failed delivery attempt", revenueAtRisk: 560, deliveryAttempts: 1, promisedShipAt: "2026-09-10T08:00:00.000Z", href: "/app/orders/order-1" },
  ],
  quickCommerce: { summary: { revenueAtRisk: 42000 }, channelHealth: [
    { channel: "blinkit", connected: true, health: "Needs Attention", activeSkus: 4, lowStockSkus: 1, stockoutRiskSkus: 1, revenueAtRisk: 42000, sevenDaySales: 150000, inventoryInStockPercent: 75, availabilityConnected: false },
    { channel: "zepto", connected: false, health: "Disconnected", activeSkus: 0, lowStockSkus: 0, stockoutRiskSkus: 0, revenueAtRisk: 0, sevenDaySales: 0, inventoryInStockPercent: null, availabilityConnected: false },
  ] },
  pendingActions: [],
  valueGenerated: { revenueAtRisk: 170560 },
};

test("copilot prioritizes deterministic revenue risk", () => {
  const reply = deterministicReply("What should I focus on today?", context);
  assert.match(reply.answer, /₹1,70,560/);
  assert.match(reply.answer, /NIAC-30/);
  assert.equal(reply.mode, "deterministic");
  assert.equal(reply.proposals[0].type, "CREATE_TRANSFER_PLAN");
  assert.equal(reply.proposals[0].issueId, "issue-1");
});

test("copilot explains late PO and offers grounded expedite proposal", () => {
  const reply = deterministicReply("Which POs arrive too late?", context);
  assert.match(reply.answer, /PO-1001/);
  assert.match(reply.answer, /3 days after projected stockout/);
  assert.match(reply.answer, /expedite the PO/);
  assert.equal(reply.proposals.length, 1);
  assert.equal(reply.proposals[0].type, "EXPEDITE_PO");
  assert.equal(reply.proposals[0].issueId, "issue-2");
});

test("copilot creates replenishment proposal only when safe transfer is unavailable", () => {
  const reply = deterministicReply("What should we replenish?", context);
  assert.equal(reply.proposals.length, 1);
  assert.equal(reply.proposals[0].type, "CREATE_REPLENISHMENT_PLAN");
  assert.equal(reply.proposals[0].issueId, "issue-3");
});

test("copilot preserves disconnected quick-commerce state", () => {
  const reply = deterministicReply("How is Zepto and Blinkit?", context);
  assert.match(reply.answer, /blinkit: Needs Attention/);
  assert.match(reply.answer, /zepto: Disconnected · not connected/);
  assert.match(reply.answer, /will not infer/);
});

test("copilot explains RTO exposure and offers an assisted recovery task", () => {
  const reply = deterministicReply("Which COD orders are at RTO risk?", context);
  assert.match(reply.answer, /ORD-1005/);
  assert.match(reply.answer, /₹560/);
  assert.equal(reply.proposals.length, 1);
  assert.equal(reply.proposals[0].type, "CREATE_ORDER_RECOVERY_TASK");
  assert.equal(reply.proposals[0].issueId, "issue-4");
});
