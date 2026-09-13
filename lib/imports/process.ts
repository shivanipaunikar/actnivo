import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommerceChannel,
  Database,
  ImportJob,
  ImportRow,
  Json,
  Location,
  SkuMapping,
} from "@/lib/supabase/database.types";
import { getAllImportRows } from "@/lib/data/imports";
import { ingestNormalizedPurchaseOrders } from "@/lib/purchase-orders/ingestion";
import type { NormalizedPurchaseOrder } from "@/lib/purchase-orders/types";
import type { NormalizedInventoryRow, NormalizedPurchaseOrderImportRow, NormalizedSalesRow } from "./types";
import {
  buildInventorySnapshotRecords,
  buildSalesDailyRecords,
  filterNewSourceRows,
} from "./operational";

const BATCH_SIZE = 400;

function chunks<T>(items: T[], size = BATCH_SIZE) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function normalizedData(row: ImportRow) {
  return row.normalized_data as unknown as NormalizedInventoryRow | NormalizedSalesRow | NormalizedPurchaseOrderImportRow | null;
}

async function allMappings(supabase: SupabaseClient<Database>, organizationId: string, sourceType: ImportJob["source_type"]) {
  const result: SkuMapping[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("sku_mappings").select("*")
      .eq("organization_id", organizationId).eq("source_type", sourceType)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    result.push(...((data ?? []) as SkuMapping[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return result;
}

async function ensureLocation(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  country: string,
  name: string,
) {
  const { data: existing, error: readError } = await supabase.from("locations").select("*")
    .eq("organization_id", organizationId).eq("name", name).eq("type", "warehouse").maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) return existing as Location;
  const { data, error } = await supabase.from("locations").insert({
    organization_id: organizationId,
    name,
    type: "warehouse",
    country,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as Location;
}

async function updateRowStatuses(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  ids: string[],
  status: "imported" | "duplicate",
) {
  for (const batch of chunks(ids)) {
    if (!batch.length) continue;
    const { error } = await supabase.from("import_rows").update({ status }).eq("organization_id", organizationId).in("id", batch);
    if (error) throw new Error(error.message);
  }
}

export async function processImportJob(
  supabase: SupabaseClient<Database>,
  organization: { id: string; country: string },
  job: ImportJob,
) {
  const sourceType = String(job.source_type);
  const rows = await getAllImportRows(supabase, organization.id, job.id);
  const eligible = rows.filter((row) => row.normalized_data && !["invalid", "duplicate", "imported"].includes(row.status));
  const mappings = await allMappings(supabase, organization.id, job.source_type);
  const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]));
  const ready = eligible.filter((row) => {
    const mapping = row.sku_mapping_id ? mappingById.get(row.sku_mapping_id) : null;
    return mapping?.status === "mapped" && Boolean(mapping.master_sku_id);
  });
  if (ready.length !== eligible.length) {
    throw new Error(`${eligible.length - ready.length} SKU mapping${eligible.length - ready.length === 1 ? " is" : "s are"} still required.`);
  }

  const locationNames = [...new Set(ready.map((row) => {
    const data = normalizedData(row);
    if (!data) return null;
    if (sourceType === "purchase_orders" && "destination_location" in data) return data.destination_location;
    return "location" in data ? data.location : null;
  }).filter((name): name is string => Boolean(name)))];
  const locations = new Map<string, Location>();
  for (const name of locationNames) locations.set(name, await ensureLocation(supabase, organization.id, organization.country, name));

  if (sourceType !== "purchase_orders") {
    const listings = new Map<string, {
      organization_id: string;
      sku_id: string;
      channel: CommerceChannel;
      external_sku: string;
      listing_name: string;
      status: "active";
    }>();
    for (const row of ready) {
      const data = normalizedData(row) as NormalizedInventoryRow | NormalizedSalesRow;
      const mapping = mappingById.get(row.sku_mapping_id!)!;
      if (data.channel) {
        const key = `${mapping.master_sku_id}|${data.channel}|${data.sku}`;
        listings.set(key, {
          organization_id: organization.id,
          sku_id: mapping.master_sku_id!,
          channel: data.channel,
          external_sku: data.sku,
          listing_name: data.product_name,
          status: "active",
        });
      }
    }
    for (const batch of chunks([...listings.values()])) {
      if (!batch.length) continue;
      const { error } = await supabase.from("channel_listings").upsert(batch, {
        onConflict: "organization_id,channel,external_sku",
      });
      if (error) throw new Error(error.message);
    }
  }

  const insertedRowIds: string[] = [];
  if (sourceType === "inventory") {
    const records = buildInventorySnapshotRecords(organization.id, job.id, ready.map((row) => ({
      sourceRowId: row.id,
      skuId: mappingById.get(row.sku_mapping_id!)!.master_sku_id!,
      normalized: normalizedData(row) as NormalizedInventoryRow,
    })), new Map([...locations].map(([name, location]) => [name, location.id])));
    for (const batch of chunks(records)) {
      const sourceRowIds = batch.map((record) => record.source_row_id);
      const { data: existing, error: existingError } = await supabase.from("inventory_snapshots")
        .select("source_row_id")
        .eq("organization_id", organization.id)
        .in("source_row_id", sourceRowIds);
      if (existingError) throw new Error(existingError.message);
      const existingSourceRowIds = (existing ?? []).map((item) => item.source_row_id).filter((id): id is string => Boolean(id));
      insertedRowIds.push(...existingSourceRowIds);
      const newRecords = filterNewSourceRows(batch, existingSourceRowIds);
      if (!newRecords.length) continue;
      const { data, error } = await supabase.from("inventory_snapshots").insert(newRecords).select("source_row_id");
      if (error) throw new Error(error.message);
      insertedRowIds.push(...(data ?? []).map((item) => item.source_row_id!).filter(Boolean));
    }
  } else if (sourceType === "sales") {
    const records = buildSalesDailyRecords(organization.id, job.id, ready.map((row) => ({
      sourceRowId: row.id,
      skuId: mappingById.get(row.sku_mapping_id!)!.master_sku_id!,
      normalized: normalizedData(row) as NormalizedSalesRow,
    })), new Map([...locations].map(([name, location]) => [name, location.id])));
    for (const batch of chunks(records)) {
      const sourceRowIds = batch.map((record) => record.source_row_id);
      const { data: existing, error: existingError } = await supabase.from("sales_daily")
        .select("source_row_id")
        .eq("organization_id", organization.id)
        .in("source_row_id", sourceRowIds);
      if (existingError) throw new Error(existingError.message);
      const existingSourceRowIds = (existing ?? []).map((item) => item.source_row_id).filter((id): id is string => Boolean(id));
      insertedRowIds.push(...existingSourceRowIds);
      const newRecords = filterNewSourceRows(batch, existingSourceRowIds);
      if (!newRecords.length) continue;
      const { data, error } = await supabase.from("sales_daily").upsert(newRecords, {
        onConflict: "organization_id,sku_id,location_id,channel,date",
        ignoreDuplicates: true,
      }).select("source_row_id");
      if (error) throw new Error(error.message);
      insertedRowIds.push(...(data ?? []).map((item) => item.source_row_id!).filter(Boolean));
    }
  } else if (sourceType === "purchase_orders") {
    const masterIds = [...new Set(ready.map((row) => mappingById.get(row.sku_mapping_id!)!.master_sku_id!).filter(Boolean))];
    const { data: skuRows, error: skuError } = await supabase.from("skus").select("id,master_sku")
      .eq("organization_id", organization.id).in("id", masterIds);
    if (skuError) throw new Error(skuError.message);
    const masterSkuById = new Map((skuRows ?? []).map((sku) => [sku.id, sku.master_sku]));
    const purchaseOrders = new Map<string, NormalizedPurchaseOrder>();

    for (const row of ready) {
      const data = normalizedData(row) as NormalizedPurchaseOrderImportRow;
      const mapping = mappingById.get(row.sku_mapping_id!)!;
      const masterSku = masterSkuById.get(mapping.master_sku_id!);
      if (!masterSku) throw new Error(`Mapped master SKU not found for ${data.sku}.`);
      const existing = purchaseOrders.get(data.external_po_number);
      if (existing) {
        if (existing.supplierName !== data.supplier_name || existing.destinationLocation !== data.destination_location) {
          throw new Error(`PO ${data.external_po_number} has inconsistent supplier or destination values.`);
        }
        existing.lines.push({
          sku: masterSku,
          orderedQuantity: data.ordered_quantity,
          confirmedQuantity: data.confirmed_quantity ?? undefined,
          receivedQuantity: data.received_quantity,
          unitCost: data.unit_cost ?? undefined,
          expectedDeliveryDate: data.line_expected_delivery_date ?? undefined,
          metadata: { source_row_id: row.id, source_sku: data.sku },
        });
      } else {
        purchaseOrders.set(data.external_po_number, {
          externalPoNumber: data.external_po_number,
          supplierName: data.supplier_name,
          destinationLocation: data.destination_location,
          channel: data.channel ?? undefined,
          orderDate: data.order_date,
          expectedDeliveryDate: data.expected_delivery_date,
          currency: data.currency || "INR",
          totalValue: data.total_value ?? undefined,
          sourceType: "file_import",
          sourceImportId: job.id,
          metadata: { imported_from: job.filename },
          lines: [{
            sku: masterSku,
            orderedQuantity: data.ordered_quantity,
            confirmedQuantity: data.confirmed_quantity ?? undefined,
            receivedQuantity: data.received_quantity,
            unitCost: data.unit_cost ?? undefined,
            expectedDeliveryDate: data.line_expected_delivery_date ?? undefined,
            metadata: { source_row_id: row.id, source_sku: data.sku },
          }],
        });
      }
    }

    await ingestNormalizedPurchaseOrders({
      supabase: supabase as unknown as SupabaseClient,
      organizationId: organization.id,
      records: [...purchaseOrders.values()],
    });
    insertedRowIds.push(...ready.map((row) => row.id));
  } else {
    throw new Error(`Unsupported import source: ${sourceType}`);
  }

  const inserted = new Set(insertedRowIds);
  const duplicateIds = ready.filter((row) => !inserted.has(row.id)).map((row) => row.id);
  await updateRowStatuses(supabase, organization.id, insertedRowIds, "imported");
  await updateRowStatuses(supabase, organization.id, duplicateIds, "duplicate");
  const existingFailures = rows.filter((row) => row.status === "invalid" || row.status === "duplicate").length;
  const failedRows = existingFailures + duplicateIds.length;
  const { error: connectionError } = await supabase.from("connections").upsert({
    organization_id: organization.id,
    provider: "file_upload",
    connection_type: sourceType,
    status: "connected",
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "organization_id,provider,connection_type" });
  if (connectionError) throw new Error(connectionError.message);

  const { error: jobError } = await supabase.from("import_jobs").update({
    status: "completed",
    successful_rows: insertedRowIds.length,
    failed_rows: failedRows,
    error_summary: failedRows ? `${failedRows} row${failedRows === 1 ? " was" : "s were"} skipped during validation or duplicate checks.` : null,
    completed_at: new Date().toISOString(),
  }).eq("organization_id", organization.id).eq("id", job.id);
  if (jobError) throw new Error(jobError.message);
  return { imported: insertedRowIds.length, failed: failedRows };
}

export function asJson(value: unknown) {
  return value as Json;
}
