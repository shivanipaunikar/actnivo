create extension if not exists pgcrypto;

create type public.organization_role as enum (
  'owner',
  'admin',
  'ops_manager',
  'inventory_manager',
  'finance',
  'viewer'
);

create type public.commerce_channel as enum (
  'shopify',
  'amazon',
  'flipkart',
  'meesho',
  'blinkit',
  'zepto',
  'swiggy_instamart',
  'woocommerce',
  'unicommerce',
  'easyecom',
  'other'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  website text,
  country text not null,
  timezone text not null,
  currency text not null default 'INR',
  monthly_order_volume integer check (monthly_order_volume is null or monthly_order_volume >= 0),
  sku_count integer check (sku_count is null or sku_count >= 0),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_created_by_idx
  on public.organizations(created_by);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default now(),
  constraint organization_members_org_user_key unique (organization_id, user_id)
);

create index organization_members_user_id_idx
  on public.organization_members(user_id);
create index organization_members_organization_id_idx
  on public.organization_members(organization_id);

create table public.organization_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel public.commerce_channel not null,
  custom_name text,
  created_at timestamptz not null default now(),
  constraint organization_channels_org_channel_key unique (organization_id, channel),
  constraint organization_channels_other_name_check check (
    (channel = 'other' and nullif(trim(custom_name), '') is not null)
    or (channel <> 'other' and custom_name is null)
  )
);

create index organization_channels_organization_id_idx
  on public.organization_channels(organization_id);

create schema if not exists private;
revoke all on schema private from public;

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function private.handle_new_user();

create function private.is_org_member(target_organization_id uuid)
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
  );
$$;

create function private.is_org_admin(target_organization_id uuid)
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
      and membership.role in ('owner', 'admin')
  );
$$;

create function private.organization_has_members(target_organization_id uuid)
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
  );
$$;

create function private.can_claim_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations organization
    where organization.id = target_organization_id
      and organization.created_by = (select auth.uid())
  )
  and not (select private.organization_has_members(target_organization_id));
$$;

revoke execute on function private.is_org_member(uuid) from public, anon;
revoke execute on function private.is_org_admin(uuid) from public, anon;
revoke execute on function private.organization_has_members(uuid) from public, anon;
revoke execute on function private.can_claim_organization(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.organization_has_members(uuid) to authenticated;
grant execute on function private.can_claim_organization(uuid) to authenticated;

create function private.storage_organization_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  organization_segment text;
begin
  organization_segment := (storage.foldername(object_name))[1];
  return organization_segment::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke execute on function private.storage_organization_id(text) from public, anon;
grant execute on function private.storage_organization_id(text) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_channels enable row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.organization_channels from anon, authenticated;

grant select, insert, update on table public.organizations to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;
grant select, insert, update, delete on table public.organization_channels to authenticated;

create policy "members can read organizations"
on public.organizations for select
to authenticated
using ((select private.is_org_member(id)));

create policy "authenticated users can create organizations"
on public.organizations for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "admins can update organizations"
on public.organizations for update
to authenticated
using ((select private.is_org_admin(id)))
with check ((select private.is_org_admin(id)));

create policy "users can read their profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "users can update their profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "members can read organization memberships"
on public.organization_members for select
to authenticated
using ((select private.is_org_member(organization_id)));

create policy "admins can add organization members"
on public.organization_members for insert
to authenticated
with check (
  (select private.is_org_admin(organization_id))
  or (
    user_id = (select auth.uid())
    and role = 'owner'
    and (select private.can_claim_organization(organization_id))
  )
);

create policy "admins can update organization members"
on public.organization_members for update
to authenticated
using ((select private.is_org_admin(organization_id)))
with check ((select private.is_org_admin(organization_id)));

create policy "admins can remove organization members"
on public.organization_members for delete
to authenticated
using ((select private.is_org_admin(organization_id)));

create policy "members can read organization channels"
on public.organization_channels for select
to authenticated
using ((select private.is_org_member(organization_id)));

create policy "admins can add organization channels"
on public.organization_channels for insert
to authenticated
with check ((select private.is_org_admin(organization_id)));

create policy "admins can update organization channels"
on public.organization_channels for update
to authenticated
using ((select private.is_org_admin(organization_id)))
with check ((select private.is_org_admin(organization_id)));

create policy "admins can remove organization channels"
on public.organization_channels for delete
to authenticated
using ((select private.is_org_admin(organization_id)));

insert into storage.buckets (id, name, public)
values ('organization-assets', 'organization-assets', false)
on conflict (id) do nothing;

create policy "members can read organization assets"
on storage.objects for select
to authenticated
using (
  bucket_id = 'organization-assets'
  and (select private.is_org_member(private.storage_organization_id(name)))
);

create policy "members can upload organization assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'organization-assets'
  and (select private.is_org_member(private.storage_organization_id(name)))
);

create policy "members can update organization assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'organization-assets'
  and (select private.is_org_member(private.storage_organization_id(name)))
)
with check (
  bucket_id = 'organization-assets'
  and (select private.is_org_member(private.storage_organization_id(name)))
);

create policy "members can delete organization assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'organization-assets'
  and (select private.is_org_member(private.storage_organization_id(name)))
);
