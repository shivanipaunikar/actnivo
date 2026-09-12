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
import type { NormalizedInventoryRow, NormalizedSalesRow } from "./types";

const BATCH_SIZE = 400;

function chunks<T>(items: T[], size = BATCH_SIZE) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function normalizedData(row: ImportRow) {
  return row.normalized_data as unknown as NormalizedInventoryRow | NormalizedSalesRow | null;
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
    return data && "location" in data ? data.location : null;
  }).filter((name): name is string => Boolean(name)))];
  const locations = new Map<string, Location>();
  for (const name of locationNames) locations.set(name, await ensureLocation(supabase, organization.id, organization.country, name));

  const listings = new Map<string, {
    organization_id: string;
    sku_id: string;
    channel: CommerceChannel;
    external_sku: string;
    listing_name: string;
    status: "active";
  }>();
  for (const row of ready) {
    const data = normalizedData(row)!;
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

  const insertedRowIds: string[] = [];
  if (job.source_type === "inventory") {
    const records = ready.map((row) => {
      const data = normalizedData(row) as NormalizedInventoryRow;
      const mapping = mappingById.get(row.sku_mapping_id!)!;
      return {
        organization_id: organization.id,
        sku_id: mapping.master_sku_id!,
        location_id: locations.get(data.location)!.id,
        channel: data.channel,
        available_quantity: data.available_quantity,
        reserved_quantity: data.reserved_quantity,
        inbound_quantity: data.inbound_quantity,
        snapshot_at: data.snapshot_date,
        source_import_id: job.id,
        source_row_id: row.id,
      };
    });
    for (const batch of chunks(records)) {
      const sourceRowIds = batch.map((record) => record.source_row_id);
      const { data: existing, error: existingError } = await supabase.from("inventory_snapshots")
        .select("source_row_id")
        .eq("organization_id", organization.id)
        .in("source_row_id", sourceRowIds);
      if (existingError) throw new Error(existingError.message);
      const existingIds = new Set((existing ?? []).map((item) => item.source_row_id).filter(Boolean));
      const newRecords = batch.filter((record) => !existingIds.has(record.source_row_id));
      if (!newRecords.length) continue;
      const { data, error } = await supabase.from("inventory_snapshots").insert(newRecords).select("source_row_id");
      if (error) throw new Error(error.message);
      insertedRowIds.push(...(data ?? []).map((item) => item.source_row_id!).filter(Boolean));
    }
  } else {
    const records = ready.map((row) => {
      const data = normalizedData(row) as NormalizedSalesRow;
      const mapping = mappingById.get(row.sku_mapping_id!)!;
      return {
        organization_id: organization.id,
        sku_id: mapping.master_sku_id!,
        location_id: data.location ? locations.get(data.location)!.id : null,
        channel: data.channel,
        date: data.date,
        units_sold: data.units_sold,
        gross_sales: String(data.gross_sales),
        net_sales: data.net_sales === null ? null : String(data.net_sales),
        source_import_id: job.id,
        source_row_id: row.id,
      };
    });
    for (const batch of chunks(records)) {
      const { data, error } = await supabase.from("sales_daily").upsert(batch, {
        onConflict: "organization_id,sku_id,location_id,channel,date",
        ignoreDuplicates: true,
      }).select("source_row_id");
      if (error) throw new Error(error.message);
      insertedRowIds.push(...(data ?? []).map((item) => item.source_row_id!).filter(Boolean));
    }
  }

  const inserted = new Set(insertedRowIds);
  const duplicateIds = ready.filter((row) => !inserted.has(row.id)).map((row) => row.id);
  await updateRowStatuses(supabase, organization.id, insertedRowIds, "imported");
  await updateRowStatuses(supabase, organization.id, duplicateIds, "duplicate");
  const existingFailures = rows.filter((row) => row.status === "invalid" || row.status === "duplicate").length;
  const failedRows = existingFailures + duplicateIds.length;
  const { error: jobError } = await supabase.from("import_jobs").update({
    status: "completed",
    successful_rows: insertedRowIds.length,
    failed_rows: failedRows,
    error_summary: failedRows ? `${failedRows} row${failedRows === 1 ? " was" : "s were"} skipped during validation or duplicate checks.` : null,
    completed_at: new Date().toISOString(),
  }).eq("organization_id", organization.id).eq("id", job.id);
  if (jobError) throw new Error(jobError.message);

  const { error: connectionError } = await supabase.from("connections").upsert({
    organization_id: organization.id,
    provider: "file_upload",
    connection_type: job.source_type,
    status: "connected",
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "organization_id,provider,connection_type" });
  if (connectionError) throw new Error(connectionError.message);
  return { imported: insertedRowIds.length, failed: failedRows };
}

export function asJson(value: unknown) {
  return value as Json;
}
