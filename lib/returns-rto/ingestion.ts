import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedReturn } from "./types";

export async function ingestNormalizedReturns({ supabase, organizationId, records }: { supabase: SupabaseClient<any>; organizationId: string; records: NormalizedReturn[]; }) {
  const db = supabase as any;
  let imported = 0;
  for (const record of records) {
    const orderResult = await db.from("orders").select("id").eq("organization_id", organizationId).eq("external_order_id", record.externalOrderId).maybeSingle();
    if (orderResult.error) throw new Error(orderResult.error.message);
    if (!orderResult.data) throw new Error(`Order ${record.externalOrderId} does not exist. Import the order before its return/RTO record.`);
    const upsert = await db.from("returns_rto").upsert({
      organization_id: organizationId,
      external_return_id: record.externalReturnId,
      order_id: orderResult.data.id,
      kind: record.kind,
      status: record.status,
      reason: record.reason ?? null,
      currency: record.currency,
      refund_amount: record.refundAmount,
      reverse_logistics_cost: record.reverseLogisticsCost,
      requested_at: record.requestedAt,
      approved_at: record.approvedAt ?? null,
      picked_up_at: record.pickedUpAt ?? null,
      received_at: record.receivedAt ?? null,
      refund_due_at: record.refundDueAt ?? null,
      refunded_at: record.refundedAt ?? null,
      source_type: record.sourceType,
      source_metadata: record.metadata ?? {},
    }, { onConflict: "organization_id,source_type,external_return_id" }).select("id").single();
    if (upsert.error) throw new Error(upsert.error.message);
    const returnId = upsert.data.id;
    for (const line of record.lines) {
      const skuResult = await db.from("skus").select("id").eq("organization_id", organizationId).eq("master_sku", line.sku).maybeSingle();
      if (skuResult.error) throw new Error(skuResult.error.message);
      if (!skuResult.data) throw new Error(`Master SKU ${line.sku} does not exist.`);
      const lineUpsert = await db.from("return_rto_lines").upsert({ organization_id: organizationId, return_id: returnId, sku_id: skuResult.data.id, quantity: line.quantity, unit_value: line.unitValue, source_metadata: line.metadata ?? {} }, { onConflict: "organization_id,return_id,sku_id" });
      if (lineUpsert.error) throw new Error(lineUpsert.error.message);
    }
    imported += 1;
  }
  return { imported };
}
