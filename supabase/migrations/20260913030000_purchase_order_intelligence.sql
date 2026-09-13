alter type public.import_source_type add value if not exists 'purchase_orders';
alter type public.issue_type add value if not exists 'PO_LATE';
alter type public.issue_type add value if not exists 'PO_SHORTAGE';
alter type public.issue_type add value if not exists 'PO_ARRIVES_AFTER_STOCKOUT';
alter type public.issue_type add value if not exists 'PO_PARTIAL_RECEIPT';
alter type public.action_type add value if not exists 'EXPEDITE_PO';

create type public.purchase_order_status as enum (
  'DRAFT', 'OPEN', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'LATE', 'CANCELLED'
);

alter table public.connections
  add constraint connections_id_organization_key unique (id, organization_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_po_number text not null,
  supplier_name text not null,
  supplier_id text,
  channel public.commerce_channel,
  destination_location_id uuid not null,
  status public.purchase_order_status not null default 'OPEN',
  order_date date not null,
  expected_delivery_date date not null,
  actual_delivery_date timestamptz,
  currency text not null default 'INR',
  total_value numeric(16,2),
  source_type text not null,
  source_connection_id uuid,
  source_import_id uuid,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_id_organization_key unique (id, organization_id),
  constraint purchase_orders_org_external_key unique (organization_id, source_type, external_po_number),
  constraint purchase_orders_destination_fk foreign key (destination_location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  constraint purchase_orders_connection_fk foreign key (source_connection_id, organization_id)
    references public.connections(id, organization_id) on delete restrict,
  constraint purchase_orders_import_fk foreign key (source_import_id, organization_id)
    references public.import_jobs(id, organization_id) on delete restrict
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null,
  sku_id uuid not null,
  external_line_id text,
  ordered_quantity integer not null check (ordered_quantity > 0),
  confirmed_quantity integer check (confirmed_quantity is null or confirmed_quantity >= 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  unit_cost numeric(16,2) check (unit_cost is null or unit_cost >= 0),
  expected_delivery_date date,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_order_lines_id_organization_key unique (id, organization_id),
  constraint purchase_order_lines_po_fk foreign key (purchase_order_id, organization_id)
    references public.purchase_orders(id, organization_id) on delete cascade,
  constraint purchase_order_lines_sku_fk foreign key (sku_id, organization_id)
    references public.skus(id, organization_id) on delete restrict,
  constraint purchase_order_lines_source_key unique (organization_id, purchase_order_id, external_line_id),
  constraint purchase_order_lines_sku_key unique (organization_id, purchase_order_id, sku_id),
  constraint purchase_order_lines_quantity_check check (received_quantity <= coalesce(confirmed_quantity, ordered_quantity))
);

create index purchase_orders_org_status_arrival_idx
  on public.purchase_orders(organization_id, status, expected_delivery_date);
create index purchase_order_lines_org_po_idx
  on public.purchase_order_lines(organization_id, purchase_order_id);
create index purchase_order_lines_sku_idx
  on public.purchase_order_lines(organization_id, sku_id);

create trigger purchase_orders_set_updated_at before update on public.purchase_orders
for each row execute function private.set_updated_at();
create trigger purchase_order_lines_set_updated_at before update on public.purchase_order_lines
for each row execute function private.set_updated_at();

create function private.sync_purchase_order_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_po uuid;
  org_id uuid;
  total_lines integer;
  complete_lines integer;
  received_lines integer;
begin
  target_po := coalesce(new.purchase_order_id, old.purchase_order_id);
  org_id := coalesce(new.organization_id, old.organization_id);

  select count(*),
         count(*) filter (where received_quantity >= coalesce(confirmed_quantity, ordered_quantity)),
         count(*) filter (where received_quantity > 0)
    into total_lines, complete_lines, received_lines
  from public.purchase_order_lines
  where purchase_order_id = target_po and organization_id = org_id;

  update public.purchase_orders
  set status = case
    when status = 'CANCELLED' then 'CANCELLED'::public.purchase_order_status
    when total_lines > 0 and complete_lines = total_lines then 'RECEIVED'::public.purchase_order_status
    when received_lines > 0 then 'PARTIALLY_RECEIVED'::public.purchase_order_status
    when expected_delivery_date < current_date then 'LATE'::public.purchase_order_status
    else status
  end,
  actual_delivery_date = case
    when total_lines > 0 and complete_lines = total_lines then coalesce(actual_delivery_date, now())
    else actual_delivery_date
  end
  where id = target_po and organization_id = org_id;
  return coalesce(new, old);
end;
$$;

revoke execute on function private.sync_purchase_order_status() from public, anon, authenticated;
create trigger purchase_order_lines_sync_status_insert_delete
after insert or delete on public.purchase_order_lines
for each row execute function private.sync_purchase_order_status();
create trigger purchase_order_lines_sync_status_update
after update of received_quantity, confirmed_quantity, ordered_quantity, expected_delivery_date on public.purchase_order_lines
for each row execute function private.sync_purchase_order_status();

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

revoke all on table public.purchase_orders, public.purchase_order_lines from anon, authenticated;
revoke usage on type public.purchase_order_status from anon;
grant usage on type public.purchase_order_status to authenticated;
grant select, insert, update on public.purchase_orders to authenticated;
grant select, insert, update on public.purchase_order_lines to authenticated;

create policy "members read purchase orders" on public.purchase_orders for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers create purchase orders" on public.purchase_orders for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update purchase orders" on public.purchase_orders for update to authenticated
using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members read purchase order lines" on public.purchase_order_lines for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers create purchase order lines" on public.purchase_order_lines for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update purchase order lines" on public.purchase_order_lines for update to authenticated
using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));
