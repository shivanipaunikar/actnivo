import type { CommerceChannel, ImportSourceType } from "@/lib/supabase/database.types";

export type RawValue = string | number | boolean | null;
export type RawImportRow = Record<string, RawValue>;

export type ParsedImport = {
  headers: string[];
  rows: RawImportRow[];
};

export type ColumnMapping = Record<string, string>;

export type NormalizedInventoryRow = {
  sku: string;
  product_name: string;
  location: string;
  available_quantity: number;
  reserved_quantity: number;
  inbound_quantity: number;
  snapshot_date: string;
  channel: CommerceChannel | null;
  barcode: string | null;
  brand: string | null;
  category: string | null;
  variant: string | null;
  pack_size: string | null;
  mrp: number;
  selling_price: number;
  cost_price: number | null;
};

export type NormalizedSalesRow = {
  sku: string;
  product_name: string;
  channel: CommerceChannel;
  date: string;
  units_sold: number;
  gross_sales: number;
  net_sales: number | null;
  location: string | null;
  barcode: string | null;
  variant: string | null;
  pack_size: string | null;
};

export type NormalizedImportRow = NormalizedInventoryRow | NormalizedSalesRow;

export type ValidatedRow = {
  rowNumber: number;
  raw: RawImportRow;
  normalized: NormalizedImportRow | null;
  errors: string[];
  duplicate: boolean;
  rowHash: string;
};

export type ImportField = {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
};

export type ImportDefinition = {
  sourceType: ImportSourceType;
  fields: ImportField[];
};
