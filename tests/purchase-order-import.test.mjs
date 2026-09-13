import assert from "node:assert/strict";
import test from "node:test";
import { suggestColumnMapping, validateRows } from "../lib/imports/validation.ts";

test("purchase order file mapping recognizes standard headers", () => {
  const headers = ["External PO Number", "Supplier Name", "Destination Location", "Channel", "Order Date", "Expected Delivery Date", "Currency", "Total Value", "SKU", "Ordered Quantity", "Confirmed Quantity", "Received Quantity", "Unit Cost", "Line Expected Delivery Date"];
  const mapping = suggestColumnMapping("purchase_orders", headers);
  assert.equal(mapping.external_po_number, "External PO Number");
  assert.equal(mapping.supplier_name, "Supplier Name");
  assert.equal(mapping.destination_location, "Destination Location");
  assert.equal(mapping.sku, "SKU");
  assert.equal(mapping.ordered_quantity, "Ordered Quantity");
});

test("purchase order rows normalize quantities, dates, channel and receipt state", () => {
  const raw = [{
    "External PO Number": "PO-TEST-1",
    "Supplier Name": "Supplier A",
    "Destination Location": "Bangalore FC",
    Channel: "Blinkit",
    "Order Date": "2026-09-10",
    "Expected Delivery Date": "2026-09-18",
    Currency: "INR",
    "Total Value": 54000,
    SKU: "NIAC-30",
    "Ordered Quantity": 180,
    "Confirmed Quantity": 180,
    "Received Quantity": 25,
    "Unit Cost": 300,
    "Line Expected Delivery Date": "2026-09-18",
  }];
  const mapping = suggestColumnMapping("purchase_orders", Object.keys(raw[0]));
  const [validated] = validateRows("purchase_orders", raw, mapping);
  assert.deepEqual(validated.errors, []);
  assert.equal(validated.normalized.external_po_number, "PO-TEST-1");
  assert.equal(validated.normalized.channel, "blinkit");
  assert.equal(validated.normalized.ordered_quantity, 180);
  assert.equal(validated.normalized.received_quantity, 25);
  assert.equal(validated.normalized.expected_delivery_date, "2026-09-18");
});

test("purchase order validation rejects over-receipts and duplicate PO/SKU rows", () => {
  const row = {
    "External PO Number": "PO-TEST-2",
    "Supplier Name": "Supplier B",
    "Destination Location": "Delhi FC",
    "Order Date": "2026-09-01",
    "Expected Delivery Date": "2026-09-10",
    SKU: "SUN-50",
    "Ordered Quantity": 100,
    "Confirmed Quantity": 90,
    "Received Quantity": 95,
  };
  const mapping = suggestColumnMapping("purchase_orders", Object.keys(row));
  const validated = validateRows("purchase_orders", [row, row], mapping);
  assert.match(validated[0].errors.join(" "), /cannot exceed/i);
  assert.equal(validated[1].duplicate, true);
  assert.match(validated[1].errors.join(" "), /duplicate/i);
});
