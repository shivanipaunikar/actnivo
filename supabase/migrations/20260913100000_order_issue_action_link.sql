alter type public.action_type add value if not exists 'CREATE_ORDER_RECOVERY_TASK';

alter table public.issues alter column sku_id drop not null;
alter table public.issues add column if not exists order_id uuid;
alter table public.issues add constraint issues_order_fk foreign key (order_id, organization_id)
  references public.orders(id, organization_id) on delete cascade;

create index if not exists issues_order_idx on public.issues(order_id, organization_id);
create unique index if not exists issues_one_active_order_key
  on public.issues (organization_id, type, order_id)
  where order_id is not null and status in ('open', 'needs_approval', 'running');
