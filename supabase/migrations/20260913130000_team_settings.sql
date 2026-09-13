create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  monthly_software_cost numeric(14,2) not null default 0 check (monthly_software_cost >= 0),
  default_risk_threshold numeric(14,2) not null default 25000 check (default_risk_threshold >= 0),
  default_confidence_threshold numeric(5,4) not null default 0.85 check (default_confidence_threshold between 0 and 1),
  notify_critical_issues boolean not null default true,
  notify_action_approvals boolean not null default true,
  notify_verification_failures boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (char_length(trim(email)) between 3 and 320),
  role public.organization_role not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint team_invitations_org_email_pending_key unique nulls not distinct (organization_id, email, status)
);

create index team_invitations_organization_idx on public.team_invitations(organization_id, created_at desc);

create trigger organization_settings_set_updated_at before update on public.organization_settings
for each row execute function private.set_updated_at();

alter table public.organization_settings enable row level security;
alter table public.team_invitations enable row level security;

revoke all on table public.organization_settings, public.team_invitations from anon, authenticated;
grant select, insert, update on table public.organization_settings to authenticated;
grant select, insert, update, delete on table public.team_invitations to authenticated;

create policy "members can read organization settings" on public.organization_settings for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "admins can create organization settings" on public.organization_settings for insert
to authenticated with check ((select private.is_org_admin(organization_id)));
create policy "admins can update organization settings" on public.organization_settings for update
to authenticated using ((select private.is_org_admin(organization_id))) with check ((select private.is_org_admin(organization_id)));

create policy "members can read team invitations" on public.team_invitations for select
to authenticated using ((select private.is_org_member(organization_id)));
create policy "admins can create team invitations" on public.team_invitations for insert
to authenticated with check ((select private.is_org_admin(organization_id)));
create policy "admins can update team invitations" on public.team_invitations for update
to authenticated using ((select private.is_org_admin(organization_id))) with check ((select private.is_org_admin(organization_id)));
create policy "admins can remove team invitations" on public.team_invitations for delete
to authenticated using ((select private.is_org_admin(organization_id)));

create policy "members can read coworker profiles" on public.profiles for select
to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
  )
);
