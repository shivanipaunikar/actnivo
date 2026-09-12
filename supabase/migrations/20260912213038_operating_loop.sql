create type public.issue_type as enum (
  'STOCKOUT_RISK', 'OVERSTOCK', 'INVENTORY_MISMATCH', 'DEMAND_SPIKE', 'DEMAND_DROP'
);
create type public.issue_severity as enum ('critical', 'high', 'medium', 'low');
create type public.issue_status as enum ('open', 'needs_approval', 'running', 'resolved', 'ignored');
create type public.action_type as enum (
  'CREATE_TRANSFER_PLAN', 'CREATE_REPLENISHMENT_PLAN', 'ASSIGN_TASK', 'GENERATE_UPLOAD_FILE'
);
create type public.action_status as enum (
  'CREATED', 'VALIDATED', 'AWAITING_APPROVAL', 'APPROVED', 'EXECUTING',
  'EXECUTED', 'VERIFYING', 'VERIFIED', 'FAILED', 'CANCELLED'
);
create type public.execution_mode as enum ('DIRECT', 'INTEGRATED', 'ASSISTED');
create type public.verification_status as enum ('PENDING', 'VERIFYING', 'SUCCESS', 'FAILED');

create table public.organization_operating_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  replenishment_lead_time_days integer not null default 7 check (replenishment_lead_time_days between 0 and 365),
  safety_days integer not null default 3 check (safety_days between 0 and 365),
  minimum_safety_stock integer not null default 0 check (minimum_safety_stock >= 0),
  target_days_of_cover integer not null default 21 check (target_days_of_cover between 1 and 365),
  minimum_safe_denominator numeric(12,4) not null default 0.1 check (minimum_safe_denominator > 0),
  verification_tolerance_percent numeric(5,2) not null default 10 check (verification_tolerance_percent between 0 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forecast_calculations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku_id uuid not null,
  location_id uuid not null,
  channel public.commerce_channel,
  calculated_at timestamptz not null default now(),
  anchor_date date not null,
  available_quantity integer not null check (available_quantity >= 0),
  seven_day_daily_avg numeric(16,6) not null check (seven_day_daily_avg >= 0),
  fourteen_day_daily_avg numeric(16,6) not null check (fourteen_day_daily_avg >= 0),
  twenty_eight_day_daily_avg numeric(16,6) not null check (twenty_eight_day_daily_avg >= 0),
  weighted_daily_velocity numeric(16,6) not null check (weighted_daily_velocity >= 0),
  days_of_cover numeric(16,4) not null check (days_of_cover >= 0),
  lead_time_days integer not null check (lead_time_days >= 0),
  safety_days integer not null check (safety_days >= 0),
  minimum_safety_stock integer not null check (minimum_safety_stock >= 0),
  minimum_safe_denominator numeric(12,4) not null check (minimum_safe_denominator > 0),
  estimated_shortage_units integer not null check (estimated_shortage_units >= 0),
  estimated_revenue_at_risk numeric(16,2) not null check (estimated_revenue_at_risk >= 0),
  projected_stockout_at timestamptz,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  formula_version text not null default 'stockout-v1',
  inputs jsonb not null default '{}'::jsonb,
  constraint forecast_calculations_id_organization_key unique (id, organization_id),
  constraint forecast_calculations_sku_fk foreign key (sku_id, organization_id)
    references public.skus(id, organization_id) on delete cascade,
  constraint forecast_calculations_location_fk foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete cascade
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type public.issue_type not null,
  severity public.issue_severity not null,
  status public.issue_status not null default 'open',
  sku_id uuid not null,
  location_id uuid,
  channel public.commerce_channel,
  forecast_calculation_id uuid,
  title text not null,
  summary text not null,
  detected_at timestamptz not null default now(),
  days_of_cover numeric(16,4),
  estimated_shortage_units integer,
  estimated_revenue_at_risk numeric(16,2),
  confidence numeric(5,4),
  metadata jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint issues_id_organization_key unique (id, organization_id),
  constraint issues_sku_fk foreign key (sku_id, organization_id)
    references public.skus(id, organization_id) on delete cascade,
  constraint issues_location_fk foreign key (location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  constraint issues_forecast_fk foreign key (forecast_calculation_id, organization_id)
    references public.forecast_calculations(id, organization_id) on delete restrict
);

create unique index issues_one_active_stockout_key
  on public.issues (organization_id, type, sku_id, location_id, channel)
  nulls not distinct
  where status in ('open', 'needs_approval', 'running');

create table public.issue_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_id uuid not null,
  source_location_id uuid,
  destination_location_id uuid not null,
  quantity integer not null check (quantity > 0),
  reason text not null,
  estimated_revenue_protected numeric(16,2) not null check (estimated_revenue_protected >= 0),
  source_coverage_after numeric(16,4),
  destination_coverage_after numeric(16,4) not null check (destination_coverage_after >= 0),
  calculation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issue_recommendations_id_organization_key unique (id, organization_id),
  constraint issue_recommendations_issue_key unique (issue_id),
  constraint issue_recommendations_issue_fk foreign key (issue_id, organization_id)
    references public.issues(id, organization_id) on delete cascade,
  constraint issue_recommendations_source_location_fk foreign key (source_location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict,
  constraint issue_recommendations_destination_location_fk foreign key (destination_location_id, organization_id)
    references public.locations(id, organization_id) on delete restrict
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_id uuid,
  type public.action_type not null,
  status public.action_status not null default 'CREATED',
  requested_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  execution_mode public.execution_mode not null default 'ASSISTED',
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  external_reference text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint actions_id_organization_key unique (id, organization_id),
  constraint actions_issue_fk foreign key (issue_id, organization_id)
    references public.issues(id, organization_id) on delete restrict
);

create table public.action_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_id uuid not null,
  before_state jsonb not null,
  expected_state jsonb not null,
  actual_state jsonb,
  estimated_value_protected numeric(16,2) not null default 0 check (estimated_value_protected >= 0),
  actual_value_protected numeric(16,2) check (actual_value_protected is null or actual_value_protected >= 0),
  success boolean,
  verification_status public.verification_status not null default 'PENDING',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_outcomes_id_organization_key unique (id, organization_id),
  constraint action_outcomes_action_key unique (action_id),
  constraint action_outcomes_action_fk foreign key (action_id, organization_id)
    references public.actions(id, organization_id) on delete cascade
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index forecast_calculations_scope_idx on public.forecast_calculations(organization_id, sku_id, location_id, channel, calculated_at desc);
create index issues_priority_idx on public.issues(organization_id, status, estimated_revenue_at_risk desc);
create index issues_sku_idx on public.issues(sku_id, organization_id);
create index issues_location_idx on public.issues(location_id, organization_id);
create index issue_recommendations_org_idx on public.issue_recommendations(organization_id, issue_id);
create index actions_status_idx on public.actions(organization_id, status, created_at desc);
create index actions_issue_idx on public.actions(issue_id, organization_id);
create index action_outcomes_org_idx on public.action_outcomes(organization_id, verification_status);
create index audit_events_entity_idx on public.audit_events(organization_id, entity_type, entity_id, created_at desc);
create index audit_events_actor_idx on public.audit_events(actor_id);

create trigger organization_operating_settings_set_updated_at before update on public.organization_operating_settings
for each row execute function private.set_updated_at();
create trigger issues_set_updated_at before update on public.issues
for each row execute function private.set_updated_at();
create trigger issue_recommendations_set_updated_at before update on public.issue_recommendations
for each row execute function private.set_updated_at();
create trigger actions_set_updated_at before update on public.actions
for each row execute function private.set_updated_at();
create trigger action_outcomes_set_updated_at before update on public.action_outcomes
for each row execute function private.set_updated_at();

create function private.validate_action_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id or new.idempotency_key <> old.idempotency_key
     or new.issue_id is distinct from old.issue_id or new.requested_by <> old.requested_by then
    raise exception 'Immutable action identity fields cannot be changed';
  end if;
  if old.status <> 'CREATED' and (
    new.type <> old.type or new.execution_mode <> old.execution_mode or new.payload <> old.payload
  ) then
    raise exception 'Validated action instructions cannot be changed';
  end if;
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'CREATED' and new.status in ('VALIDATED', 'CANCELLED', 'FAILED')) or
    (old.status = 'VALIDATED' and new.status in ('AWAITING_APPROVAL', 'CANCELLED', 'FAILED')) or
    (old.status = 'AWAITING_APPROVAL' and new.status in ('APPROVED', 'CANCELLED')) or
    (old.status = 'APPROVED' and new.status in ('EXECUTING', 'CANCELLED', 'FAILED')) or
    (old.status = 'EXECUTING' and new.status in ('EXECUTED', 'FAILED')) or
    (old.status = 'EXECUTED' and new.status in ('VERIFYING', 'FAILED')) or
    (old.status = 'VERIFYING' and new.status in ('VERIFIED', 'FAILED'))
  ) then
    raise exception 'Invalid action transition from % to %', old.status, new.status;
  end if;
  return new;
end;
$$;
revoke execute on function private.validate_action_transition() from public, anon, authenticated;
create trigger actions_validate_transition before update on public.actions
for each row execute function private.validate_action_transition();

alter table public.organization_operating_settings enable row level security;
alter table public.forecast_calculations enable row level security;
alter table public.issues enable row level security;
alter table public.issue_recommendations enable row level security;
alter table public.actions enable row level security;
alter table public.action_outcomes enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.organization_operating_settings, public.forecast_calculations,
  public.issues, public.issue_recommendations, public.actions, public.action_outcomes,
  public.audit_events from anon, authenticated;
grant usage on type public.issue_type, public.issue_severity, public.issue_status,
  public.action_type, public.action_status, public.execution_mode, public.verification_status to authenticated;
revoke usage on type public.issue_type, public.issue_severity, public.issue_status,
  public.action_type, public.action_status, public.execution_mode, public.verification_status from anon;

grant select, insert, update on public.organization_operating_settings to authenticated;
grant select, insert on public.forecast_calculations to authenticated;
grant select, insert, update on public.issues to authenticated;
grant select, insert, update on public.issue_recommendations to authenticated;
grant select, insert, update on public.actions to authenticated;
grant select, insert, update on public.action_outcomes to authenticated;
grant select, insert on public.audit_events to authenticated;

create policy "members read operating settings" on public.organization_operating_settings for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers create operating settings" on public.organization_operating_settings for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)) and updated_by = (select auth.uid()));
create policy "managers update operating settings" on public.organization_operating_settings for update to authenticated
using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)) and updated_by = (select auth.uid()));

create policy "members read forecasts" on public.forecast_calculations for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers create forecasts" on public.forecast_calculations for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)));

create policy "members read issues" on public.issues for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers create issues" on public.issues for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update issues" on public.issues for update to authenticated
using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members read recommendations" on public.issue_recommendations for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers create recommendations" on public.issue_recommendations for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update recommendations" on public.issue_recommendations for update to authenticated
using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members read actions" on public.actions for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers create actions" on public.actions for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)) and requested_by = (select auth.uid()));
create policy "managers update actions" on public.actions for update to authenticated
using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members read outcomes" on public.action_outcomes for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers create outcomes" on public.action_outcomes for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)));
create policy "managers update outcomes" on public.action_outcomes for update to authenticated
using ((select private.can_manage_inventory(organization_id)))
with check ((select private.can_manage_inventory(organization_id)));

create policy "members read audit events" on public.audit_events for select to authenticated
using ((select private.is_org_member(organization_id)));
create policy "managers append audit events" on public.audit_events for insert to authenticated
with check ((select private.can_manage_inventory(organization_id)) and actor_id = (select auth.uid()));
