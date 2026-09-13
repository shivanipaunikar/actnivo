import type { CommerceChannel } from "@/lib/supabase/database.types";
import { sha256 } from "./parser.ts";
import type { ColumnMapping, ImportDefinition, NormalizedImportRow, RawImportRow, RawValue, SupportedImportSourceType, ValidatedRow } from "./types";

export const importDefinitions: Record<SupportedImportSourceType, ImportDefinition> = {
  inventory: {
    sourceType: "inventory",
    fields: [
      { key: "sku", label: "SKU", required: true, aliases: ["sku", "item sku", "seller sku", "merchant sku", "product sku"] },
      { key: "product_name", label: "Product Name", required: false, aliases: ["product name", "product", "item name", "title"] },
      { key: "location", label: "Location", required: true, aliases: ["location", "warehouse", "facility", "fc", "store"] },
      { key: "available_quantity", label: "Available Quantity", required: true, aliases: ["available quantity", "available", "inventory", "stock", "qty"] },
      { key: "reserved_quantity", label: "Reserved Quantity", required: false, aliases: ["reserved quantity", "reserved"] },
      { key: "inbound_quantity", label: "Inbound Quantity", required: false, aliases: ["inbound quantity", "inbound", "incoming"] },
      { key: "snapshot_date", label: "Snapshot Date", required: true, aliases: ["snapshot date", "date", "as of", "inventory date"] },
      { key: "channel", label: "Channel", required: false, aliases: ["channel", "marketplace", "platform"] },
      { key: "barcode", label: "Barcode", required: false, aliases: ["barcode", "ean", "upc", "gtin"] },
      { key: "brand", label: "Brand", required: false, aliases: ["brand"] },
      { key: "category", label: "Category", required: false, aliases: ["category"] },
      { key: "variant", label: "Variant", required: false, aliases: ["variant", "size", "flavour", "flavor"] },
      { key: "pack_size", label: "Pack Size", required: false, aliases: ["pack size", "pack", "unit size"] },
      { key: "mrp", label: "MRP", required: false, aliases: ["mrp", "list price"] },
      { key: "selling_price", label: "Selling Price", required: false, aliases: ["selling price", "sale price", "price"] },
      { key: "cost_price", label: "Cost Price", required: false, aliases: ["cost price", "cost", "cogs"] },
    ],
  },
  sales: {
    sourceType: "sales",
    fields: [
      { key: "sku", label: "SKU", required: true, aliases: ["sku", "item sku", "seller sku", "merchant sku", "product sku"] },
      { key: "channel", label: "Channel", required: true, aliases: ["channel", "marketplace", "platform"] },
      { key: "date", label: "Date", required: true, aliases: ["date", "sales date", "order date", "day"] },
      { key: "units_sold", label: "Units Sold", required: true, aliases: ["units sold", "quantity", "qty sold", "orders"] },
      { key: "gross_sales", label: "Gross Sales", required: true, aliases: ["gross sales", "gross revenue", "revenue", "sales"] },
      { key: "net_sales", label: "Net Sales", required: false, aliases: ["net sales", "net revenue"] },
      { key: "location", label: "Location", required: false, aliases: ["location", "warehouse", "facility", "fc", "store"] },
      { key: "product_name", label: "Product Name", required: false, aliases: ["product name", "product", "item name", "title"] },
      { key: "barcode", label: "Barcode", required: false, aliases: ["barcode", "ean", "upc", "gtin"] },
      { key: "variant", label: "Variant", required: false, aliases: ["variant", "size", "flavour", "flavor"] },
      { key: "pack_size", label: "Pack Size", required: false, aliases: ["pack size", "pack", "unit size"] },
    ],
  },
  purchase_orders: {
    sourceType: "purchase_orders",
    fields: [
      { key: "external_po_number", label: "External PO Number", required: true, aliases: ["external po number", "po number", "purchase order", "purchase order number", "po"] },
      { key: "supplier_name", label: "Supplier Name", required: true, aliases: ["supplier name", "supplier", "vendor", "vendor name"] },
      { key: "destination_location", label: "Destination Location", required: true, aliases: ["destination location", "destination", "warehouse", "location", "ship to"] },
      { key: "channel", label: "Channel", required: false, aliases: ["channel", "marketplace", "platform"] },
      { key: "order_date", label: "Order Date", required: true, aliases: ["order date", "po date", "created date"] },
      { key: "expected_delivery_date", label: "Expected Delivery Date", required: true, aliases: ["expected delivery date", "expected arrival date", "eta", "delivery date"] },
      { key: "currency", label: "Currency", required: false, aliases: ["currency"] },
      { key: "total_value", label: "Total Value", required: false, aliases: ["total value", "po value", "order value", "total"] },
      { key: "sku", label: "SKU", required: true, aliases: ["sku", "item sku", "seller sku", "merchant sku", "product sku"] },
      { key: "ordered_quantity", label: "Ordered Quantity", required: true, aliases: ["ordered quantity", "order quantity", "quantity ordered", "qty"] },
      { key: "confirmed_quantity", label: "Confirmed Quantity", required: false, aliases: ["confirmed quantity", "confirmed qty"] },
      { key: "received_quantity", label: "Received Quantity", required: false, aliases: ["received quantity", "received qty", "quantity received"] },
      { key: "unit_cost", label: "Unit Cost", required: false, aliases: ["unit cost", "cost", "unit price"] },
      { key: "line_expected_delivery_date", label: "Line Expected Delivery Date", required: false, aliases: ["line expected delivery date", "line eta", "line delivery date"] },
    ],
  },
};

const channelAliases: Record<string, CommerceChannel> = {
  shopify: "shopify", amazon: "amazon", flipkart: "flipkart", meesho: "meesho",
  blinkit: "blinkit", zepto: "zepto", swiggyinstamart: "swiggy_instamart",
  instamart: "swiggy_instamart", woocommerce: "woocommerce", unicommerce: "unicommerce",
  easyecom: "easyecom", other: "other",
};

function clean(value: RawValue | undefined) {
  return String(value ?? "").trim();
}

function numberValue(value: RawValue | undefined) {
  const parsed = Number(clean(value).replace(/[₹,$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(value: RawValue | undefined) {
  const parsed = numberValue(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function dateValue(value: RawValue | undefined, dateOnly = false) {
  const parsed = new Date(clean(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return dateOnly ? parsed.toISOString().slice(0, 10) : parsed.toISOString();
}

export function normalizeChannel(value: RawValue | undefined): CommerceChannel | null {
  const key = clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  return key ? channelAliases[key] ?? null : null;
}

export function suggestColumnMapping(sourceType: SupportedImportSourceType, headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((header) => ({ header, normalized: header.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() }));
  for (const field of importDefinitions[sourceType].fields) {
    const match = normalizedHeaders.find(({ normalized }) => field.aliases.includes(normalized));
    if (match) mapping[field.key] = match.header;
  }
  return mapping;
}

function mapped(row: RawImportRow, mapping: ColumnMapping, key: string) {
  return mapping[key] ? row[mapping[key]] : undefined;
}

function validateInventory(row: RawImportRow, mapping: ColumnMapping) {
  const errors: string[] = [];
  const sku = clean(mapped(row, mapping, "sku"));
  const location = clean(mapped(row, mapping, "location"));
  const available = integerValue(mapped(row, mapping, "available_quantity"));
  const reserved = integerValue(mapped(row, mapping, "reserved_quantity") ?? 0);
  const inbound = integerValue(mapped(row, mapping, "inbound_quantity") ?? 0);
  const snapshotDate = dateValue(mapped(row, mapping, "snapshot_date"));
  const channelRaw = mapped(row, mapping, "channel");
  const channel = normalizeChannel(channelRaw);
  if (!sku) errors.push("Missing SKU");
  if (!location) errors.push("Missing location");
  if (available === null || available < 0) errors.push("Available quantity must be a whole number of 0 or more");
  if (reserved === null || reserved < 0) errors.push("Reserved quantity must be a whole number of 0 or more");
  if (inbound === null || inbound < 0) errors.push("Inbound quantity must be a whole number of 0 or more");
  if (!snapshotDate) errors.push("Snapshot date is invalid");
  if (clean(channelRaw) && !channel) errors.push("Channel is not supported");
  const money = (key: string, fallback: number | null) => {
    if (!clean(mapped(row, mapping, key))) return fallback;
    const value = numberValue(mapped(row, mapping, key));
    if (value === null || value < 0) errors.push(`${key.replaceAll("_", " ")} must be 0 or more`);
    return value;
  };
  const normalized: NormalizedImportRow = {
    sku,
    product_name: clean(mapped(row, mapping, "product_name")) || sku,
    location,
    available_quantity: available ?? 0,
    reserved_quantity: reserved ?? 0,
    inbound_quantity: inbound ?? 0,
    snapshot_date: snapshotDate ?? "",
    channel,
    barcode: clean(mapped(row, mapping, "barcode")) || null,
    brand: clean(mapped(row, mapping, "brand")) || null,
    category: clean(mapped(row, mapping, "category")) || null,
    variant: clean(mapped(row, mapping, "variant")) || null,
    pack_size: clean(mapped(row, mapping, "pack_size")) || null,
    mrp: money("mrp", 0) ?? 0,
    selling_price: money("selling_price", 0) ?? 0,
    cost_price: money("cost_price", null),
  };
  return { normalized, errors, duplicateKey: `${sku}|${location}|${channel ?? ""}|${snapshotDate ?? ""}`.toLowerCase() };
}

function validateSales(row: RawImportRow, mapping: ColumnMapping) {
  const errors: string[] = [];
  const sku = clean(mapped(row, mapping, "sku"));
  const channel = normalizeChannel(mapped(row, mapping, "channel"));
  const date = dateValue(mapped(row, mapping, "date"), true);
  const units = integerValue(mapped(row, mapping, "units_sold"));
  const gross = numberValue(mapped(row, mapping, "gross_sales"));
  const netRaw = clean(mapped(row, mapping, "net_sales"));
  const net = netRaw ? numberValue(mapped(row, mapping, "net_sales")) : null;
  if (!sku) errors.push("Missing SKU");
  if (!channel) errors.push("Channel is required and must be supported");
  if (!date) errors.push("Sales date is invalid");
  if (units === null || units < 0) errors.push("Units sold must be a whole number of 0 or more");
  if (gross === null || gross < 0) errors.push("Gross sales must be 0 or more");
  if (netRaw && (net === null || net < 0)) errors.push("Net sales must be 0 or more");
  const location = clean(mapped(row, mapping, "location")) || null;
  const normalized: NormalizedImportRow = {
    sku,
    product_name: clean(mapped(row, mapping, "product_name")) || sku,
    channel: channel ?? "other",
    date: date ?? "",
    units_sold: units ?? 0,
    gross_sales: gross ?? 0,
    net_sales: net,
    location,
    barcode: clean(mapped(row, mapping, "barcode")) || null,
    variant: clean(mapped(row, mapping, "variant")) || null,
    pack_size: clean(mapped(row, mapping, "pack_size")) || null,
  };
  return { normalized, errors, duplicateKey: `${sku}|${location ?? ""}|${channel ?? ""}|${date ?? ""}`.toLowerCase() };
}

function validatePurchaseOrder(row: RawImportRow, mapping: ColumnMapping) {
  const errors: string[] = [];
  const poNumber = clean(mapped(row, mapping, "external_po_number"));
  const supplierName = clean(mapped(row, mapping, "supplier_name"));
  const destinationLocation = clean(mapped(row, mapping, "destination_location"));
  const sku = clean(mapped(row, mapping, "sku"));
  const orderDate = dateValue(mapped(row, mapping, "order_date"), true);
  const expectedDeliveryDate = dateValue(mapped(row, mapping, "expected_delivery_date"), true);
  const lineExpectedRaw = clean(mapped(row, mapping, "line_expected_delivery_date"));
  const lineExpectedDeliveryDate = lineExpectedRaw ? dateValue(mapped(row, mapping, "line_expected_delivery_date"), true) : null;
  const ordered = integerValue(mapped(row, mapping, "ordered_quantity"));
  const confirmedRaw = clean(mapped(row, mapping, "confirmed_quantity"));
  const confirmed = confirmedRaw ? integerValue(mapped(row, mapping, "confirmed_quantity")) : null;
  const receivedRaw = clean(mapped(row, mapping, "received_quantity"));
  const received = receivedRaw ? integerValue(mapped(row, mapping, "received_quantity")) : 0;
  const channelRaw = mapped(row, mapping, "channel");
  const channel = normalizeChannel(channelRaw);
  const totalValueRaw = clean(mapped(row, mapping, "total_value"));
  const totalValue = totalValueRaw ? numberValue(mapped(row, mapping, "total_value")) : null;
  const unitCostRaw = clean(mapped(row, mapping, "unit_cost"));
  const unitCost = unitCostRaw ? numberValue(mapped(row, mapping, "unit_cost")) : null;

  if (!poNumber) errors.push("Missing external PO number");
  if (!supplierName) errors.push("Missing supplier name");
  if (!destinationLocation) errors.push("Missing destination location");
  if (!sku) errors.push("Missing SKU");
  if (!orderDate) errors.push("Order date is invalid");
  if (!expectedDeliveryDate) errors.push("Expected delivery date is invalid");
  if (lineExpectedRaw && !lineExpectedDeliveryDate) errors.push("Line expected delivery date is invalid");
  if (ordered === null || ordered <= 0) errors.push("Ordered quantity must be a whole number greater than 0");
  if (confirmedRaw && (confirmed === null || confirmed < 0)) errors.push("Confirmed quantity must be a whole number of 0 or more");
  if (received === null || received < 0) errors.push("Received quantity must be a whole number of 0 or more");
  const receiptLimit = confirmed ?? ordered;
  if (received !== null && receiptLimit !== null && received > receiptLimit) errors.push("Received quantity cannot exceed confirmed or ordered quantity");
  if (clean(channelRaw) && !channel) errors.push("Channel is not supported");
  if (totalValueRaw && (totalValue === null || totalValue < 0)) errors.push("Total value must be 0 or more");
  if (unitCostRaw && (unitCost === null || unitCost < 0)) errors.push("Unit cost must be 0 or more");

  const normalized: NormalizedImportRow = {
    external_po_number: poNumber,
    supplier_name: supplierName,
    destination_location: destinationLocation,
    channel,
    order_date: orderDate ?? "",
    expected_delivery_date: expectedDeliveryDate ?? "",
    currency: clean(mapped(row, mapping, "currency")) || "INR",
    total_value: totalValue,
    sku,
    ordered_quantity: ordered ?? 0,
    confirmed_quantity: confirmed,
    received_quantity: received ?? 0,
    unit_cost: unitCost,
    line_expected_delivery_date: lineExpectedDeliveryDate,
  };
  return { normalized, errors, duplicateKey: `${poNumber}|${sku}`.toLowerCase() };
}

export function validateRows(sourceType: SupportedImportSourceType, rows: RawImportRow[], mapping: ColumnMapping): ValidatedRow[] {
  const required = importDefinitions[sourceType].fields.filter((field) => field.required);
  const missingMappings = required.filter((field) => !mapping[field.key]);
  if (missingMappings.length) throw new Error(`Map the required columns: ${missingMappings.map((field) => field.label).join(", ")}.`);
  const seen = new Set<string>();
  return rows.map((raw, index) => {
    const result = sourceType === "inventory"
      ? validateInventory(raw, mapping)
      : sourceType === "sales"
        ? validateSales(raw, mapping)
        : validatePurchaseOrder(raw, mapping);
    const duplicate = seen.has(result.duplicateKey);
    seen.add(result.duplicateKey);
    return {
      rowNumber: index + 2,
      raw,
      normalized: result.errors.length ? null : result.normalized,
      errors: duplicate ? [...result.errors, "Duplicate PO/SKU row in this file"] : result.errors,
      duplicate,
      rowHash: sha256(JSON.stringify(result.normalized ?? raw)),
    };
  });
}
