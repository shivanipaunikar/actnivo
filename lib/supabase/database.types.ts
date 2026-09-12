export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationRole =
  | "owner"
  | "admin"
  | "ops_manager"
  | "inventory_manager"
  | "finance"
  | "viewer";

export type CommerceChannel =
  | "shopify"
  | "amazon"
  | "flipkart"
  | "meesho"
  | "blinkit"
  | "zepto"
  | "swiggy_instamart"
  | "woocommerce"
  | "unicommerce"
  | "easyecom"
  | "other";

export type ConnectionStatus = "pending" | "connected" | "disconnected" | "error";
export type ImportSourceType = "inventory" | "sales";
export type ImportJobStatus = "uploaded" | "mapping_required" | "processing" | "completed" | "failed";
export type LocationType = "warehouse" | "marketplace_fc" | "dark_store" | "store" | "3pl" | "other";
export type ListingStatus = "active" | "inactive" | "suppressed";
export type SkuMappingStatus = "mapped" | "suggested" | "conflict" | "unmapped";
export type SkuMatchMethod = "barcode" | "exact_sku" | "normalized_sku" | "product_similarity" | "manual" | "new_master" | "none";
export type ImportRowStatus = "staged" | "valid" | "invalid" | "duplicate" | "pending_sku_mapping" | "imported";

type OrganizationRow = {
  id: string;
  created_by: string;
  name: string;
  slug: string;
  website: string | null;
  country: string;
  timezone: string;
  currency: string;
  monthly_order_volume: number | null;
  sku_count: number | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
  updated_at: string;
};

type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
};

type OrganizationChannelRow = {
  id: string;
  organization_id: string;
  channel: CommerceChannel;
  custom_name: string | null;
  created_at: string;
};

export type ConnectionRow = {
  id: string;
  organization_id: string;
  provider: string;
  connection_type: string;
  status: ConnectionStatus;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportJobRow = {
  id: string;
  organization_id: string;
  source_type: ImportSourceType;
  filename: string;
  storage_path: string;
  status: ImportJobStatus;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  error_summary: string | null;
  column_mapping: Json | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
};

export type SourceFileRow = {
  id: string;
  organization_id: string;
  import_job_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  checksum: string;
  created_at: string;
};

export type LocationRow = {
  id: string;
  organization_id: string;
  name: string;
  type: LocationType;
  city: string | null;
  state: string | null;
  country: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SkuRow = {
  id: string;
  organization_id: string;
  master_sku: string;
  product_name: string;
  brand: string | null;
  category: string | null;
  variant: string | null;
  barcode: string | null;
  mrp: string;
  selling_price: string;
  cost_price: string | null;
  pack_size: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ChannelListingRow = {
  id: string;
  organization_id: string;
  sku_id: string;
  channel: CommerceChannel;
  external_sku: string;
  external_product_id: string | null;
  listing_name: string | null;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
};

export type SkuMappingRow = {
  id: string;
  organization_id: string;
  source_type: ImportSourceType;
  source_sku: string;
  source_barcode: string | null;
  source_product_name: string | null;
  source_variant: string | null;
  source_pack_size: string | null;
  master_sku_id: string | null;
  status: SkuMappingStatus;
  match_method: SkuMatchMethod;
  confidence: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportRow = {
  id: string;
  organization_id: string;
  import_job_id: string;
  row_number: number;
  raw_data: Json;
  normalized_data: Json | null;
  validation_errors: string[];
  row_hash: string;
  status: ImportRowStatus;
  sku_mapping_id: string | null;
  created_at: string;
};

export type InventorySnapshotRow = {
  id: string;
  organization_id: string;
  sku_id: string;
  location_id: string;
  channel: CommerceChannel | null;
  available_quantity: number;
  reserved_quantity: number;
  inbound_quantity: number;
  snapshot_at: string;
  source_import_id: string | null;
  source_row_id: string | null;
  created_at: string;
};

export type SalesDailyRow = {
  id: string;
  organization_id: string;
  sku_id: string;
  location_id: string | null;
  channel: CommerceChannel;
  date: string;
  units_sold: number;
  gross_sales: string;
  net_sales: string | null;
  source_import_id: string | null;
  source_row_id: string | null;
  created_at: string;
  updated_at: string;
};

type TableDefinition<Row, Insert extends Record<string, unknown>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

type NewRow<Row, RequiredKeys extends keyof Row> = Partial<Row> & Pick<Row, RequiredKeys>;

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: {
          id?: string;
          created_by: string;
          name: string;
          slug: string;
          website?: string | null;
          country: string;
          timezone: string;
          currency?: string;
          monthly_order_volume?: number | null;
          sku_count?: number | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<OrganizationRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: Omit<OrganizationMemberRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<OrganizationMemberRow>;
        Relationships: [];
      };
      organization_channels: {
        Row: OrganizationChannelRow;
        Insert: Omit<OrganizationChannelRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<OrganizationChannelRow>;
        Relationships: [];
      };
      connections: TableDefinition<ConnectionRow, NewRow<ConnectionRow, "organization_id" | "provider" | "connection_type">>;
      import_jobs: TableDefinition<ImportJobRow, NewRow<ImportJobRow, "organization_id" | "source_type" | "filename" | "storage_path" | "created_by">>;
      source_files: TableDefinition<SourceFileRow, NewRow<SourceFileRow, "organization_id" | "import_job_id" | "storage_path" | "original_filename" | "mime_type" | "file_size" | "checksum">>;
      locations: TableDefinition<LocationRow, NewRow<LocationRow, "organization_id" | "name">>;
      skus: TableDefinition<SkuRow, NewRow<SkuRow, "organization_id" | "master_sku" | "product_name">>;
      channel_listings: TableDefinition<ChannelListingRow, NewRow<ChannelListingRow, "organization_id" | "sku_id" | "channel" | "external_sku">>;
      sku_mappings: TableDefinition<SkuMappingRow, NewRow<SkuMappingRow, "organization_id" | "source_type" | "source_sku">>;
      import_rows: TableDefinition<ImportRow, NewRow<ImportRow, "organization_id" | "import_job_id" | "row_number" | "raw_data" | "row_hash">>;
      inventory_snapshots: TableDefinition<InventorySnapshotRow, NewRow<InventorySnapshotRow, "organization_id" | "sku_id" | "location_id" | "available_quantity" | "snapshot_at">>;
      sales_daily: TableDefinition<SalesDailyRow, NewRow<SalesDailyRow, "organization_id" | "sku_id" | "channel" | "date" | "units_sold" | "gross_sales">>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      organization_role: OrganizationRole;
      commerce_channel: CommerceChannel;
      connection_status: ConnectionStatus;
      import_source_type: ImportSourceType;
      import_job_status: ImportJobStatus;
      location_type: LocationType;
      listing_status: ListingStatus;
      sku_mapping_status: SkuMappingStatus;
      sku_match_method: SkuMatchMethod;
      import_row_status: ImportRowStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Organization = OrganizationRow;
export type Profile = ProfileRow;
export type OrganizationMember = OrganizationMemberRow;
export type OrganizationChannel = OrganizationChannelRow;
export type Connection = ConnectionRow;
export type ImportJob = ImportJobRow;
export type SourceFile = SourceFileRow;
export type Location = LocationRow;
export type Sku = SkuRow;
export type ChannelListing = ChannelListingRow;
export type SkuMapping = SkuMappingRow;
export type InventorySnapshot = InventorySnapshotRow;
export type SalesDaily = SalesDailyRow;
