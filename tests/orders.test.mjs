import assert from "node:assert/strict";
import test from "node:test";
import { detectOrderException } from "../lib/orders/intelligence.ts";

const now = new Date("2026-09-13T12:00:00.000Z");
const base = {
  id: "order-1",
  external_order_id: "ORD-1001",
  status: "PROCESSING",
  fulfillment_status: "PROCESSING",
  payment_method: "PREPAID",
  order_value: 2400,
  order_placed_at: "2026-09-10T12:00:00.000Z",
  promised_ship_at: "2026-09-12T00:00:00.000Z",
  shipped_at: null,
  delivered_at: null,
  delivery_attempts: 0,
};

test("flags an order as stuck after 24 hours past promised ship time", () => {
  const issue = detectOrderException(base, now);
  assert.equal(issue?.type, "ORDER_STUCK");
  assert.equal(issue?.revenueAtRisk, 2400);
});

test("flags a short overdue order as delayed", () => {
  const issue = detectOrderException({ ...base, promised_ship_at: "2026-09-13T06:00:00.000Z" }, now);
  assert.equal(issue?.type, "ORDER_DELAYED");
});

test("prioritizes COD failed delivery as RTO risk", () => {
  const issue = detectOrderException({ ...base, payment_method: "COD", delivery_attempts: 2 }, now);
  assert.equal(issue?.type, "RTO_RISK");
  assert.equal(issue?.severity, "critical");
});

test("does not flag terminal orders", () => {
  assert.equal(detectOrderException({ ...base, status: "DELIVERED", delivered_at: "2026-09-12T12:00:00.000Z" }, now), null);
});
