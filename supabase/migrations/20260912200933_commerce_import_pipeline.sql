create type public.connection_status as enum (
  'pending',
  'connected',
  'disconnected',
  'error'
);

create type public.import_source_type as enum ('inventory', 'sales');

create type public.import_job_status as enum (
  'uploaded',
  'mapping_required',
  'processing',
  'completed',
  'failed'
);

create type public.location_type as enum (
  'warehouse',
  'marketplace_fc',
  'dark_store',
  'store',
  '3pl',
  'other'
);

create type public.listing_status as enum ('active', 'inactive', 'suppressed');

create type public.sku_mapping_status as enum (
  'mapped',
  'suggested',
  'conflict',
  'unmapped'
);

create type public.sku_match_method as enum (
  'barcode',
  'exact_sku',
  'normalized_sku',
  'product_similarity',
  'manual',
  'new_master',
  'none'
);

create type public.import_row_status as enum (
  'staged',
  'valid',
  'invalid',
  'duplicate',
  'pending_sku_mapping',
  'imported'
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (char_length(trim(provider)) between 1 and 80),
  connection_type text not null check (char_length(trim(connection_type)) between 1 and 40),
  status public.connection_status not null default 'pending',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_org_provider_type_key unique (organization_id, provider, connection_type)
);

create index connections_organization_id_idx on public.connections(organization_id);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type public.import_source_type not null,
  filename text not null,
  storage_path text not null,
  status public.import_job_status not null default 'uploaded',
  total_rows integer not null default 0 check (total_rows >= 0),
  successful_rows integer not null default 0 check (successful_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  error_summary text,
  column_mapping jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint import_jobs_id_organization_key unique (id, organization_id)
);

create index import_jobs_organization_created_idx
  on public.import_jobs(organization_id, created_at desc);
create index import_jobs_created_by_idx on public.import_jobs(created_by);

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_job_id uuid not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  constraint source_files_import_job_fk foreign key (import_job_id, organization_id)
    references public.import_jobs(id, organization_id) on delete cascade,
  constraint source_files_organization_checksum_key unique (organization_id, checksum)
);

create index source_files_organization_id_idx on public.source_files(organization_id);
create index source_files_import_job_id_idx on public.source_files(import_job_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  type public.location_type not null default 'warehouse',
  city text,
  state text,
  country text not null default 'India',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_id_organization_key unique (id, organization_id),
  constraint locations_organization_name_type_key unique (organization_id, name, type)
);

create index locations_organization_id_idx on public.locations(organization_id);

create table public.skus (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  master_sku text not null check (char_length(trim(master_sku)) between 1 and 120),
  product_name text not null check (char_length(trim(product_name)) between 1 and 240),
  brand text,
  category text,
  variant text,
  barcode text,
  mrp numeric(14,2) not null default 0 check (mrp >= 0),
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  cost_price numeric(14,2) check (cost_price is null or cost_price >= 0),
  pack_size text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skus_id_organization_key unique (id, organization_id),
  constraint skus_organization_master_sku_key unique (organization_id, master_sku)
);

create index skus_organization_id_idx on public.skus(organization_id);
create index skus_organization_product_name_idx on public.skus(organization_id, product_name);
create unique index skus_organization_barcode_key
  on public.skus(organization_id, barcode) where barcode is not null;

create table public.channel_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku_id uuid not null,
  channel public.commerce_channel not null,
  external_sku text not null,
  external_product_id text,
  listing_name text,
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channel_listings_sku_fk foreign key (sku_id, organization_id)
    references public.skus(id, organization_id) on delete cascade,
  constraint channel_listings_organization_channel_sku_key
    unique (organization_id, channel, external_sku)
);

create index channel_listings_organization_id_idx on public.channel_listings(organization_id);
create index channel_listings_sku_id_idx on public.channel_listings(sku_id);

create table public.sku_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type public.import_source_type not null,
  source_sku text not null,
  source_barcode text,
  source_product_name text,
  source_variant text,
  source_pack_size text,
  master_sku_id uuid,
  status public.sku_mapping_status not null default 'unmapped',
  match_method public.sku_match_method not null default 'none',
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sku_mappings_master_sku_fk foreign key (master_sku_id, organization_id)
    references public.skus(id, organization_id) on delete set null (master_sku_id),
  constraint sku_mappings_id_organization_key unique (id, organization_id),
  constraint sku_mappings_organization_source_key unique (organization_id, source_type, source_sku)
);

create index sku_mappings_organization_status_idx
  on public.sku_mappings(organization_id, status);
create index sku_mappings_master_sku_id_idx on public.sku_mappings(master_sku_id);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_job_id uuid not null,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null,
  normalized_data jsonb,
  validation_errors text[] not null default '{}',
  row_hash text not null check (row_hash ~ '^[a-f0-9]{64}$'),
  status public.import_row_status not null default 'staged',
  sku_mapping_id uuid,
  created_at timestamptz not null default now(),
  constraint import_rows_import_job_fk foreign key (import_job_id, organization_id)
    references public.import_jobs(id, organization_id) on delete cascade,
  constraint import_rows_sku_mapping_fk foreign key (sku_mapping_id, organization_id)
    references public.sku_mappings(id, organization_id) on delete set null (sku_mapping_id),
  constraint import_rows_id_organization_key unique (id, organization_id),
  constraint import_rows_import_row_key unique (import_job_id, row_number)
);

create index import_rows_organization_id_idx on public.import_rows(organization_id);
create index import_rows_import_job_status_idx on public.import_rows(import_job_id, status);
create index import_rows_sku_mapping_id_idx on public.import_rows(sku_mapping_id);

create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku_id uuid not null,
  location_id uuid not null,
  channel public.commerce_channel,
  available_quantity integer not null check (available_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  inbound_quantity integer not null default 0 check (inbound_quantity >= 0),
  snapshot_at timestamptz not null,
  source_import_id uuid,
  source_row_id uuid,
  created_at timestamptz not null default now(),
  constraint inventory_snapshots_sku_fk foreign key (sku_id, organization_id)
    references public.skus(id, organization_id) on delete restrict,
  constraint inventory_snapshots_location_fk foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  constraint inventory_snapshots_import_fk foreign key (source_import_id, organization_id)
    references public.import_jobs(id, organization_id) on delete restrict,
  constraint inventory_snapshots_source_row_fk foreign key (source_row_id, organization_id)
    references public.import_rows(id, organization_id) on delete restrict
);

create index inventory_snapshots_organization_snapshot_idx
  on public.inventory_snapshots(organization_id, snapshot_at desc);
create index inventory_snapshots_sku_snapshot_idx
  on public.inventory_snapshots(sku_id, snapshot_at desc);
create index inventory_snapshots_location_id_idx on public.inventory_snapshots(location_id);
create index inventory_snapshots_source_import_id_idx on public.inventory_snapshots(source_import_id);
create unique index inventory_snapshots_source_row_key
  on public.inventory_snapshots(source_row_id) where source_row_id is not null;

create table public.sales_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku_id uuid not null,
  location_id uuid,
  channel public.commerce_channel not null,
  date date not null,
  units_sold integer not null check (units_sold >= 0),
  gross_sales numeric(14,2) not null check (gross_sales >= 0),
  net_sales numeric(14,2) check (net_sales is null or net_sales >= 0),
  source_import_id uuid,
  source_row_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_daily_sku_fk foreign key (sku_id, organization_id)
    references public.skus(id, organization_id) on delete restrict,
  constraint sales_daily_location_fk foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  constraint sales_daily_import_fk foreign key (source_import_id, organization_id)
    references public.import_jobs(id, organization_id) on delete restrict,
  constraint sales_daily_source_row_fk foreign key (source_row_id, organization_id)
    references public.import_rows(id, organization_id) on delete restrict,
  constraint sales_daily_unique_record unique nulls not distinct
    (organization_id, sku_id, location_id, channel, date)
);

create index sales_daily_organization_date_idx on public.sales_daily(organization_id, date desc);
create index sales_daily_sku_date_idx on public.sales_daily(sku_id, date desc);
create index sales_daily_location_id_idx on public.sales_daily(location_id);
create index sales_daily_source_import_id_idx on public.sales_daily(source_import_id);
create unique index sales_daily_source_row_key
  on public.sales_daily(source_row_id) where source_row_id is not null;

create trigger connections_set_updated_at before update on public.connections
for each row execute function private.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
for each row execute function private.set_updated_at();
create trigger skus_set_updated_at before update on public.skus
for each row execute function private.set_updated_at();
create trigger channel_listings_set_updated_at before update on public.channel_listings
for each row execute function private.set_updated_at();
create trigger sku_mappings_set_updated_at before update on public.sku_mappings
for each row execute function private.set_updated_at();
create trigger sales_daily_set_updated_at before update on public.sales_daily
for each row execute function private.set_updated_at();

create function private.can_manage_inventory(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin', 'ops_manager', 'inventory_manager')
  );
$$;

revoke execute on function private.can_manage_inventory(uuid) from public, anon;
grant execute on function private.can_manage_inventory(uuid) to authenticated;

alter table public.connections enable row level security;
alter table public.import_jobs enable row level security;
alter table public.source_files enable row level security;
alter table public.locations enable row level security;
alter table public.skus enable row level security;
alter table public.channel_listings enable row level security;
alter table public.sku_mappings enable row level security;
alter table public.import_rows enable row level security;
alter table public.inventory_snapshots enable row level security;
alter table public.sales_daily enable row level security;

revoke all on table public.connections, public.import_jobs, public.source_files,
  public.locations, public.skus, public.channel_listings, public.sku_mappings,
  public.import_rows, public.inventory_snapshots, public.sales_daily
from anon, authenticated;

revoke usage on type public.connection_status, public.import_source_type,
  public.import_job_status, public.location_type, public.listing_status,
  public.sku_mapping_status, public.sku_match_method, public.import_row_status
from anon;
grant usage on type public.connection_status, public.import_source_type,
  public.import_job_status, public.location_type, public.listing_status,
  public.sku_mapping_status, public.sku_match_method, public.import_row_status
to authenticated;

grant select, insert, update on table public.connections to authenticated;
grant select, insert, update on table public.import_jobs to authenticated;
grant select, insert on table public.source_files to authenticated;
grant select, insert, update on table public.locations to authenticated;
grant select, insert, update on table public.skus to authenticated;
grant select, insert, update on table public.channel_listings to authenticated;
grant select, insert, update on table public.sku_mappings to authenticated;
grant select, insert, update on table public.import_rows to authenticated;
grant select, insert on table public.inventory_snapshots to authenticated;
grant select, insert, update on table public.sales_daily to authenticated;

create policy "members can read connections" on public.connections for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create connections" on public.connections for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers can update connections" on public.connections for update
to authenticated using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read import jobs" on public.import_jobs for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create import jobs" on public.import_jobs for insert
to authenticated with check (
  (select private.can_manage_inventory(organization_id))
  and created_by = (select auth.uid())
);
create policy "managers can update import jobs" on public.import_jobs for update
to authenticated using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read source files" on public.source_files for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create source files" on public.source_files for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read locations" on public.locations for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create locations" on public.locations for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers can update locations" on public.locations for update
to authenticated using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read skus" on public.skus for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create skus" on public.skus for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers can update skus" on public.skus for update
to authenticated using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read channel listings" on public.channel_listings for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create channel listings" on public.channel_listings for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers can update channel listings" on public.channel_listings for update
to authenticated using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read sku mappings" on public.sku_mappings for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create sku mappings" on public.sku_mappings for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers can update sku mappings" on public.sku_mappings for update
to authenticated using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read import rows" on public.import_rows for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create import rows" on public.import_rows for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers can update import rows" on public.import_rows for update
to authenticated using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read inventory snapshots" on public.inventory_snapshots for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can append inventory snapshots" on public.inventory_snapshots for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));

create policy "members can read daily sales" on public.sales_daily for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers can create daily sales" on public.sales_daily for insert
to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers can update daily sales" on public.sales_daily for update
to authenticated using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commerce-imports',
  'commerce-imports',
  false,
  10485760,
  array['text/csv', 'application/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "members can read commerce imports" on storage.objects for select
to authenticated using (
  bucket_id = 'commerce-imports'
  and (select private.is_org_member(private.storage_organization_id(name)))
);

create policy "managers can upload commerce imports" on storage.objects for insert
to authenticated with check (
  bucket_id = 'commerce-imports'
  and (select private.can_manage_inventory(private.storage_organization_id(name)))
);

create policy "managers can update commerce imports" on storage.objects for update
to authenticated using (
  bucket_id = 'commerce-imports'
  and (select private.can_manage_inventory(private.storage_organization_id(name)))
)
with check (
  bucket_id = 'commerce-imports'
  and (select private.can_manage_inventory(private.storage_organization_id(name)))
);

create policy "managers can delete commerce imports" on storage.objects for delete
to authenticated using (
  bucket_id = 'commerce-imports'
  and (select private.can_manage_inventory(private.storage_organization_id(name)))
);
