create type public.autopilot_workflow as enum (
  'INVENTORY_TRANSFER','REPLENISHMENT','PO_EXPEDITE','ORDER_RECOVERY','RETURN_RECOVERY'
);

create table public.autopilot_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow public.autopilot_workflow not null,
  enabled boolean not null default false,
  minimum_revenue_at_risk numeric(16,2) not null default 25000 check (minimum_revenue_at_risk >= 0),
  minimum_confidence numeric(5,4) not null default 0.85 check (minimum_confidence between 0 and 1),
  daily_action_cap integer not null default 10 check (daily_action_cap between 1 and 1000),
  approval_required boolean not null default true,
  external_execution_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint autopilot_policy_org_workflow_key unique (organization_id, workflow),
  constraint autopilot_external_execution_requires_approval check (external_execution_enabled = false or approval_required = true)
);

create table public.autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  scanned_issues integer not null default 0,
  eligible_issues integer not null default 0,
  prepared_actions integer not null default 0,
  skipped_daily_cap integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index autopilot_policies_org_idx on public.autopilot_policies(organization_id, enabled, workflow);
create index autopilot_runs_org_created_idx on public.autopilot_runs(organization_id, created_at desc);
create trigger autopilot_policies_set_updated_at before update on public.autopilot_policies for each row execute function private.set_updated_at();

alter table public.autopilot_policies enable row level security;
alter table public.autopilot_runs enable row level security;
revoke all on table public.autopilot_policies, public.autopilot_runs from anon, authenticated;
revoke usage on type public.autopilot_workflow from anon;
grant usage on type public.autopilot_workflow to authenticated;
grant select, insert, update on public.autopilot_policies to authenticated;
grant select, insert on public.autopilot_runs to authenticated;

create policy "members read autopilot policies" on public.autopilot_policies for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers create autopilot policies" on public.autopilot_policies for insert to authenticated with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update autopilot policies" on public.autopilot_policies for update to authenticated using ((select private.can_manage_inventory(organization_id))) with check ((select private.can_manage_inventory(organization_id)));
create policy "members read autopilot runs" on public.autopilot_runs for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "managers create autopilot runs" on public.autopilot_runs for insert to authenticated with check ((select private.can_manage_inventory(organization_id)));

create or replace function private.seed_autopilot_policies(org_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.autopilot_policies (organization_id, workflow, enabled, minimum_revenue_at_risk, minimum_confidence, daily_action_cap, approval_required, external_execution_enabled)
  values
    (org_id, 'INVENTORY_TRANSFER', false, 25000, 0.85, 10, true, false),
    (org_id, 'REPLENISHMENT', false, 25000, 0.85, 10, true, false),
    (org_id, 'PO_EXPEDITE', false, 25000, 0.80, 10, true, false),
    (org_id, 'ORDER_RECOVERY', false, 5000, 0.00, 20, true, false),
    (org_id, 'RETURN_RECOVERY', false, 5000, 0.00, 20, true, false)
  on conflict (organization_id, workflow) do nothing;
$$;

select private.seed_autopilot_policies(id) from public.organizations;

create or replace function private.seed_autopilot_policies_after_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.seed_autopilot_policies(new.id);
  return new;
end;
$$;

drop trigger if exists organizations_seed_autopilot_policies on public.organizations;
create trigger organizations_seed_autopilot_policies
after insert on public.organizations
for each row execute function private.seed_autopilot_policies_after_org_insert();
