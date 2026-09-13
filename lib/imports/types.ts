import type { CommerceChannel, ImportSourceType } from "@/lib/supabase/database.types";

export type SupportedImportSourceType = ImportSourceType | "purchase_orders";

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

export type NormalizedPurchaseOrderImportRow = {
  external_po_number: string;
  supplier_name: string;
  destination_location: string;
  channel: CommerceChannel | null;
  order_date: string;
  expected_delivery_date: string;
  currency: string;
  total_value: number | null;
  sku: string;
  ordered_quantity: number;
  confirmed_quantity: number | null;
  received_quantity: number;
  unit_cost: number | null;
  line_expected_delivery_date: string | null;
};

export type NormalizedImportRow = NormalizedInventoryRow | NormalizedSalesRow | NormalizedPurchaseOrderImportRow;

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
  sourceType: SupportedImportSourceType;
  fields: ImportField[];
};
