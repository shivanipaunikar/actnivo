import assert from "node:assert/strict";
import test from "node:test";
import { parseOrderFile } from "../lib/orders/file-import.ts";

const csv = `Order ID,Channel,Location,Order Status,Fulfillment Status,Payment Method,Order Value,Customer City,Order Date,Promised Ship At,Delivery Attempts,SKU,Quantity,Unit Price\nORD-1001,shopify,Bangalore FC,PROCESSING,PROCESSING,PREPAID,1200,Bengaluru,2026-09-12T08:00:00Z,2026-09-13T08:00:00Z,0,NIAC-30,2,600\nORD-1002,amazon,Delhi FC,CONFIRMED,UNFULFILLED,COD,900,Delhi,2026-09-10T08:00:00Z,2026-09-11T08:00:00Z,2,CLN-100,1,900\n`;

test("order file adapter normalizes order rows", async () => {
  const rows = await parseOrderFile("orders.csv", new TextEncoder().encode(csv));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].externalOrderId, "ORD-1001");
  assert.equal(rows[0].channel, "shopify");
  assert.equal(rows[0].paymentMethod, "PREPAID");
  assert.equal(rows[0].lines[0].sku, "NIAC-30");
  assert.equal(rows[1].paymentMethod, "COD");
  assert.equal(rows[1].deliveryAttempts, 2);
});

test("order file adapter rejects missing required columns", async () => {
  const bad = `Order ID,SKU\nORD-1,NIAC-30\n`;
  await assert.rejects(() => parseOrderFile("bad.csv", new TextEncoder().encode(bad)), /Missing required column/);
});
