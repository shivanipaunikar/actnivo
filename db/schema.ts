import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const organizationRole = pgEnum("organization_role", [
  "owner",
  "admin",
  "ops_manager",
  "inventory_manager",
  "finance",
  "viewer",
]);

export const commerceChannel = pgEnum("commerce_channel", [
  "shopify",
  "amazon",
  "flipkart",
  "meesho",
  "blinkit",
  "zepto",
  "swiggy_instamart",
  "woocommerce",
  "unicommerce",
  "easyecom",
  "other",
]);

export const connectionStatus = pgEnum("connection_status", ["pending", "connected", "disconnected", "error"]);
export const importSourceType = pgEnum("import_source_type", ["inventory", "sales"]);
export const importJobStatus = pgEnum("import_job_status", ["uploaded", "mapping_required", "processing", "completed", "failed"]);
export const locationType = pgEnum("location_type", ["warehouse", "marketplace_fc", "dark_store", "store", "3pl", "other"]);
export const listingStatus = pgEnum("listing_status", ["active", "inactive", "suppressed"]);
export const skuMappingStatus = pgEnum("sku_mapping_status", ["mapped", "suggested", "conflict", "unmapped"]);
export const skuMatchMethod = pgEnum("sku_match_method", ["barcode", "exact_sku", "normalized_sku", "product_similarity", "manual", "new_master", "none"]);
export const importRowStatus = pgEnum("import_row_status", ["staged", "valid", "invalid", "duplicate", "pending_sku_mapping", "imported"]);
export const issueType = pgEnum("issue_type", ["STOCKOUT_RISK", "OVERSTOCK", "INVENTORY_MISMATCH", "DEMAND_SPIKE", "DEMAND_DROP"]);
export const issueSeverity = pgEnum("issue_severity", ["critical", "high", "medium", "low"]);
export const issueStatus = pgEnum("issue_status", ["open", "needs_approval", "running", "resolved", "ignored"]);
export const actionType = pgEnum("action_type", ["CREATE_TRANSFER_PLAN", "CREATE_REPLENISHMENT_PLAN", "ASSIGN_TASK", "GENERATE_UPLOAD_FILE"]);
export const actionStatus = pgEnum("action_status", ["CREATED", "VALIDATED", "AWAITING_APPROVAL", "APPROVED", "EXECUTING", "EXECUTED", "VERIFYING", "VERIFIED", "FAILED", "CANCELLED"]);
export const executionMode = pgEnum("execution_mode", ["DIRECT", "INTEGRATED", "ASSISTED"]);
export const verificationStatus = pgEnum("verification_status", ["PENDING", "VERIFYING", "SUCCESS", "FAILED"]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdBy: uuid("created_by").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    website: text("website"),
    country: text("country").notNull(),
    timezone: text("timezone").notNull(),
    currency: text("currency").notNull().default("INR"),
    monthlyOrderVolume: integer("monthly_order_volume"),
    skuCount: integer("sku_count"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organizations_slug_key").on(table.slug),
    index("organizations_created_by_idx").on(table.createdBy),
  ],
);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: organizationRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_key").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_user_id_idx").on(table.userId),
    index("organization_members_organization_id_idx").on(table.organizationId),
  ],
);

export const organizationChannels = pgTable(
  "organization_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channel: commerceChannel("channel").notNull(),
    customName: text("custom_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_channels_org_channel_key").on(
      table.organizationId,
      table.channel,
    ),
    index("organization_channels_organization_id_idx").on(table.organizationId),
  ],
);

export const connections = pgTable("connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  connectionType: text("connection_type").notNull(),
  status: connectionStatus("status").notNull().default("pending"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("connections_org_provider_type_key").on(table.organizationId, table.provider, table.connectionType),
  index("connections_organization_id_idx").on(table.organizationId),
]);

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sourceType: importSourceType("source_type").notNull(),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  status: importJobStatus("status").notNull().default("uploaded"),
  totalRows: integer("total_rows").notNull().default(0),
  successfulRows: integer("successful_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  errorSummary: text("error_summary"),
  columnMapping: jsonb("column_mapping"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  uniqueIndex("import_jobs_id_organization_key").on(table.id, table.organizationId),
  index("import_jobs_organization_created_idx").on(table.organizationId, table.createdAt),
  index("import_jobs_created_by_idx").on(table.createdBy),
]);

export const sourceFiles = pgTable("source_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  importJobId: uuid("import_job_id").notNull(),
  storagePath: text("storage_path").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  checksum: text("checksum").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.importJobId, table.organizationId], foreignColumns: [importJobs.id, importJobs.organizationId], name: "source_files_import_job_fk" }).onDelete("cascade"),
  uniqueIndex("source_files_organization_checksum_key").on(table.organizationId, table.checksum),
  index("source_files_organization_id_idx").on(table.organizationId),
  index("source_files_import_job_id_idx").on(table.importJobId, table.organizationId),
]);

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: locationType("type").notNull().default("warehouse"),
  city: text("city"),
  state: text("state"),
  country: text("country").notNull().default("India"),
  externalId: text("external_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("locations_id_organization_key").on(table.id, table.organizationId),
  uniqueIndex("locations_organization_name_type_key").on(table.organizationId, table.name, table.type),
  index("locations_organization_id_idx").on(table.organizationId),
]);

export const skus = pgTable("skus", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  masterSku: text("master_sku").notNull(),
  productName: text("product_name").notNull(),
  brand: text("brand"),
  category: text("category"),
  variant: text("variant"),
  barcode: text("barcode"),
  mrp: numeric("mrp", { precision: 14, scale: 2 }).notNull().default("0"),
  sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }).notNull().default("0"),
  costPrice: numeric("cost_price", { precision: 14, scale: 2 }),
  packSize: text("pack_size"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("skus_id_organization_key").on(table.id, table.organizationId),
  uniqueIndex("skus_organization_master_sku_key").on(table.organizationId, table.masterSku),
  uniqueIndex("skus_organization_barcode_key").on(table.organizationId, table.barcode).where(sql`${table.barcode} is not null`),
  index("skus_organization_id_idx").on(table.organizationId),
  index("skus_organization_product_name_idx").on(table.organizationId, table.productName),
]);

export const channelListings = pgTable("channel_listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  skuId: uuid("sku_id").notNull(),
  channel: commerceChannel("channel").notNull(),
  externalSku: text("external_sku").notNull(),
  externalProductId: text("external_product_id"),
  listingName: text("listing_name"),
  status: listingStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.skuId, table.organizationId], foreignColumns: [skus.id, skus.organizationId], name: "channel_listings_sku_fk" }).onDelete("cascade"),
  uniqueIndex("channel_listings_organization_channel_sku_key").on(table.organizationId, table.channel, table.externalSku),
  index("channel_listings_organization_id_idx").on(table.organizationId),
  index("channel_listings_sku_id_idx").on(table.skuId, table.organizationId),
]);

export const skuMappings = pgTable("sku_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sourceType: importSourceType("source_type").notNull(),
  sourceSku: text("source_sku").notNull(),
  sourceBarcode: text("source_barcode"),
  sourceProductName: text("source_product_name"),
  sourceVariant: text("source_variant"),
  sourcePackSize: text("source_pack_size"),
  masterSkuId: uuid("master_sku_id"),
  status: skuMappingStatus("status").notNull().default("unmapped"),
  matchMethod: skuMatchMethod("match_method").notNull().default("none"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.masterSkuId, table.organizationId], foreignColumns: [skus.id, skus.organizationId], name: "sku_mappings_master_sku_fk" }),
  uniqueIndex("sku_mappings_id_organization_key").on(table.id, table.organizationId),
  uniqueIndex("sku_mappings_organization_source_key").on(table.organizationId, table.sourceType, table.sourceSku),
  index("sku_mappings_organization_status_idx").on(table.organizationId, table.status),
  index("sku_mappings_master_sku_id_idx").on(table.masterSkuId, table.organizationId),
]);

export const importRows = pgTable("import_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  importJobId: uuid("import_job_id").notNull(),
  rowNumber: integer("row_number").notNull(),
  rawData: jsonb("raw_data").notNull(),
  normalizedData: jsonb("normalized_data"),
  validationErrors: text("validation_errors").array().notNull().default(sql`'{}'::text[]`),
  rowHash: text("row_hash").notNull(),
  status: importRowStatus("status").notNull().default("staged"),
  skuMappingId: uuid("sku_mapping_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.importJobId, table.organizationId], foreignColumns: [importJobs.id, importJobs.organizationId], name: "import_rows_import_job_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.skuMappingId, table.organizationId], foreignColumns: [skuMappings.id, skuMappings.organizationId], name: "import_rows_sku_mapping_fk" }),
  uniqueIndex("import_rows_id_organization_key").on(table.id, table.organizationId),
  uniqueIndex("import_rows_import_row_key").on(table.importJobId, table.rowNumber),
  index("import_rows_organization_id_idx").on(table.organizationId),
  index("import_rows_import_job_status_idx").on(table.importJobId, table.organizationId, table.status),
  index("import_rows_sku_mapping_id_idx").on(table.skuMappingId, table.organizationId),
]);

export const inventorySnapshots = pgTable("inventory_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  skuId: uuid("sku_id").notNull(),
  locationId: uuid("location_id").notNull(),
  channel: commerceChannel("channel"),
  availableQuantity: integer("available_quantity").notNull(),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  inboundQuantity: integer("inbound_quantity").notNull().default(0),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true, mode: "date" }).notNull(),
  sourceImportId: uuid("source_import_id"),
  sourceRowId: uuid("source_row_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.skuId, table.organizationId], foreignColumns: [skus.id, skus.organizationId], name: "inventory_snapshots_sku_fk" }),
  foreignKey({ columns: [table.locationId, table.organizationId], foreignColumns: [locations.id, locations.organizationId], name: "inventory_snapshots_location_fk" }),
  foreignKey({ columns: [table.sourceImportId, table.organizationId], foreignColumns: [importJobs.id, importJobs.organizationId], name: "inventory_snapshots_import_fk" }),
  foreignKey({ columns: [table.sourceRowId, table.organizationId], foreignColumns: [importRows.id, importRows.organizationId], name: "inventory_snapshots_source_row_fk" }),
  index("inventory_snapshots_organization_snapshot_idx").on(table.organizationId, table.snapshotAt),
  index("inventory_snapshots_sku_snapshot_idx").on(table.skuId, table.organizationId, table.snapshotAt),
  index("inventory_snapshots_location_id_idx").on(table.locationId, table.organizationId),
  index("inventory_snapshots_source_import_id_idx").on(table.sourceImportId, table.organizationId),
  index("inventory_snapshots_source_row_org_idx").on(table.sourceRowId, table.organizationId),
  uniqueIndex("inventory_snapshots_source_row_key").on(table.sourceRowId).where(sql`${table.sourceRowId} is not null`),
]);

export const salesDaily = pgTable("sales_daily", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  skuId: uuid("sku_id").notNull(),
  locationId: uuid("location_id"),
  channel: commerceChannel("channel").notNull(),
  date: date("date").notNull(),
  unitsSold: integer("units_sold").notNull(),
  grossSales: numeric("gross_sales", { precision: 14, scale: 2 }).notNull(),
  netSales: numeric("net_sales", { precision: 14, scale: 2 }),
  sourceImportId: uuid("source_import_id"),
  sourceRowId: uuid("source_row_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.skuId, table.organizationId], foreignColumns: [skus.id, skus.organizationId], name: "sales_daily_sku_fk" }),
  foreignKey({ columns: [table.locationId, table.organizationId], foreignColumns: [locations.id, locations.organizationId], name: "sales_daily_location_fk" }),
  foreignKey({ columns: [table.sourceImportId, table.organizationId], foreignColumns: [importJobs.id, importJobs.organizationId], name: "sales_daily_import_fk" }),
  foreignKey({ columns: [table.sourceRowId, table.organizationId], foreignColumns: [importRows.id, importRows.organizationId], name: "sales_daily_source_row_fk" }),
  index("sales_daily_organization_date_idx").on(table.organizationId, table.date),
  index("sales_daily_sku_date_idx").on(table.skuId, table.organizationId, table.date),
  index("sales_daily_location_id_idx").on(table.locationId, table.organizationId),
  index("sales_daily_source_import_id_idx").on(table.sourceImportId, table.organizationId),
  index("sales_daily_source_row_org_idx").on(table.sourceRowId, table.organizationId),
  uniqueIndex("sales_daily_source_row_key").on(table.sourceRowId).where(sql`${table.sourceRowId} is not null`),
]);

export const organizationOperatingSettings = pgTable("organization_operating_settings", {
  organizationId: uuid("organization_id").primaryKey().references(() => organizations.id, { onDelete: "cascade" }),
  replenishmentLeadTimeDays: integer("replenishment_lead_time_days").notNull().default(7),
  safetyDays: integer("safety_days").notNull().default(3),
  minimumSafetyStock: integer("minimum_safety_stock").notNull().default(0),
  targetDaysOfCover: integer("target_days_of_cover").notNull().default(21),
  minimumSafeDenominator: numeric("minimum_safe_denominator", { precision: 12, scale: 4 }).notNull().default("0.1"),
  verificationTolerancePercent: numeric("verification_tolerance_percent", { precision: 5, scale: 2 }).notNull().default("10"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const forecastCalculations = pgTable("forecast_calculations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  skuId: uuid("sku_id").notNull(),
  locationId: uuid("location_id").notNull(),
  channel: commerceChannel("channel"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  anchorDate: date("anchor_date").notNull(),
  availableQuantity: integer("available_quantity").notNull(),
  sevenDayDailyAvg: numeric("seven_day_daily_avg", { precision: 16, scale: 6 }).notNull(),
  fourteenDayDailyAvg: numeric("fourteen_day_daily_avg", { precision: 16, scale: 6 }).notNull(),
  twentyEightDayDailyAvg: numeric("twenty_eight_day_daily_avg", { precision: 16, scale: 6 }).notNull(),
  weightedDailyVelocity: numeric("weighted_daily_velocity", { precision: 16, scale: 6 }).notNull(),
  daysOfCover: numeric("days_of_cover", { precision: 16, scale: 4 }).notNull(),
  leadTimeDays: integer("lead_time_days").notNull(),
  safetyDays: integer("safety_days").notNull(),
  minimumSafetyStock: integer("minimum_safety_stock").notNull(),
  minimumSafeDenominator: numeric("minimum_safe_denominator", { precision: 12, scale: 4 }).notNull(),
  estimatedShortageUnits: integer("estimated_shortage_units").notNull(),
  estimatedRevenueAtRisk: numeric("estimated_revenue_at_risk", { precision: 16, scale: 2 }).notNull(),
  projectedStockoutAt: timestamp("projected_stockout_at", { withTimezone: true, mode: "date" }),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
  formulaVersion: text("formula_version").notNull().default("stockout-v1"),
  inputs: jsonb("inputs").notNull().default(sql`'{}'::jsonb`),
}, (table) => [
  foreignKey({ columns: [table.skuId, table.organizationId], foreignColumns: [skus.id, skus.organizationId], name: "forecast_calculations_sku_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.locationId, table.organizationId], foreignColumns: [locations.id, locations.organizationId], name: "forecast_calculations_location_fk" }).onDelete("cascade"),
  uniqueIndex("forecast_calculations_id_organization_key").on(table.id, table.organizationId),
  index("forecast_calculations_scope_idx").on(table.organizationId, table.skuId, table.locationId, table.channel, table.calculatedAt),
]);

export const issues = pgTable("issues", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: issueType("type").notNull(), severity: issueSeverity("severity").notNull(), status: issueStatus("status").notNull().default("open"),
  skuId: uuid("sku_id").notNull(), locationId: uuid("location_id"), channel: commerceChannel("channel"), forecastCalculationId: uuid("forecast_calculation_id"),
  title: text("title").notNull(), summary: text("summary").notNull(), detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  daysOfCover: numeric("days_of_cover", { precision: 16, scale: 4 }), estimatedShortageUnits: integer("estimated_shortage_units"),
  estimatedRevenueAtRisk: numeric("estimated_revenue_at_risk", { precision: 16, scale: 2 }), confidence: numeric("confidence", { precision: 5, scale: 4 }),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`), assignedTo: uuid("assigned_to"), resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.skuId, table.organizationId], foreignColumns: [skus.id, skus.organizationId], name: "issues_sku_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.locationId, table.organizationId], foreignColumns: [locations.id, locations.organizationId], name: "issues_location_fk" }),
  foreignKey({ columns: [table.forecastCalculationId, table.organizationId], foreignColumns: [forecastCalculations.id, forecastCalculations.organizationId], name: "issues_forecast_fk" }),
  uniqueIndex("issues_id_organization_key").on(table.id, table.organizationId), index("issues_priority_idx").on(table.organizationId, table.status, table.estimatedRevenueAtRisk),
]);

export const issueRecommendations = pgTable("issue_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), issueId: uuid("issue_id").notNull(),
  sourceLocationId: uuid("source_location_id"), destinationLocationId: uuid("destination_location_id").notNull(), quantity: integer("quantity").notNull(), reason: text("reason").notNull(),
  estimatedRevenueProtected: numeric("estimated_revenue_protected", { precision: 16, scale: 2 }).notNull(), sourceCoverageAfter: numeric("source_coverage_after", { precision: 16, scale: 4 }),
  destinationCoverageAfter: numeric("destination_coverage_after", { precision: 16, scale: 4 }).notNull(), calculation: jsonb("calculation").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.issueId, table.organizationId], foreignColumns: [issues.id, issues.organizationId], name: "issue_recommendations_issue_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.sourceLocationId, table.organizationId], foreignColumns: [locations.id, locations.organizationId], name: "issue_recommendations_source_location_fk" }),
  foreignKey({ columns: [table.destinationLocationId, table.organizationId], foreignColumns: [locations.id, locations.organizationId], name: "issue_recommendations_destination_location_fk" }),
  uniqueIndex("issue_recommendations_id_organization_key").on(table.id, table.organizationId), uniqueIndex("issue_recommendations_issue_key").on(table.issueId),
]);

export const actions = pgTable("actions", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), issueId: uuid("issue_id"),
  type: actionType("type").notNull(), status: actionStatus("status").notNull().default("CREATED"), requestedBy: uuid("requested_by").notNull(), approvedBy: uuid("approved_by"),
  executionMode: executionMode("execution_mode").notNull().default("ASSISTED"), payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`), idempotencyKey: text("idempotency_key").notNull(),
  externalReference: text("external_reference"), createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(), approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }), updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [foreignKey({ columns: [table.issueId, table.organizationId], foreignColumns: [issues.id, issues.organizationId], name: "actions_issue_fk" }), uniqueIndex("actions_id_organization_key").on(table.id, table.organizationId), uniqueIndex("actions_idempotency_key").on(table.idempotencyKey), index("actions_status_idx").on(table.organizationId, table.status, table.createdAt)]);

export const actionOutcomes = pgTable("action_outcomes", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), actionId: uuid("action_id").notNull(),
  beforeState: jsonb("before_state").notNull(), expectedState: jsonb("expected_state").notNull(), actualState: jsonb("actual_state"), estimatedValueProtected: numeric("estimated_value_protected", { precision: 16, scale: 2 }).notNull().default("0"),
  actualValueProtected: numeric("actual_value_protected", { precision: 16, scale: 2 }), success: boolean("success"), verificationStatus: verificationStatus("verification_status").notNull().default("PENDING"),
  verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }), createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [foreignKey({ columns: [table.actionId, table.organizationId], foreignColumns: [actions.id, actions.organizationId], name: "action_outcomes_action_fk" }).onDelete("cascade"), uniqueIndex("action_outcomes_id_organization_key").on(table.id, table.organizationId), uniqueIndex("action_outcomes_action_key").on(table.actionId)]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), actorId: uuid("actor_id"), entityType: text("entity_type").notNull(), entityId: uuid("entity_id").notNull(), eventType: text("event_type").notNull(),
  beforeState: jsonb("before_state"), afterState: jsonb("after_state"), createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("audit_events_entity_idx").on(table.organizationId, table.entityType, table.entityId, table.createdAt), index("audit_events_actor_idx").on(table.actorId)]);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  channels: many(organizationChannels),
  connections: many(connections),
  importJobs: many(importJobs),
  locations: many(locations),
  skus: many(skus),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const organizationChannelsRelations = relations(
  organizationChannels,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationChannels.organizationId],
      references: [organizations.id],
    }),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type OrganizationChannel = typeof organizationChannels.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type ImportJob = typeof importJobs.$inferSelect;
export type SourceFile = typeof sourceFiles.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Sku = typeof skus.$inferSelect;
export type ChannelListing = typeof channelListings.$inferSelect;
export type SkuMapping = typeof skuMappings.$inferSelect;
export type ImportRow = typeof importRows.$inferSelect;
export type InventorySnapshot = typeof inventorySnapshots.$inferSelect;
export type SalesDaily = typeof salesDaily.$inferSelect;
export type OrganizationOperatingSettings = typeof organizationOperatingSettings.$inferSelect;
export type ForecastCalculation = typeof forecastCalculations.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type IssueRecommendation = typeof issueRecommendations.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type ActionOutcome = typeof actionOutcomes.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
