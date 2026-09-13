import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculatePurchaseOrderRisk, classifyPurchaseOrderStatus } from "../lib/purchase-orders/intelligence.ts";

test("PO risk detects arrival after projected stockout and quantifies revenue", () => {
  const result = calculatePurchaseOrderRisk({
    poId: "po-1", poNumber: "PO-100", poLineId: "line-1", skuId: "sku-1", masterSku: "SERUM-1",
    productName: "Serum", destinationLocationId: "blr", destinationLocationName: "Bangalore FC", supplierName: "Supplier",
    expectedArrivalDate: "2026-09-17", projectedStockoutAt: "2026-09-14T00:00:00.000Z",
    weightedDailyVelocity: 10, sellingPrice: 400, confidence: 0.9, remainingInboundQuantity: 100, destinationAvailable: 5,
    transferCandidates: [],
  });
  assert.ok(result);
  assert.equal(result.gapDays, 3);
  assert.equal(result.unitsAtRisk, 30);
  assert.equal(result.revenueAtRisk, 12000);
  assert.equal(result.recommendationType, "EXPEDITE_PO");
});

test("PO risk prefers a safe transfer before expedite", () => {
  const result = calculatePurchaseOrderRisk({
    poId: "po-1", poNumber: "PO-100", poLineId: "line-1", skuId: "sku-1", masterSku: "SERUM-1",
    productName: "Serum", destinationLocationId: "blr", destinationLocationName: "Bangalore FC", supplierName: "Supplier",
    expectedArrivalDate: "2026-09-17", projectedStockoutAt: "2026-09-14T00:00:00.000Z",
    weightedDailyVelocity: 10, sellingPrice: 400, confidence: 0.9, remainingInboundQuantity: 100, destinationAvailable: 5,
    settings: { targetDaysOfCover: 10, safetyDays: 3 },
    transferCandidates: [{ locationId: "mum", locationName: "Mumbai", availableQuantity: 300, weightedDailyVelocity: 10 }],
  });
  assert.ok(result?.transfer);
  assert.equal(result?.recommendationType, "CREATE_TRANSFER_PLAN");
  assert.equal(result?.transfer?.quantity, 30);
});

test("PO risk is null when supply arrives before stockout", () => {
  const result = calculatePurchaseOrderRisk({
    poId: "po-1", poNumber: "PO-100", poLineId: "line-1", skuId: "sku-1", masterSku: "SERUM-1",
    productName: "Serum", destinationLocationId: "blr", destinationLocationName: "Bangalore FC", supplierName: "Supplier",
    expectedArrivalDate: "2026-09-12", projectedStockoutAt: "2026-09-14T00:00:00.000Z",
    weightedDailyVelocity: 10, sellingPrice: 400, confidence: 0.9, remainingInboundQuantity: 100, destinationAvailable: 5,
  });
  assert.equal(result, null);
});

test("receipt status transitions are deterministic", () => {
  assert.equal(classifyPurchaseOrderStatus({ currentStatus: "OPEN", expectedDeliveryDate: "2026-09-20", orderedQuantity: 100, receivedQuantity: 25, now: new Date("2026-09-15T00:00:00Z") }), "PARTIALLY_RECEIVED");
  assert.equal(classifyPurchaseOrderStatus({ currentStatus: "OPEN", expectedDeliveryDate: "2026-09-20", orderedQuantity: 100, receivedQuantity: 100, now: new Date("2026-09-15T00:00:00Z") }), "RECEIVED");
  assert.equal(classifyPurchaseOrderStatus({ currentStatus: "OPEN", expectedDeliveryDate: "2026-09-10", orderedQuantity: 100, receivedQuantity: 0, now: new Date("2026-09-15T00:00:00Z") }), "LATE");
});

test("4B migration adds RLS, PO issue types, action type and tenant-safe foreign keys", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260913030000_purchase_order_intelligence.sql", import.meta.url), "utf8");
  assert.match(sql, /create table public\.purchase_orders/i);
  assert.match(sql, /create table public\.purchase_order_lines/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /PO_ARRIVES_AFTER_STOCKOUT/i);
  assert.match(sql, /EXPEDITE_PO/i);
  assert.match(sql, /connections_id_organization_key unique \(id, organization_id\)/i);
  assert.match(sql, /purchase_order_lines_sync_status_insert_delete/i);
  assert.match(sql, /purchase_order_lines_sync_status_update/i);
});
