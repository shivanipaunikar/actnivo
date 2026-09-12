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
export type IssueType = "STOCKOUT_RISK" | "OVERSTOCK" | "INVENTORY_MISMATCH" | "DEMAND_SPIKE" | "DEMAND_DROP";
export type IssueSeverity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "needs_approval" | "running" | "resolved" | "ignored";
export type ActionType = "CREATE_TRANSFER_PLAN" | "CREATE_REPLENISHMENT_PLAN" | "ASSIGN_TASK" | "GENERATE_UPLOAD_FILE";
export type ActionStatus = "CREATED" | "VALIDATED" | "AWAITING_APPROVAL" | "APPROVED" | "EXECUTING" | "EXECUTED" | "VERIFYING" | "VERIFIED" | "FAILED" | "CANCELLED";
export type ExecutionMode = "DIRECT" | "INTEGRATED" | "ASSISTED";
export type VerificationStatus = "PENDING" | "VERIFYING" | "SUCCESS" | "FAILED";

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

export type OrganizationOperatingSettingsRow = {
  organization_id: string; replenishment_lead_time_days: number; safety_days: number;
  minimum_safety_stock: number; target_days_of_cover: number; minimum_safe_denominator: string;
  verification_tolerance_percent: string; updated_by: string | null; created_at: string; updated_at: string;
};
export type ForecastCalculationRow = {
  id: string; organization_id: string; sku_id: string; location_id: string; channel: CommerceChannel | null;
  calculated_at: string; anchor_date: string; available_quantity: number; seven_day_daily_avg: string;
  fourteen_day_daily_avg: string; twenty_eight_day_daily_avg: string; weighted_daily_velocity: string;
  days_of_cover: string; lead_time_days: number; safety_days: number; minimum_safety_stock: number;
  minimum_safe_denominator: string; estimated_shortage_units: number; estimated_revenue_at_risk: string;
  projected_stockout_at: string | null; confidence: string; formula_version: string; inputs: Json;
};
export type IssueRow = {
  id: string; organization_id: string; type: IssueType; severity: IssueSeverity; status: IssueStatus;
  sku_id: string; location_id: string | null; channel: CommerceChannel | null; forecast_calculation_id: string | null;
  title: string; summary: string; detected_at: string; days_of_cover: string | null; estimated_shortage_units: number | null;
  estimated_revenue_at_risk: string | null; confidence: string | null; metadata: Json; assigned_to: string | null;
  resolved_at: string | null; updated_at: string;
};
export type IssueRecommendationRow = {
  id: string; organization_id: string; issue_id: string; source_location_id: string | null; destination_location_id: string;
  quantity: number; reason: string; estimated_revenue_protected: string; source_coverage_after: string | null;
  destination_coverage_after: string; calculation: Json; created_at: string; updated_at: string;
};
export type ActionRow = {
  id: string; organization_id: string; issue_id: string | null; type: ActionType; status: ActionStatus;
  requested_by: string; approved_by: string | null; execution_mode: ExecutionMode; payload: Json;
  idempotency_key: string; external_reference: string | null; created_at: string; approved_at: string | null;
  executed_at: string | null; updated_at: string;
};
export type ActionOutcomeRow = {
  id: string; organization_id: string; action_id: string; before_state: Json; expected_state: Json; actual_state: Json | null;
  estimated_value_protected: string; actual_value_protected: string | null; success: boolean | null;
  verification_status: VerificationStatus; verified_at: string | null; created_at: string; updated_at: string;
};
export type AuditEventRow = {
  id: string; organization_id: string; actor_id: string | null; entity_type: string; entity_id: string;
  event_type: string; before_state: Json | null; after_state: Json | null; created_at: string;
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
      organization_operating_settings: TableDefinition<OrganizationOperatingSettingsRow, NewRow<OrganizationOperatingSettingsRow, "organization_id">>;
      forecast_calculations: TableDefinition<ForecastCalculationRow, NewRow<ForecastCalculationRow, "organization_id" | "sku_id" | "location_id" | "anchor_date" | "available_quantity" | "seven_day_daily_avg" | "fourteen_day_daily_avg" | "twenty_eight_day_daily_avg" | "weighted_daily_velocity" | "days_of_cover" | "lead_time_days" | "safety_days" | "minimum_safety_stock" | "minimum_safe_denominator" | "estimated_shortage_units" | "estimated_revenue_at_risk" | "confidence">>;
      issues: TableDefinition<IssueRow, NewRow<IssueRow, "organization_id" | "type" | "severity" | "sku_id" | "title" | "summary">>;
      issue_recommendations: TableDefinition<IssueRecommendationRow, NewRow<IssueRecommendationRow, "organization_id" | "issue_id" | "destination_location_id" | "quantity" | "reason" | "estimated_revenue_protected" | "destination_coverage_after">>;
      actions: TableDefinition<ActionRow, NewRow<ActionRow, "organization_id" | "type" | "requested_by" | "idempotency_key">>;
      action_outcomes: TableDefinition<ActionOutcomeRow, NewRow<ActionOutcomeRow, "organization_id" | "action_id" | "before_state" | "expected_state">>;
      audit_events: TableDefinition<AuditEventRow, NewRow<AuditEventRow, "organization_id" | "entity_type" | "entity_id" | "event_type">>;
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
      issue_type: IssueType;
      issue_severity: IssueSeverity;
      issue_status: IssueStatus;
      action_type: ActionType;
      action_status: ActionStatus;
      execution_mode: ExecutionMode;
      verification_status: VerificationStatus;
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
export type OrganizationOperatingSettings = OrganizationOperatingSettingsRow;
export type ForecastCalculation = ForecastCalculationRow;
export type Issue = IssueRow;
export type IssueRecommendation = IssueRecommendationRow;
export type Action = ActionRow;
export type ActionOutcome = ActionOutcomeRow;
export type AuditEvent = AuditEventRow;
