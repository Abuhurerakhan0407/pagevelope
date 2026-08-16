-- Pagevelope tenant foundation
-- Auth, workspace membership, brand/campaign ownership, immutable versions,
-- private original assets, audit events, and fail-closed row-level security.
--
-- IMPORTANT: authoring this migration does not apply it to production.

begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.workspace_role as enum ('owner', 'admin', 'editor', 'reviewer', 'viewer');
create type public.campaign_status as enum ('draft', 'review', 'approved', 'published', 'archived');
create type public.asset_kind as enum ('original', 'derived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug),
  unique (workspace_id, id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 200),
  status public.campaign_status not null default 'draft',
  schema_version text not null default '1.0.0',
  current_version_number integer not null default 0 check (current_version_number >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint campaigns_brand_workspace_fk
    foreign key (workspace_id, brand_id)
    references public.brands(workspace_id, id)
    on delete restrict
);

create table public.campaign_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id uuid not null,
  version_number integer not null check (version_number > 0),
  source_json jsonb not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (campaign_id, version_number),
  constraint campaign_versions_campaign_workspace_fk
    foreign key (workspace_id, campaign_id)
    references public.campaigns(workspace_id, id)
    on delete cascade
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid,
  kind public.asset_kind not null default 'original',
  object_path text not null check (char_length(trim(object_path)) > 0),
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, object_path),
  constraint assets_brand_workspace_fk
    foreign key (workspace_id, brand_id)
    references public.brands(workspace_id, id)
    on delete restrict
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(trim(action)) between 1 and 120),
  entity_type text not null check (char_length(trim(entity_type)) between 1 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_memberships_user_idx on public.workspace_memberships(user_id, workspace_id);
create index brands_workspace_idx on public.brands(workspace_id);
create index campaigns_workspace_idx on public.campaigns(workspace_id, updated_at desc);
create index campaigns_brand_idx on public.campaigns(workspace_id, brand_id);
create index campaign_versions_workspace_idx on public.campaign_versions(workspace_id, campaign_id, version_number desc);
create index assets_workspace_idx on public.assets(workspace_id, created_at desc);
create index assets_brand_idx on public.assets(workspace_id, brand_id);
create index audit_events_workspace_idx on public.audit_events(workspace_id, created_at desc);
create index audit_events_actor_idx on public.audit_events(actor_user_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function private.set_updated_at();

create trigger brands_set_updated_at
before update on public.brands
for each row execute function private.set_updated_at();

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.workspace_role_for(target_workspace_id uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select wm.role
  from public.workspace_memberships wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_memberships wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
    );
$$;

create or replace function private.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.workspace_role_for(target_workspace_id) in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'editor'::public.workspace_role
    ),
    false
  );
$$;

create or replace function private.can_admin_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.workspace_role_for(target_workspace_id) in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role
    ),
    false
  );
$$;

create or replace function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.workspace_role_for(target_workspace_id) = 'owner'::public.workspace_role,
    false
  );
$$;

create or replace function private.can_bootstrap_workspace_owner(
  target_workspace_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and target_user_id = (select auth.uid())
    and exists (
      select 1
      from public.workspaces w
      where w.id = target_workspace_id
        and w.created_by = (select auth.uid())
    )
    and not exists (
      select 1
      from public.workspace_memberships wm
      where wm.workspace_id = target_workspace_id
    );
$$;

create or replace function private.prevent_last_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_owner_count integer;
begin
  if old.role <> 'owner'::public.workspace_role then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner'::public.workspace_role then
    return new;
  end if;

  select count(*)
    into remaining_owner_count
  from public.workspace_memberships wm
  where wm.workspace_id = old.workspace_id
    and wm.user_id <> old.user_id
    and wm.role = 'owner'::public.workspace_role;

  if remaining_owner_count = 0 then
    raise exception 'A workspace must keep at least one owner.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger workspace_memberships_keep_owner
before update of role or delete on public.workspace_memberships
for each row execute function private.prevent_last_workspace_owner();

create or replace function private.path_workspace_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  segment text;
begin
  segment := split_part(object_name, '/', 1);
  if segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return segment::uuid;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.prevent_last_workspace_owner() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.workspace_role_for(uuid) from public, anon;
revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.can_edit_workspace(uuid) from public, anon;
revoke all on function private.can_admin_workspace(uuid) from public, anon;
revoke all on function private.is_workspace_owner(uuid) from public, anon;
revoke all on function private.can_bootstrap_workspace_owner(uuid, uuid) from public, anon;
revoke all on function private.path_workspace_id(text) from public, anon;

grant execute on function private.workspace_role_for(uuid) to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.can_edit_workspace(uuid) to authenticated;
grant execute on function private.can_admin_workspace(uuid) to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;
grant execute on function private.can_bootstrap_workspace_owner(uuid, uuid) to authenticated;
grant execute on function private.path_workspace_id(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.brands enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_versions enable row level security;
alter table public.assets enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_self
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy workspaces_insert_creator
on public.workspaces for insert
to authenticated
with check ((select auth.uid()) is not null and created_by = (select auth.uid()));

create policy workspaces_select_member_or_bootstrap_creator
on public.workspaces for select
to authenticated
using (
  private.is_workspace_member(id)
  or private.can_bootstrap_workspace_owner(id, (select auth.uid()))
);

create policy workspaces_update_admin
on public.workspaces for update
to authenticated
using (private.can_admin_workspace(id))
with check (private.can_admin_workspace(id));

create policy workspaces_delete_owner
on public.workspaces for delete
to authenticated
using (private.is_workspace_owner(id));

create policy memberships_select_member
on public.workspace_memberships for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy memberships_insert_bootstrap_or_admin
on public.workspace_memberships for insert
to authenticated
with check (
  (
    role = 'owner'::public.workspace_role
    and private.can_bootstrap_workspace_owner(workspace_id, user_id)
  )
  or private.is_workspace_owner(workspace_id)
  or (
    private.workspace_role_for(workspace_id) = 'admin'::public.workspace_role
    and role <> 'owner'::public.workspace_role
  )
);

create policy memberships_update_owner_or_admin
on public.workspace_memberships for update
to authenticated
using (
  private.is_workspace_owner(workspace_id)
  or (
    private.workspace_role_for(workspace_id) = 'admin'::public.workspace_role
    and role <> 'owner'::public.workspace_role
  )
)
with check (
  private.is_workspace_owner(workspace_id)
  or (
    private.workspace_role_for(workspace_id) = 'admin'::public.workspace_role
    and role <> 'owner'::public.workspace_role
  )
);

create policy memberships_delete_owner_or_admin
on public.workspace_memberships for delete
to authenticated
using (
  private.is_workspace_owner(workspace_id)
  or (
    private.workspace_role_for(workspace_id) = 'admin'::public.workspace_role
    and role <> 'owner'::public.workspace_role
  )
);

create policy brands_select_member
on public.brands for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy brands_insert_editor
on public.brands for insert
to authenticated
with check (
  private.can_edit_workspace(workspace_id)
  and created_by = (select auth.uid())
);

create policy brands_update_editor
on public.brands for update
to authenticated
using (private.can_edit_workspace(workspace_id))
with check (private.can_edit_workspace(workspace_id));

create policy brands_delete_admin
on public.brands for delete
to authenticated
using (private.can_admin_workspace(workspace_id));

create policy campaigns_select_member
on public.campaigns for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy campaigns_insert_editor
on public.campaigns for insert
to authenticated
with check (
  private.can_edit_workspace(workspace_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy campaigns_update_editor
on public.campaigns for update
to authenticated
using (private.can_edit_workspace(workspace_id))
with check (
  private.can_edit_workspace(workspace_id)
  and updated_by = (select auth.uid())
);

create policy campaigns_delete_admin
on public.campaigns for delete
to authenticated
using (private.can_admin_workspace(workspace_id));

create policy campaign_versions_select_member
on public.campaign_versions for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy campaign_versions_insert_editor
on public.campaign_versions for insert
to authenticated
with check (
  private.can_edit_workspace(workspace_id)
  and created_by = (select auth.uid())
);

create policy assets_select_member
on public.assets for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy assets_insert_editor
on public.assets for insert
to authenticated
with check (
  private.can_edit_workspace(workspace_id)
  and created_by = (select auth.uid())
);

create policy assets_delete_admin
on public.assets for delete
to authenticated
using (private.can_admin_workspace(workspace_id));

create policy audit_events_select_admin
on public.audit_events for select
to authenticated
using (private.can_admin_workspace(workspace_id));

create policy audit_events_insert_member
on public.audit_events for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and actor_user_id = (select auth.uid())
);

revoke all on public.profiles from anon;
revoke all on public.workspaces from anon;
revoke all on public.workspace_memberships from anon;
revoke all on public.brands from anon;
revoke all on public.campaigns from anon;
revoke all on public.campaign_versions from anon;
revoke all on public.assets from anon;
revoke all on public.audit_events from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, delete on public.workspace_memberships to authenticated;
grant update (role) on public.workspace_memberships to authenticated;
grant select, insert, update, delete on public.brands to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert on public.campaign_versions to authenticated;
grant select, insert, delete on public.assets to authenticated;
grant select, insert on public.audit_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pagevelope-originals',
  'pagevelope-originals',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy pagevelope_originals_select_member
on storage.objects for select
to authenticated
using (
  bucket_id = 'pagevelope-originals'
  and private.is_workspace_member(private.path_workspace_id(name))
);

create policy pagevelope_originals_insert_editor
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pagevelope-originals'
  and private.can_edit_workspace(private.path_workspace_id(name))
);

create policy pagevelope_originals_delete_admin
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pagevelope-originals'
  and private.can_admin_workspace(private.path_workspace_id(name))
);

commit;
