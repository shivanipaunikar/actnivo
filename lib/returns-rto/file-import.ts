import { parseImportFile } from "../imports/parser.ts";
import type { RawImportRow, RawValue } from "../imports/types";
import type { NormalizedReturn, ReturnKind, ReturnStatus } from "./types";

const aliases: Record<string, string[]> = {
  external_return_id: ["return id", "rto id", "external return id", "return number"],
  external_order_id: ["order id", "external order id", "order number"],
  kind: ["kind", "type", "return type"],
  status: ["status", "return status", "rto status"],
  reason: ["reason", "return reason", "rto reason"],
  currency: ["currency"],
  refund_amount: ["refund amount", "refund", "amount"],
  reverse_logistics_cost: ["reverse logistics cost", "reverse cost", "return shipping cost", "rto cost"],
  requested_at: ["requested at", "request date", "return requested at", "rto initiated at"],
  approved_at: ["approved at", "approval date"],
  picked_up_at: ["picked up at", "pickup date", "picked up date"],
  received_at: ["received at", "warehouse received at", "received date"],
  refund_due_at: ["refund due at", "refund due date"],
  refunded_at: ["refunded at", "refund date"],
  sku: ["sku", "master sku", "product sku"],
  quantity: ["quantity", "qty", "units"],
  unit_value: ["unit value", "unit price", "price"],
};
const normalize = (value: string) => value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
const clean = (value: RawValue | undefined) => String(value ?? "").trim();
const numberValue = (value: RawValue | undefined) => { const parsed = Number(clean(value).replace(/[₹,$,\s]/g, "")); return Number.isFinite(parsed) ? parsed : null; };
const dateValue = (value: RawValue | undefined) => { if (!clean(value)) return null; const parsed = new Date(clean(value)); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); };
function headersMap(headers: string[]) { const normalized = new Map(headers.map((header) => [normalize(header), header])); const result: Record<string, string | undefined> = {}; for (const [key, choices] of Object.entries(aliases)) result[key] = choices.map((choice) => normalized.get(choice)).find(Boolean); return result; }
function kindValue(value: RawValue | undefined): ReturnKind { return clean(value).toUpperCase() === "RTO" ? "RTO" : "RETURN"; }
function statusValue(value: RawValue | undefined): ReturnStatus { const key = clean(value).toUpperCase().replace(/[ -]+/g, "_"); const allowed: ReturnStatus[] = ["REQUESTED", "APPROVED", "PICKUP_PENDING", "PICKED_UP", "IN_TRANSIT", "RECEIVED", "REFUND_PENDING", "REFUNDED", "CLOSED", "CANCELLED"]; return allowed.includes(key as ReturnStatus) ? key as ReturnStatus : "REQUESTED"; }

export async function parseReturnFile(filename: string, bytes: Uint8Array): Promise<NormalizedReturn[]> {
  const parsed = await parseImportFile(filename, bytes);
  if (!parsed.rows.length) throw new Error("The return/RTO file has no data rows.");
  const map = headersMap(Object.keys(parsed.rows[0] ?? {}));
  for (const required of ["external_return_id", "external_order_id", "kind", "requested_at", "sku", "quantity", "unit_value"]) if (!map[required]) throw new Error(`Missing required column: ${required.replaceAll("_", " ")}.`);
  const grouped = new Map<string, NormalizedReturn>();
  parsed.rows.forEach((row: RawImportRow, index) => {
    const get = (key: string) => map[key] ? row[map[key]!] : undefined;
    const id = clean(get("external_return_id")); const orderId = clean(get("external_order_id")); const sku = clean(get("sku"));
    const quantity = numberValue(get("quantity")); const unitValue = numberValue(get("unit_value")); const requestedAt = dateValue(get("requested_at"));
    if (!id || !orderId || !sku || !requestedAt) throw new Error(`Row ${index + 2}: return ID, order ID, SKU and valid request date are required.`);
    if (quantity === null || !Number.isInteger(quantity) || quantity <= 0) throw new Error(`Row ${index + 2}: quantity must be a whole number greater than 0.`);
    if (unitValue === null || unitValue < 0) throw new Error(`Row ${index + 2}: unit value must be 0 or more.`);
    const line = { sku, quantity, unitValue, metadata: { source_row: index + 2 } };
    const existing = grouped.get(id); if (existing) { existing.lines.push(line); return; }
    grouped.set(id, { externalReturnId: id, externalOrderId: orderId, kind: kindValue(get("kind")), status: statusValue(get("status")), reason: clean(get("reason")) || undefined, currency: clean(get("currency")) || "INR", refundAmount: numberValue(get("refund_amount")) ?? 0, reverseLogisticsCost: numberValue(get("reverse_logistics_cost")) ?? 0, requestedAt, approvedAt: dateValue(get("approved_at")) ?? undefined, pickedUpAt: dateValue(get("picked_up_at")) ?? undefined, receivedAt: dateValue(get("received_at")) ?? undefined, refundDueAt: dateValue(get("refund_due_at")) ?? undefined, refundedAt: dateValue(get("refunded_at")) ?? undefined, sourceType: "file_import", metadata: { imported_from: filename }, lines: [line] });
  });
  return [...grouped.values()];
}
