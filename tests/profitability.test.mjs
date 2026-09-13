import test from "node:test";
import assert from "node:assert/strict";
import { buildProfitability } from "../lib/profitability/metrics.ts";

test("profitability uses net sales, known COGS, refunds and reverse cost", () => {
  const result = buildProfitability({
    sales: [{ sku_id: "s1", channel: "shopify", units_sold: 10, gross_sales: 1200, net_sales: 1000 }],
    skus: [{ id: "s1", master_sku: "SKU-1", product_name: "Test", cost_price: 40 }],
    returns: [{ id: "r1", order_id: "o1", refund_amount: 100, reverse_logistics_cost: 20 }],
    returnLines: [{ return_id: "r1", sku_id: "s1", quantity: 1, unit_value: 100 }],
    orders: [{ id: "o1", channel: "shopify" }],
  });
  assert.equal(result.summary.revenue, 1000);
  assert.equal(result.summary.knownCogs, 400);
  assert.equal(result.summary.refunds, 100);
  assert.equal(result.summary.reverseCost, 20);
  assert.equal(result.summary.knownContribution, 480);
  assert.equal(result.summary.costCoverage, 1);
});

test("missing SKU cost is not assumed to be zero COGS coverage", () => {
  const result = buildProfitability({
    sales: [{ sku_id: "s1", channel: "amazon", units_sold: 5, gross_sales: 500, net_sales: 500 }],
    skus: [{ id: "s1", master_sku: "SKU-1", product_name: "Test", cost_price: null }],
    returns: [], returnLines: [], orders: [],
  });
  assert.equal(result.summary.knownCogs, 0);
  assert.equal(result.summary.costCoverage, 0);
  assert.equal(result.summary.missingCostSkus, 1);
});

test("multi-line return allocates refund and reverse cost without double counting totals", () => {
  const result = buildProfitability({
    sales: [],
    skus: [
      { id: "s1", master_sku: "A", product_name: "A", cost_price: 10 },
      { id: "s2", master_sku: "B", product_name: "B", cost_price: 20 },
    ],
    returns: [{ id: "r1", order_id: "o1", refund_amount: 300, reverse_logistics_cost: 90 }],
    returnLines: [
      { return_id: "r1", sku_id: "s1", quantity: 1, unit_value: 100 },
      { return_id: "r1", sku_id: "s2", quantity: 1, unit_value: 200 },
    ],
    orders: [{ id: "o1", channel: "flipkart" }],
  });
  assert.equal(result.summary.refunds, 300);
  assert.equal(result.summary.reverseCost, 90);
  assert.equal(result.summary.leakage, 390);
  assert.equal(result.rows.reduce((sum, row) => sum + row.refunds, 0), 300);
  assert.equal(result.rows.reduce((sum, row) => sum + row.reverseCost, 0), 90);
});
