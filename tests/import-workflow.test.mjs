import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { aggregateInventory } from "../lib/data/inventory.ts";
import { matchSku } from "../lib/imports/matching.ts";
import {
  buildInventorySnapshotRecords,
  buildSalesDailyRecords,
  filterNewSourceRows,
} from "../lib/imports/operational.ts";
import { parseImportFile } from "../lib/imports/parser.ts";
import { suggestColumnMapping, validateRows } from "../lib/imports/validation.ts";

test("CSV inventory imports parse headers and rows", async () => {
  const csv = "SKU,Location,Available Quantity,Snapshot Date\nVC-30,Bengaluru,43,2026-09-12\n";
  const parsed = await parseImportFile("inventory.csv", new TextEncoder().encode(csv));
  assert.deepEqual(parsed.headers, ["SKU", "Location", "Available Quantity", "Snapshot Date"]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].SKU, "VC-30");
});

test("XLSX inventory imports preserve headers, numeric cells, dates, and blanks", async () => {
  const bytes = await readFile(new URL("./fixtures/inventory-import.xlsx", import.meta.url));
  const parsed = await parseImportFile("inventory-import.xlsx", bytes);
  assert.deepEqual(parsed.headers, [
    "SKU", "Product Name", "Location", "Available Quantity", "Reserved Quantity",
    "Inbound Quantity", "Snapshot Date", "Channel",
  ]);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0].SKU, "VC-30");
  assert.equal(parsed.rows[0]["Product Name"], "Vitamin C Serum");
  assert.equal(parsed.rows[0]["Available Quantity"], 120);
  assert.equal(typeof parsed.rows[0]["Available Quantity"], "number");
  assert.equal(parsed.rows[0]["Snapshot Date"], "2026-09-12T00:00:00.000Z");
  assert.equal(parsed.rows[1]["Reserved Quantity"], null);
  assert.equal(parsed.rows[1]["Inbound Quantity"], null);
});

test("XLSX sales fixture parses fourteen typed daily rows", async () => {
  const bytes = await readFile(new URL("./fixtures/sales-import.xlsx", import.meta.url));
  const parsed = await parseImportFile("sales-import.xlsx", bytes);
  assert.deepEqual(parsed.headers, ["SKU", "Channel", "Date", "Units Sold", "Gross Sales", "Net Sales", "Location"]);
  assert.equal(parsed.rows.length, 14);
  assert.equal(parsed.rows[0].Date, "2026-09-01T00:00:00.000Z");
  assert.equal(parsed.rows[13].Date, "2026-09-14T00:00:00.000Z");
  assert.equal(parsed.rows[13]["Units Sold"], 14);
  assert.equal(typeof parsed.rows[13]["Gross Sales"], "number");
});

test("fixture pipeline produces linked inventory and sales without duplicate operational rows", async () => {
  const organizationId = "00000000-0000-4000-8000-000000000001";
  const inventoryJobId = "00000000-0000-4000-8000-000000000101";
  const salesJobId = "00000000-0000-4000-8000-000000000102";
  const inventoryFile = await readFile(new URL("./fixtures/inventory-import.xlsx", import.meta.url));
  const salesFile = await readFile(new URL("./fixtures/sales-import.xlsx", import.meta.url));
  const inventoryParsed = await parseImportFile("inventory-import.xlsx", inventoryFile);
  const salesParsed = await parseImportFile("sales-import.xlsx", salesFile);
  const inventoryValidated = validateRows("inventory", inventoryParsed.rows, suggestColumnMapping("inventory", inventoryParsed.headers));
  const salesValidated = validateRows("sales", salesParsed.rows, suggestColumnMapping("sales", salesParsed.headers));
  assert.equal(inventoryValidated.every((row) => row.normalized && !row.errors.length), true);
  assert.equal(salesValidated.every((row) => row.normalized && !row.errors.length), true);

  const masterSkus = [
    { id: "sku-vc", organization_id: organizationId, master_sku: "VC-30", product_name: "Vitamin C Serum", brand: null, category: "Serums", variant: null, barcode: null, mrp: "699", selling_price: "599", cost_price: null, pack_size: null, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: "sku-niac", organization_id: organizationId, master_sku: "NIAC-30", product_name: "Niacinamide Serum", brand: null, category: "Serums", variant: null, barcode: null, mrp: "699", selling_price: "599", cost_price: null, pack_size: null, active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
  ];
  const skuId = (normalized) => {
    const match = matchSku({ sku: normalized.sku, productName: normalized.product_name }, masterSkus);
    assert.equal(match.status, "mapped");
    assert.ok(match.skuId);
    return match.skuId;
  };
  const locations = new Map([["Mumbai", "loc-mumbai"], ["Bangalore", "loc-bangalore"]]);
  const inventoryRecords = buildInventorySnapshotRecords(organizationId, inventoryJobId, inventoryValidated.map((row, index) => ({
    sourceRowId: `inventory-row-${index + 1}`,
    skuId: skuId(row.normalized),
    normalized: row.normalized,
  })), locations);
  const salesRecords = buildSalesDailyRecords(organizationId, salesJobId, salesValidated.map((row, index) => ({
    sourceRowId: `sales-row-${index + 1}`,
    skuId: skuId(row.normalized),
    normalized: row.normalized,
  })), locations);

  assert.equal(new Set(inventoryRecords.map((row) => row.sku_id)).size, 2);
  assert.equal(new Set(inventoryRecords.map((row) => row.location_id)).size, 2);
  assert.equal(inventoryRecords.reduce((sum, row) => sum + row.available_quantity, 0), 253);
  assert.equal(salesRecords.length, 14);
  assert.equal(salesRecords.reduce((sum, row) => sum + row.units_sold, 0), 105);
  assert.equal([...inventoryRecords, ...salesRecords].every((row) => row.source_import_id && row.source_row_id), true);
  assert.equal(filterNewSourceRows(inventoryRecords, inventoryRecords.map((row) => row.source_row_id)).length, 0);
  assert.equal(filterNewSourceRows(salesRecords, salesRecords.map((row) => row.source_row_id)).length, 0);

  const locationRows = [
    { id: "loc-mumbai", organization_id: organizationId, name: "Mumbai", type: "warehouse", city: "Mumbai", state: "Maharashtra", country: "India", external_id: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: "loc-bangalore", organization_id: organizationId, name: "Bangalore", type: "warehouse", city: "Bangalore", state: "Karnataka", country: "India", external_id: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
  ];
  const oldSnapshot = { ...inventoryRecords[0], id: "snapshot-old", available_quantity: 100, snapshot_at: "2026-09-11T00:00:00.000Z", created_at: "2026-09-11T00:00:00.000Z" };
  const snapshots = [oldSnapshot, ...inventoryRecords.map((row, index) => ({ ...row, id: `snapshot-${index + 1}`, created_at: row.snapshot_at }))];
  const sales = salesRecords.map((row, index) => ({ ...row, id: `sale-${index + 1}`, created_at: `${row.date}T00:00:00.000Z`, updated_at: `${row.date}T00:00:00.000Z` }));
  const summaries = aggregateInventory(masterSkus, locationRows, [], snapshots, sales, new Date("2026-09-14T12:00:00Z"));
  assert.equal(snapshots.length, 4, "the older Mumbai snapshot remains in history");
  assert.equal(summaries.find((item) => item.sku.id === "sku-vc").available, 163);
  assert.equal(summaries.find((item) => item.sku.id === "sku-niac").available, 90);
});

test("import failures are understandable and partial validation isolates invalid rows", async () => {
  await assert.rejects(
    () => parseImportFile("broken.csv", new TextEncoder().encode('SKU,Location\n"VC-30,Mumbai')),
    /We could not read this CSV file/,
  );
  assert.throws(
    () => validateRows("inventory", [{ SKU: "VC-30" }], { sku: "SKU" }),
    /Map the required columns: Location, Available Quantity, Snapshot Date/,
  );
  const mapping = suggestColumnMapping("inventory", ["SKU", "Location", "Available Quantity", "Snapshot Date", "Channel"]);
  const rows = validateRows("inventory", [
    { SKU: "VC-30", Location: "Mumbai", "Available Quantity": 120, "Snapshot Date": "2026-09-12", Channel: "Blinkit" },
    { SKU: "BAD-NEG", Location: "Mumbai", "Available Quantity": -1, "Snapshot Date": "2026-09-12", Channel: "Blinkit" },
    { SKU: "BAD-CHANNEL", Location: "Mumbai", "Available Quantity": 5, "Snapshot Date": "2026-09-12", Channel: "Unknown Mart" },
  ], mapping);
  assert.equal(rows.filter((row) => row.normalized).length, 1);
  assert.match(rows[1].errors.join(" "), /Available quantity/);
  assert.match(rows[2].errors.join(" "), /Channel is not supported/);
  assert.equal(rows[0].errors.length, 0);
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

test("database, storage, lineage, and client-secret invariants are explicit", async () => {
  const commerceSql = await readFile(new URL("../supabase/migrations/20260912200933_commerce_import_pipeline.sql", import.meta.url), "utf8");
  const initialSql = await readFile(new URL("../supabase/migrations/20260912191611_initial_saas_schema.sql", import.meta.url), "utf8");
  const operationalTables = ["connections", "import_jobs", "source_files", "locations", "skus", "channel_listings", "sku_mappings", "import_rows", "inventory_snapshots", "sales_daily"];
  for (const table of operationalTables) {
    const start = commerceSql.indexOf(`create table public.${table}`);
    assert.notEqual(start, -1);
    const tableSql = commerceSql.slice(start, commerceSql.indexOf(";", start));
    assert.match(tableSql, /organization_id uuid not null/);
  }
  assert.match(commerceSql, /inventory_snapshots_sku_fk foreign key \(sku_id, organization_id\)[\s\S]*references public\.skus\(id, organization_id\)/);
  assert.match(commerceSql, /inventory_snapshots_location_fk foreign key \(location_id, organization_id\)[\s\S]*references public\.locations\(id, organization_id\)/);
  assert.match(commerceSql, /sales_daily_sku_fk foreign key \(sku_id, organization_id\)[\s\S]*references public\.skus\(id, organization_id\)/);
  assert.match(commerceSql, /insert into storage\.buckets[\s\S]*'commerce-imports'[\s\S]*false/);
  assert.match(initialSql, /organization_segment := \(storage\.foldername\(object_name\)\)\[1\]/);
  const actions = await readFile(new URL("../app/app/integrations/import/actions.ts", import.meta.url), "utf8");
  assert.match(actions, /storagePath = `\$\{context\.organization\.id\}\/imports\//);
  assert.match(actions, /This exact file has already been uploaded/);
  assert.match(actions, /status: "failed",[\s\S]*error_summary: message\(error\)/);

  async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.name.includes(" 2.")) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await sourceFiles(path));
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(path);
    }
    return files;
  }
  for (const root of ["../app", "../components", "../lib"].map((path) => fileURLToPath(new URL(path, import.meta.url)))) {
    for (const file of await sourceFiles(root)) {
      const source = await readFile(file, "utf8");
      assert.doesNotMatch(source, /service[_-]?role|SUPABASE_TEST_SERVICE_ROLE_KEY/i, `${file} must not contain service-role client code`);
    }
  }
});
