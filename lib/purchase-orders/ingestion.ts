import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedPurchaseOrder } from "./types";

function asUntyped(client: SupabaseClient) {
  return client as unknown as { from: (table: string) => any };
}

export async function ingestNormalizedPurchaseOrders(input: {
  supabase: SupabaseClient;
  organizationId: string;
  records: NormalizedPurchaseOrder[];
}) {
  const db = asUntyped(input.supabase);
  let purchaseOrders = 0;
  let lines = 0;

  for (const record of input.records) {
    const location = await db.from("locations")
      .select("id,name")
      .eq("organization_id", input.organizationId)
      .ilike("name", record.destinationLocation.trim())
      .maybeSingle();
    if (location.error) throw new Error(location.error.message);
    if (!location.data) throw new Error(`Unknown destination location: ${record.destinationLocation}`);

    const poResult = await db.from("purchase_orders").upsert({
      organization_id: input.organizationId,
      external_po_number: record.externalPoNumber.trim(),
      supplier_name: record.supplierName.trim(),
      supplier_id: record.supplierId ?? null,
      channel: record.channel ?? null,
      destination_location_id: location.data.id,
      order_date: record.orderDate.slice(0, 10),
      expected_delivery_date: record.expectedDeliveryDate.slice(0, 10),
      currency: record.currency ?? "INR",
      total_value: record.totalValue ?? null,
      source_type: record.sourceType,
      source_connection_id: record.sourceConnectionId ?? null,
      source_import_id: record.sourceImportId ?? null,
      source_metadata: record.metadata ?? {},
    }, { onConflict: "organization_id,source_type,external_po_number" }).select("id").single();
    if (poResult.error) throw new Error(poResult.error.message);
    purchaseOrders += 1;

    for (const line of record.lines) {
      if (!Number.isInteger(line.orderedQuantity) || line.orderedQuantity <= 0) {
        throw new Error(`Invalid ordered quantity for ${line.sku}`);
      }
      const sku = await db.from("skus")
        .select("id,master_sku")
        .eq("organization_id", input.organizationId)
        .ilike("master_sku", line.sku.trim())
        .maybeSingle();
      if (sku.error) throw new Error(sku.error.message);
      if (!sku.data) throw new Error(`Unknown SKU: ${line.sku}`);

      const lineRecord = {
        organization_id: input.organizationId,
        purchase_order_id: poResult.data.id,
        sku_id: sku.data.id,
        external_line_id: line.externalLineId ?? null,
        ordered_quantity: line.orderedQuantity,
        confirmed_quantity: line.confirmedQuantity ?? null,
        received_quantity: line.receivedQuantity ?? 0,
        unit_cost: line.unitCost ?? null,
        expected_delivery_date: line.expectedDeliveryDate?.slice(0, 10) ?? null,
        source_metadata: line.metadata ?? {},
      };

      const query = db.from("purchase_order_lines");
      const saved = line.externalLineId
        ? await query.upsert(lineRecord, { onConflict: "organization_id,purchase_order_id,external_line_id" })
        : await query.upsert(lineRecord, { onConflict: "organization_id,purchase_order_id,sku_id" });
      if (saved.error) throw new Error(saved.error.message);
      lines += 1;
    }
  }

  return { purchaseOrders, lines };
}
