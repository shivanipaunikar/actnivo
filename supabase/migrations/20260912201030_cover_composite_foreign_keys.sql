-- Cover tenant-safe composite foreign keys in their declared column order.
-- This keeps deletes and joins predictable as import history grows.

drop index if exists public.channel_listings_sku_id_idx;
create index channel_listings_sku_id_idx on public.channel_listings(sku_id, organization_id);

drop index if exists public.source_files_import_job_id_idx;
create index source_files_import_job_id_idx on public.source_files(import_job_id, organization_id);

drop index if exists public.sku_mappings_master_sku_id_idx;
create index sku_mappings_master_sku_id_idx on public.sku_mappings(master_sku_id, organization_id);

drop index if exists public.import_rows_import_job_status_idx;
create index import_rows_import_job_status_idx on public.import_rows(import_job_id, organization_id, status);
drop index if exists public.import_rows_sku_mapping_id_idx;
create index import_rows_sku_mapping_id_idx on public.import_rows(sku_mapping_id, organization_id);

drop index if exists public.inventory_snapshots_sku_snapshot_idx;
create index inventory_snapshots_sku_snapshot_idx
  on public.inventory_snapshots(sku_id, organization_id, snapshot_at desc);
drop index if exists public.inventory_snapshots_location_id_idx;
create index inventory_snapshots_location_id_idx
  on public.inventory_snapshots(location_id, organization_id);
drop index if exists public.inventory_snapshots_source_import_id_idx;
create index inventory_snapshots_source_import_id_idx
  on public.inventory_snapshots(source_import_id, organization_id);
create index inventory_snapshots_source_row_org_idx
  on public.inventory_snapshots(source_row_id, organization_id);

drop index if exists public.sales_daily_sku_date_idx;
create index sales_daily_sku_date_idx
  on public.sales_daily(sku_id, organization_id, date desc);
drop index if exists public.sales_daily_location_id_idx;
create index sales_daily_location_id_idx on public.sales_daily(location_id, organization_id);
drop index if exists public.sales_daily_source_import_id_idx;
create index sales_daily_source_import_id_idx on public.sales_daily(source_import_id, organization_id);
create index sales_daily_source_row_org_idx on public.sales_daily(source_row_id, organization_id);
