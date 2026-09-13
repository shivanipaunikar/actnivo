import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedOrder } from "./types";

async function ensureLocation(supabase: SupabaseClient<any>, organizationId: string, country: string, name: string) {
  const db = supabase as any;
  const existing = await db.from("locations").select("id,name").eq("organization_id", organizationId).eq("name", name).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data.id as string;
  const created = await db.from("locations").insert({ organization_id: organizationId, name, type: "warehouse", country }).select("id").single();
  if (created.error) throw new Error(created.error.message);
  return created.data.id as string;
}

export async function ingestNormalizedOrders(input: {
  supabase: SupabaseClient<any>;
  organizationId: string;
  country: string;
  records: NormalizedOrder[];
  actorId?: string;
}) {
  const { supabase, organizationId, country, records, actorId } = input;
  const db = supabase as any;
  const skuResult = await db.from("skus").select("id,master_sku").eq("organization_id", organizationId);
  if (skuResult.error) throw new Error(skuResult.error.message);
  const skuByMaster = new Map((skuResult.data ?? []).map((sku: any) => [String(sku.master_sku).toLowerCase(), String(sku.id)]));
  const imported: string[] = [];

  for (const order of records) {
    const locationId = order.location ? await ensureLocation(supabase, organizationId, country, order.location) : null;
    const orderRecord = {
      organization_id: organizationId,
      external_order_id: order.externalOrderId,
      channel: order.channel ?? null,
      location_id: locationId,
      status: order.status,
      fulfillment_status: order.fulfillmentStatus,
      payment_method: order.paymentMethod,
      currency: order.currency || "INR",
      order_value: order.orderValue.toFixed(2),
      customer_name: order.customerName ?? null,
      customer_city: order.customerCity ?? null,
      order_placed_at: order.orderPlacedAt,
      promised_ship_at: order.promisedShipAt ?? null,
      shipped_at: order.shippedAt ?? null,
      delivered_at: order.deliveredAt ?? null,
      cancelled_at: order.cancelledAt ?? null,
      delivery_attempts: order.deliveryAttempts,
      source_type: order.sourceType,
      source_connection_id: order.sourceConnectionId ?? null,
      source_metadata: order.metadata ?? {},
    };
    const saved = await db.from("orders").upsert(orderRecord, { onConflict: "organization_id,source_type,external_order_id" }).select("id").single();
    if (saved.error) throw new Error(saved.error.message);
    const orderId = String(saved.data.id);
    imported.push(orderId);

    for (const line of order.lines) {
      const skuId = skuByMaster.get(line.sku.toLowerCase());
      if (!skuId) throw new Error(`Master SKU ${line.sku} does not exist. Import inventory or map this SKU first.`);
      const lineRecord = {
        organization_id: organizationId,
        order_id: orderId,
        sku_id: skuId,
        external_line_id: line.externalLineId ?? null,
        quantity: line.quantity,
        unit_price: line.unitPrice.toFixed(2),
        source_metadata: line.metadata ?? {},
      };
      const lineSaved = await db.from("order_lines").upsert(lineRecord, { onConflict: "organization_id,order_id,sku_id" });
      if (lineSaved.error) throw new Error(lineSaved.error.message);
    }

    if (actorId) {
      const audit = await db.from("audit_events").insert({
        organization_id: organizationId,
        actor_id: actorId,
        entity_type: "order",
        entity_id: orderId,
        event_type: "order_ingested",
        before_state: null,
        after_state: { external_order_id: order.externalOrderId, source_type: order.sourceType },
      });
      if (audit.error) throw new Error(audit.error.message);
    }
  }
  return { imported: imported.length, orderIds: imported };
}
