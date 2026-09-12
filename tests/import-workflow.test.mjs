import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aggregateInventory } from "../lib/data/inventory.ts";
import { matchSku } from "../lib/imports/matching.ts";
import { parseImportFile } from "../lib/imports/parser.ts";
import { suggestColumnMapping, validateRows } from "../lib/imports/validation.ts";

test("CSV inventory imports parse headers and rows", async () => {
  const csv = "SKU,Location,Available Quantity,Snapshot Date\nVC-30,Bengaluru,43,2026-09-12\n";
  const parsed = await parseImportFile("inventory.csv", new TextEncoder().encode(csv));
  assert.deepEqual(parsed.headers, ["SKU", "Location", "Available Quantity", "Snapshot Date"]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].SKU, "VC-30");
});

test("validation reports invalid rows and missing required values", () => {
  const headers = ["SKU", "Location", "Available Quantity", "Snapshot Date"];
  const mapping = suggestColumnMapping("inventory", headers);
  const [row] = validateRows("inventory", [{
    SKU: "VC-30",
    Location: "",
    "Available Quantity": -2,
    "Snapshot Date": "not-a-date",
  }], mapping);
  assert.equal(row.normalized, null);
  assert.match(row.errors.join(" "), /Missing location/);
  assert.match(row.errors.join(" "), /Available quantity/);
  assert.match(row.errors.join(" "), /Snapshot date/);
});

test("duplicate rows within one import are retained for review and flagged", () => {
  const headers = ["SKU", "Location", "Available Quantity", "Snapshot Date"];
  const mapping = suggestColumnMapping("inventory", headers);
  const input = {
    SKU: "VC-30",
    Location: "Bengaluru",
    "Available Quantity": 43,
    "Snapshot Date": "2026-09-12",
  };
  const rows = validateRows("inventory", [input, { ...input }], mapping);
  assert.equal(rows[0].duplicate, false);
  assert.equal(rows[1].duplicate, true);
  assert.match(rows[1].errors.join(" "), /Duplicate row/);
});

test("SKU matching follows barcode, exact, normalized, and similarity order", () => {
  const base = {
    organization_id: "org-a", product_name: "Vitamin C Serum 30 ml", brand: "Actnivo",
    category: "Skincare", variant: "Orange", barcode: "890000000001", mrp: "699",
    selling_price: "599", cost_price: null, pack_size: "30 ml", active: true,
    created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  };
  const candidates = [
    { ...base, id: "sku-a", master_sku: "VC-30" },
    { ...base, id: "sku-b", master_sku: "NIAC-30", barcode: "890000000002", product_name: "Niacinamide Serum 30 ml" },
  ];
  assert.equal(matchSku({ sku: "unknown", barcode: "890000000001" }, candidates).method, "barcode");
  assert.equal(matchSku({ sku: "VC-30" }, candidates).method, "exact_sku");
  assert.equal(matchSku({ sku: "vc 30" }, candidates).method, "normalized_sku");
  const similar = matchSku({ sku: "new", productName: "Vitamin C Serum", variant: "Orange", packSize: "30 ml" }, candidates);
  assert.equal(similar.method, "product_similarity");
  assert.equal(similar.status, "suggested");
});

test("inventory aggregation uses only the latest snapshot per location and channel", () => {
  const sku = {
    id: "sku-a", organization_id: "org-a", master_sku: "VC-30", product_name: "Vitamin C Serum",
    brand: null, category: null, variant: null, barcode: null, mrp: "699", selling_price: "599",
    cost_price: null, pack_size: null, active: true, created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
  const location = { id: "loc-a", organization_id: "org-a", name: "Bengaluru", type: "warehouse", city: null, state: null, country: "India", external_id: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
  const snapshot = (id, available, at) => ({ id, organization_id: "org-a", sku_id: "sku-a", location_id: "loc-a", channel: "blinkit", available_quantity: available, reserved_quantity: 2, inbound_quantity: 5, snapshot_at: at, source_import_id: null, source_row_id: null, created_at: at });
  const sales = [{ id: "sale-a", organization_id: "org-a", sku_id: "sku-a", location_id: "loc-a", channel: "blinkit", date: "2026-09-11", units_sold: 14, gross_sales: "1000", net_sales: null, source_import_id: null, source_row_id: null, created_at: "2026-09-11T00:00:00Z" }];
  const [summary] = aggregateInventory([sku], [location], [], [
    snapshot("old", 10, "2026-09-10T00:00:00Z"),
    snapshot("new", 43, "2026-09-12T00:00:00Z"),
  ], sales, new Date("2026-09-12T12:00:00Z"));
  assert.equal(summary.available, 43);
  assert.equal(summary.sevenDaySales, 14);
  assert.equal(summary.daysOfCover, 21.5);
  assert.equal(summary.status, "Healthy");
});

test("commerce migration enforces organization RLS and append-only inventory", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260912200933_commerce_import_pipeline.sql", import.meta.url), "utf8");
  const tables = ["connections", "import_jobs", "source_files", "locations", "skus", "channel_listings", "sku_mappings", "import_rows", "inventory_snapshots", "sales_daily"];
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /private\.is_org_member\(organization_id\)/i);
  assert.match(sql, /private\.can_manage_inventory\(organization_id\)/i);
  assert.match(sql, /grant select, insert on table public\.inventory_snapshots to authenticated/i);
  assert.doesNotMatch(sql, /grant[^;]*(update|delete)[^;]*public\.inventory_snapshots/i);
  assert.doesNotMatch(sql, /create policy[^;]*(update|delete)[^;]*inventory snapshots/i);
  assert.match(sql, /bucket_id = 'commerce-imports'/i);
  assert.match(sql, /private\.storage_organization_id\(name\)/i);
});

test("operational data access and import processing remain organization scoped", async () => {
  for (const path of ["../lib/data/imports.ts", "../lib/data/inventory.ts", "../lib/imports/process.ts"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /eq\("organization_id", organizationId\)|eq\("organization_id", organization\.id\)/);
  }
  const processor = await readFile(new URL("../lib/imports/process.ts", import.meta.url), "utf8");
  assert.doesNotMatch(processor, /from\("inventory_snapshots"\)\.update/);
});
