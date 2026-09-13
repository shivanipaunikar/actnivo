import { parseImportFile } from "../imports/parser.ts";
import { normalizeChannel } from "../imports/validation.ts";
import type { RawImportRow, RawValue } from "../imports/types";
import type { FulfillmentStatus, NormalizedOrder, OrderStatus, PaymentMethod } from "./types";

const aliases: Record<string, string[]> = {
  external_order_id: ["external order id", "order id", "order number", "order no", "order"],
  channel: ["channel", "marketplace", "platform"],
  location: ["location", "warehouse", "facility", "fc", "store", "fulfillment location"],
  status: ["status", "order status"],
  fulfillment_status: ["fulfillment status", "fulfilment status", "shipment status"],
  payment_method: ["payment method", "payment", "payment type"],
  currency: ["currency"],
  order_value: ["order value", "total value", "total", "amount", "revenue"],
  customer_name: ["customer name", "customer"],
  customer_city: ["customer city", "city", "delivery city"],
  order_placed_at: ["order placed at", "order date", "created at", "created date"],
  promised_ship_at: ["promised ship at", "promised ship date", "ship by", "ship by date"],
  shipped_at: ["shipped at", "shipped date", "dispatch date"],
  delivered_at: ["delivered at", "delivered date"],
  cancelled_at: ["cancelled at", "canceled at", "cancelled date", "canceled date"],
  delivery_attempts: ["delivery attempts", "attempts", "failed delivery attempts"],
  sku: ["sku", "master sku", "item sku", "product sku"],
  quantity: ["quantity", "qty", "units"],
  unit_price: ["unit price", "selling price", "price"],
  external_line_id: ["external line id", "line id", "item id"],
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
const clean = (value: RawValue | undefined) => String(value ?? "").trim();
const numberValue = (value: RawValue | undefined) => {
  const parsed = Number(clean(value).replace(/[₹,$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const integerValue = (value: RawValue | undefined) => {
  const parsed = numberValue(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
};
const dateValue = (value: RawValue | undefined) => {
  if (!clean(value)) return null;
  const parsed = new Date(clean(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

function headerMap(headers: string[]) {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const result: Record<string, string | undefined> = {};
  for (const [key, choices] of Object.entries(aliases)) result[key] = choices.map((choice) => normalized.get(choice)).find(Boolean);
  return result;
}

function statusValue(value: RawValue | undefined): OrderStatus {
  const key = clean(value).toUpperCase().replace(/[ -]+/g, "_");
  const allowed: OrderStatus[] = ["CREATED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "RTO"];
  return allowed.includes(key as OrderStatus) ? key as OrderStatus : "CREATED";
}

function fulfillmentValue(value: RawValue | undefined): FulfillmentStatus {
  const key = clean(value).toUpperCase().replace(/[ -]+/g, "_");
  const allowed: FulfillmentStatus[] = ["UNFULFILLED", "PROCESSING", "PARTIALLY_FULFILLED", "FULFILLED", "DELIVERED", "FAILED", "RETURNED", "RTO"];
  return allowed.includes(key as FulfillmentStatus) ? key as FulfillmentStatus : "UNFULFILLED";
}

function paymentValue(value: RawValue | undefined): PaymentMethod {
  const key = clean(value).toUpperCase();
  if (key === "COD" || key === "CASH ON DELIVERY") return "COD";
  if (["PREPAID", "PAID", "ONLINE", "CARD", "UPI"].includes(key)) return "PREPAID";
  return "OTHER";
}

export async function parseOrderFile(filename: string, bytes: Uint8Array): Promise<NormalizedOrder[]> {
  const parsed = await parseImportFile(filename, bytes);
  if (!parsed.rows.length) throw new Error("The order file has no data rows.");
  const headers = Object.keys(parsed.rows[0] ?? {});
  const map = headerMap(headers);
  for (const required of ["external_order_id", "order_placed_at", "sku", "quantity", "unit_price"]) {
    if (!map[required]) throw new Error(`Missing required column: ${required.replaceAll("_", " ")}.`);
  }

  const grouped = new Map<string, NormalizedOrder>();
  parsed.rows.forEach((row: RawImportRow, index) => {
    const get = (key: string) => map[key] ? row[map[key]!] : undefined;
    const orderId = clean(get("external_order_id"));
    const sku = clean(get("sku"));
    const orderPlacedAt = dateValue(get("order_placed_at"));
    const quantity = integerValue(get("quantity"));
    const unitPrice = numberValue(get("unit_price"));
    if (!orderId) throw new Error(`Row ${index + 2}: missing order ID.`);
    if (!sku) throw new Error(`Row ${index + 2}: missing SKU.`);
    if (!orderPlacedAt) throw new Error(`Row ${index + 2}: invalid order date.`);
    if (quantity === null || quantity <= 0) throw new Error(`Row ${index + 2}: quantity must be a whole number greater than 0.`);
    if (unitPrice === null || unitPrice < 0) throw new Error(`Row ${index + 2}: unit price must be 0 or more.`);
    const attempts = clean(get("delivery_attempts")) ? integerValue(get("delivery_attempts")) : 0;
    if (attempts === null || attempts < 0) throw new Error(`Row ${index + 2}: delivery attempts must be a whole number of 0 or more.`);
    const channelRaw = get("channel");
    const channel = normalizeChannel(channelRaw);
    if (clean(channelRaw) && !channel) throw new Error(`Row ${index + 2}: unsupported channel ${clean(channelRaw)}.`);
    const line = { externalLineId: clean(get("external_line_id")) || undefined, sku, quantity, unitPrice, metadata: { source_row: index + 2 } };
    const existing = grouped.get(orderId);
    if (existing) {
      existing.lines.push(line);
      return;
    }
    const explicitValue = clean(get("order_value")) ? numberValue(get("order_value")) : null;
    if (explicitValue !== null && explicitValue < 0) throw new Error(`Row ${index + 2}: order value must be 0 or more.`);
    grouped.set(orderId, {
      externalOrderId: orderId,
      channel: channel ?? undefined,
      location: clean(get("location")) || undefined,
      status: statusValue(get("status")),
      fulfillmentStatus: fulfillmentValue(get("fulfillment_status")),
      paymentMethod: paymentValue(get("payment_method")),
      currency: clean(get("currency")) || "INR",
      orderValue: explicitValue ?? quantity * unitPrice,
      customerName: clean(get("customer_name")) || undefined,
      customerCity: clean(get("customer_city")) || undefined,
      orderPlacedAt,
      promisedShipAt: dateValue(get("promised_ship_at")) ?? undefined,
      shippedAt: dateValue(get("shipped_at")) ?? undefined,
      deliveredAt: dateValue(get("delivered_at")) ?? undefined,
      cancelledAt: dateValue(get("cancelled_at")) ?? undefined,
      deliveryAttempts: attempts,
      sourceType: "file_import",
      metadata: { imported_from: filename },
      lines: [line],
    });
  });

  for (const order of grouped.values()) {
    const lineTotal = order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    if (!order.orderValue) order.orderValue = lineTotal;
  }
  return [...grouped.values()];
}
