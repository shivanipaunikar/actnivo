alter type public.issue_type add value if not exists 'RETURN_STUCK';
alter type public.issue_type add value if not exists 'REFUND_DELAYED';
alter type public.issue_type add value if not exists 'RETURN_RECEIPT_DELAYED';
alter type public.action_type add value if not exists 'CREATE_RETURN_RECOVERY_TASK';

create type public.return_kind as enum ('RETURN','RTO');
create type public.return_status as enum (
  'REQUESTED','APPROVED','PICKUP_PENDING','PICKED_UP','IN_TRANSIT','RECEIVED','REFUND_PENDING','REFUNDED','CLOSED','CANCELLED'
);

create table public.returns_rto (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_return_id text not null,
  order_id uuid not null,
  kind public.return_kind not null,
  status public.return_status not null default 'REQUESTED',
  reason text,
  currency text not null default 'INR',
  refund_amount numeric(16,2) not null default 0 check (refund_amount >= 0),
  reverse_logistics_cost numeric(16,2) not null default 0 check (reverse_logistics_cost >= 0),
  requested_at timestamptz not null,
  approved_at timestamptz,
  picked_up_at timestamptz,
  received_at timestamptz,
  refund_due_at timestamptz,
  refunded_at timestamptz,
  source_type text not null default 'file_import',
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint returns_rto_id_organization_key unique (id, organization_id),
  constraint returns_rto_source_key unique (organization_id, source_type, external_return_id),
  constraint returns_rto_order_fk foreign key (order_id, organization_id) references public.orders(id, organization_id) on delete cascade
);

create table public.return_rto_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null,
  sku_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_value numeric(16,2) not null default 0 check (unit_value >= 0),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint return_rto_lines_id_organization_key unique (id, organization_id),
  constraint return_rto_lines_return_fk foreign key (return_id, organization_id) references public.returns_rto(id, organization_id) on delete cascade,
  constraint return_rto_lines_sku_fk foreign key (sku_id, organization_id) references public.skus(id, organization_id) on delete restrict,
  constraint return_rto_lines_sku_key unique (organization_id, return_id, sku_id)
);

alter table public.issues add column if not exists return_id uuid;
alter table public.issues add constraint issues_return_fk foreign key (return_id, organization_id)
  references public.returns_rto(id, organization_id) on delete cascade;

create index returns_rto_org_status_idx on public.returns_rto(organization_id, status, requested_at desc);
create index returns_rto_org_order_idx on public.returns_rto(organization_id, order_id);
create index return_rto_lines_org_return_idx on public.return_rto_lines(organization_id, return_id);
create index return_rto_lines_org_sku_idx on public.return_rto_lines(organization_id, sku_id);
create index issues_return_idx on public.issues(return_id, organization_id);
create unique index issues_one_active_return_key on public.issues(organization_id, type, return_id)
  where return_id is not null and status in ('open','needs_approval','running');

create trigger returns_rto_set_updated_at before update on public.returns_rto for each row execute function private.set_updated_at();
create trigger return_rto_lines_set_updated_at before update on public.return_rto_lines for each row execute function private.set_updated_at();

alter table public.returns_rto enable row level security;
alter table public.return_rto_lines enable row level security;
revoke all on table public.returns_rto, public.return_rto_lines from anon, authenticated;
revoke usage on type public.return_kind, public.return_status from anon;
grant usage on type public.return_kind, public.return_status to authenticated;
grant select, insert, update on public.returns_rto, public.return_rto_lines to authenticated;

create policy "members read returns rto" on public.returns_rto for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers create returns rto" on public.returns_rto for insert to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update returns rto" on public.returns_rto for update to authenticated using ((select private.can_manage_inventory(organization_id))) with check ((select private.can_manage_inventory(organization_id)));
create policy "members read return rto lines" on public.return_rto_lines for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers create return rto lines" on public.return_rto_lines for insert to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update return rto lines" on public.return_rto_lines for update to authenticated using ((select private.can_manage_inventory(organization_id))) with check ((select private.can_manage_inventory(organization_id)));
