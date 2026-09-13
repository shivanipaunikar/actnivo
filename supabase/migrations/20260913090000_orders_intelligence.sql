alter type public.issue_type add value if not exists 'ORDER_DELAYED';
alter type public.issue_type add value if not exists 'ORDER_STUCK';
alter type public.issue_type add value if not exists 'RTO_RISK';

create type public.order_status as enum ('CREATED','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED','RTO');
create type public.fulfillment_status as enum ('UNFULFILLED','PROCESSING','PARTIALLY_FULFILLED','FULFILLED','DELIVERED','FAILED','RETURNED','RTO');
create type public.payment_method as enum ('PREPAID','COD','OTHER');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_order_id text not null,
  channel public.commerce_channel,
  location_id uuid,
  status public.order_status not null default 'CREATED',
  fulfillment_status public.fulfillment_status not null default 'UNFULFILLED',
  payment_method public.payment_method not null default 'OTHER',
  currency text not null default 'INR',
  order_value numeric(16,2) not null default 0 check (order_value >= 0),
  customer_name text,
  customer_city text,
  order_placed_at timestamptz not null,
  promised_ship_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  source_type text not null default 'file_import',
  source_connection_id uuid,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_id_organization_key unique (id, organization_id),
  constraint orders_org_external_key unique (organization_id, source_type, external_order_id),
  constraint orders_location_fk foreign key (location_id, organization_id) references public.locations(id, organization_id) on delete restrict,
  constraint orders_connection_fk foreign key (source_connection_id, organization_id) references public.connections(id, organization_id) on delete restrict
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  sku_id uuid not null,
  external_line_id text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(16,2) not null default 0 check (unit_price >= 0),
  line_value numeric(16,2) generated always as (quantity * unit_price) stored,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_lines_id_organization_key unique (id, organization_id),
  constraint order_lines_order_fk foreign key (order_id, organization_id) references public.orders(id, organization_id) on delete cascade,
  constraint order_lines_sku_fk foreign key (sku_id, organization_id) references public.skus(id, organization_id) on delete restrict,
  constraint order_lines_source_key unique (organization_id, order_id, external_line_id),
  constraint order_lines_sku_key unique (organization_id, order_id, sku_id)
);

create index orders_org_status_created_idx on public.orders(organization_id, status, order_placed_at desc);
create index orders_org_fulfillment_idx on public.orders(organization_id, fulfillment_status, promised_ship_at);
create index order_lines_org_order_idx on public.order_lines(organization_id, order_id);
create index order_lines_org_sku_idx on public.order_lines(organization_id, sku_id);

create trigger orders_set_updated_at before update on public.orders for each row execute function private.set_updated_at();
create trigger order_lines_set_updated_at before update on public.order_lines for each row execute function private.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
revoke all on table public.orders, public.order_lines from anon, authenticated;
revoke usage on type public.order_status, public.fulfillment_status, public.payment_method from anon;
grant usage on type public.order_status, public.fulfillment_status, public.payment_method to authenticated;
grant select, insert, update on public.orders, public.order_lines to authenticated;

create policy "members read orders" on public.orders for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers create orders" on public.orders for insert to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update orders" on public.orders for update to authenticated using ((select private.can_manage_inventory(organization_id))) with check ((select private.can_manage_inventory(organization_id)));
create policy "members read order lines" on public.order_lines for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers create order lines" on public.order_lines for insert to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update order lines" on public.order_lines for update to authenticated using ((select private.can_manage_inventory(organization_id))) with check ((select private.can_manage_inventory(organization_id)));
