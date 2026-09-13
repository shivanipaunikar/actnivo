import assert from "node:assert/strict";
import test from "node:test";
import { deterministicReply } from "../lib/copilot/respond.ts";

const context = {
  generatedAt: "2026-09-13T00:00:00.000Z",
  summary: { activeIssues: 2, revenueAtRisk: 125000, estimatedRevenueProtected: 30000, actualRevenueProtected: 12000, actionsApproved: 1, actionsVerified: 1, lowStockSkus: 1, inventorySkus: 4, openPurchaseOrders: 2, poRiskLines: 1, quickCommerceRevenueAtRisk: 42000 },
  topRisks: [
    { id: "issue-1", type: "STOCKOUT_RISK", severity: "critical", status: "open", title: "Stockout risk", summary: "Bangalore may stock out", sku: "NIAC-30", product: "Niacinamide", location: "Bangalore FC", channel: "blinkit", daysOfCover: 2.2, shortageUnits: 40, revenueAtRisk: 80000, confidence: 0.9, recommendation: { quantity: 40, sourceLocation: "Delhi FC", destinationLocation: "Bangalore FC", revenueProtected: 50000, reason: "Safe source" }, href: "/app/ops/issues/issue-1" },
  ],
  inventoryPosition: [
    { sku: "NIAC-30", product: "Niacinamide", available: 20, reserved: 0, inbound: 0, sevenDaySales: 63, daysOfCover: 2.2, status: "Low stock", locations: ["Bangalore FC"], channels: ["blinkit"], href: "/app/inventory/sku-1" },
  ],
  purchaseOrderRisks: [
    { poId: "po-1", poNumber: "PO-1001", poLineId: "line-1", sku: "NIAC-30", product: "Niacinamide", supplier: "GlowLabs", destination: "Bangalore FC", expectedArrivalDate: "2026-09-20", projectedStockoutAt: "2026-09-17", gapDays: 3, unitsAtRisk: 30, revenueAtRisk: 45000, recommendationType: "EXPEDITE_PO", transfer: null, href: "/app/purchase-orders/po-1" },
  ],
  quickCommerce: { summary: { revenueAtRisk: 42000 }, channelHealth: [
    { channel: "blinkit", connected: true, health: "Needs Attention", activeSkus: 4, lowStockSkus: 1, stockoutRiskSkus: 1, revenueAtRisk: 42000, sevenDaySales: 150000, inventoryInStockPercent: 75, availabilityConnected: false },
    { channel: "zepto", connected: false, health: "Disconnected", activeSkus: 0, lowStockSkus: 0, stockoutRiskSkus: 0, revenueAtRisk: 0, sevenDaySales: 0, inventoryInStockPercent: null, availabilityConnected: false },
  ] },
  pendingActions: [],
  valueGenerated: { revenueAtRisk: 125000 },
};

test("copilot prioritizes deterministic revenue risk", () => {
  const reply = deterministicReply("What should I focus on today?", context);
  assert.match(reply.answer, /₹1,25,000/);
  assert.match(reply.answer, /NIAC-30/);
  assert.equal(reply.mode, "deterministic");
});

test("copilot explains late PO without inventing execution", () => {
  const reply = deterministicReply("Which POs arrive too late?", context);
  assert.match(reply.answer, /PO-1001/);
  assert.match(reply.answer, /3 days after projected stockout/);
  assert.match(reply.answer, /expedite the PO/);
});

test("copilot preserves disconnected quick-commerce state", () => {
  const reply = deterministicReply("How is Zepto and Blinkit?", context);
  assert.match(reply.answer, /blinkit: Needs Attention/);
  assert.match(reply.answer, /zepto: Disconnected · not connected/);
  assert.match(reply.answer, /will not infer/);
});
