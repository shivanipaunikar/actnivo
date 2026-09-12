import type { CommerceChannel } from "@/lib/supabase/database.types";
import type { NormalizedInventoryRow, NormalizedSalesRow } from "./types";

export type ResolvedImportRow<T> = {
  sourceRowId: string;
  skuId: string;
  normalized: T;
};

export type InventorySnapshotInsert = {
  organization_id: string;
  sku_id: string;
  location_id: string;
  channel: CommerceChannel | null;
  available_quantity: number;
  reserved_quantity: number;
  inbound_quantity: number;
  snapshot_at: string;
  source_import_id: string;
  source_row_id: string;
};

export type SalesDailyInsert = {
  organization_id: string;
  sku_id: string;
  location_id: string | null;
  channel: CommerceChannel;
  date: string;
  units_sold: number;
  gross_sales: string;
  net_sales: string | null;
  source_import_id: string;
  source_row_id: string;
};

function locationId(locations: ReadonlyMap<string, string>, name: string) {
  const id = locations.get(name);
  if (!id) throw new Error(`Location ${name} was not resolved.`);
  return id;
}

export function buildInventorySnapshotRecords(
  organizationId: string,
  importJobId: string,
  rows: Array<ResolvedImportRow<NormalizedInventoryRow>>,
  locations: ReadonlyMap<string, string>,
): InventorySnapshotInsert[] {
  return rows.map(({ sourceRowId, skuId, normalized }) => ({
    organization_id: organizationId,
    sku_id: skuId,
    location_id: locationId(locations, normalized.location),
    channel: normalized.channel,
    available_quantity: normalized.available_quantity,
    reserved_quantity: normalized.reserved_quantity,
    inbound_quantity: normalized.inbound_quantity,
    snapshot_at: normalized.snapshot_date,
    source_import_id: importJobId,
    source_row_id: sourceRowId,
  }));
}

export function buildSalesDailyRecords(
  organizationId: string,
  importJobId: string,
  rows: Array<ResolvedImportRow<NormalizedSalesRow>>,
  locations: ReadonlyMap<string, string>,
): SalesDailyInsert[] {
  return rows.map(({ sourceRowId, skuId, normalized }) => ({
    organization_id: organizationId,
    sku_id: skuId,
    location_id: normalized.location ? locationId(locations, normalized.location) : null,
    channel: normalized.channel,
    date: normalized.date,
    units_sold: normalized.units_sold,
    gross_sales: String(normalized.gross_sales),
    net_sales: normalized.net_sales === null ? null : String(normalized.net_sales),
    source_import_id: importJobId,
    source_row_id: sourceRowId,
  }));
}

export function filterNewSourceRows<T extends { source_row_id: string }>(records: T[], existingSourceRowIds: Iterable<string>) {
  const existing = new Set(existingSourceRowIds);
  return records.filter((record) => !existing.has(record.source_row_id));
}
