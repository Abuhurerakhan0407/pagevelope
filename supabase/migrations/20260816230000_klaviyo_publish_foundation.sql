-- Klaviyo OAuth connection metadata and immutable publish receipts.
-- No production credentials are embedded here. OAuth token ciphertext lives only
-- in the private schema and is expected to be written/read by server-side code.

begin;

create type public.integration_provider as enum ('klaviyo');
create type public.integration_status as enum ('connected', 'reauthorization_required', 'revoked');

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'connected',
  external_account_id text not null check (char_length(trim(external_account_id)) between 1 and 200),
  external_account_name text,
  scopes text[] not null default '{}'::text[],
  connected_by uuid not null references auth.users(id) on delete restrict,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider),
  unique (workspace_id, id)
);

create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function private.set_updated_at();

create table private.integration_credentials (
  connection_id uuid primary key references public.integration_connections(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_expires_at timestamptz not null,
  token_type text not null default 'bearer' check (lower(token_type) = 'bearer'),
  updated_at timestamptz not null default now()
);

revoke all on private.integration_credentials from public, anon, authenticated;

create table public.campaign_publish_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id uuid not null,
  release_candidate_id uuid not null,
  connection_id uuid not null,
  provider public.integration_provider not null,
  provider_revision text not null check (provider_revision ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'),
  external_template_id text not null check (char_length(trim(external_template_id)) between 1 and 200),
  external_campaign_id text,
  external_message_id text,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  published_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique (release_candidate_id),
  constraint publish_receipt_campaign_workspace_fk
    foreign key (workspace_id, campaign_id)
    references public.campaigns(workspace_id, id)
    on delete cascade,
  constraint publish_receipt_candidate_workspace_fk
    foreign key (workspace_id, release_candidate_id)
    references public.campaign_release_candidates(workspace_id, id)
    on delete restrict,
  constraint publish_receipt_connection_workspace_fk
    foreign key (workspace_id, connection_id)
    references public.integration_connections(workspace_id, id)
    on delete restrict
);

create index integration_connections_workspace_idx
  on public.integration_connections(workspace_id, provider, status);
create index campaign_publish_receipts_workspace_idx
  on public.campaign_publish_receipts(workspace_id, campaign_id, published_at desc);

alter table public.integration_connections enable row level security;
alter table public.campaign_publish_receipts enable row level security;

create policy integration_connections_select_member
on public.integration_connections for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy campaign_publish_receipts_select_member
on public.campaign_publish_receipts for select
to authenticated
using (private.is_workspace_member(workspace_id));

revoke all on public.integration_connections from anon;
revoke all on public.campaign_publish_receipts from anon;
revoke insert, update, delete on public.integration_connections from authenticated;
revoke insert, update, delete on public.campaign_publish_receipts from authenticated;
grant select on public.integration_connections to authenticated;
grant select on public.campaign_publish_receipts to authenticated;

create or replace function public.record_klaviyo_publish_receipt(
  target_workspace_id uuid,
  target_release_candidate_id uuid,
  target_connection_id uuid,
  provider_revision text,
  external_template_id text,
  external_campaign_id text,
  external_message_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  candidate_campaign_id uuid;
  candidate_version integer;
  candidate_source_sha text;
  candidate_manifest_sha text;
  campaign_current_version integer;
  campaign_status public.campaign_status;
  new_receipt_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if provider_revision !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Provider revision must be a date revision.' using errcode = '22023';
  end if;

  if char_length(trim(external_template_id)) < 1 then
    raise exception 'Klaviyo template id is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.integration_connections ic
    where ic.workspace_id = target_workspace_id
      and ic.id = target_connection_id
      and ic.provider = 'klaviyo'::public.integration_provider
      and ic.status = 'connected'::public.integration_status
  ) then
    raise exception 'Connected Klaviyo account required.' using errcode = '42501';
  end if;

  select rc.campaign_id, rc.version_number, rc.source_sha256, rc.manifest_sha256
    into candidate_campaign_id, candidate_version, candidate_source_sha, candidate_manifest_sha
  from public.campaign_release_candidates rc
  where rc.workspace_id = target_workspace_id
    and rc.id = target_release_candidate_id;

  if candidate_campaign_id is null then
    raise exception 'Release candidate is unavailable.' using errcode = '23503';
  end if;

  select c.current_version_number, c.status
    into campaign_current_version, campaign_status
  from public.campaigns c
  where c.workspace_id = target_workspace_id
    and c.id = candidate_campaign_id
  for update;

  if campaign_current_version is null
     or campaign_current_version <> candidate_version
     or campaign_status <> 'approved'::public.campaign_status then
    raise exception 'Only the current approved campaign version can publish.' using errcode = '40001';
  end if;

  insert into public.campaign_publish_receipts (
    workspace_id, campaign_id, release_candidate_id, connection_id, provider,
    provider_revision, external_template_id, external_campaign_id, external_message_id,
    source_sha256, manifest_sha256, published_by
  ) values (
    target_workspace_id, candidate_campaign_id, target_release_candidate_id,
    target_connection_id, 'klaviyo'::public.integration_provider,
    provider_revision, trim(external_template_id), nullif(trim(external_campaign_id), ''),
    nullif(trim(external_message_id), ''), candidate_source_sha, candidate_manifest_sha, caller_id
  )
  returning id into new_receipt_id;

  update public.campaigns
  set status = 'published'::public.campaign_status,
      updated_by = caller_id,
      updated_at = now()
  where workspace_id = target_workspace_id
    and id = candidate_campaign_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.published.klaviyo',
    'publish_receipt',
    new_receipt_id,
    jsonb_build_object(
      'campaign_id', candidate_campaign_id,
      'release_candidate_id', target_release_candidate_id,
      'connection_id', target_connection_id,
      'provider_revision', provider_revision,
      'external_template_id', trim(external_template_id),
      'external_campaign_id', nullif(trim(external_campaign_id), ''),
      'external_message_id', nullif(trim(external_message_id), ''),
      'source_sha256', candidate_source_sha,
      'manifest_sha256', candidate_manifest_sha
    )
  );

  return new_receipt_id;
exception
  when unique_violation then
    raise exception 'This immutable release candidate already has a publish receipt.' using errcode = '23505';
end;
$$;

revoke all on function public.record_klaviyo_publish_receipt(uuid, uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.record_klaviyo_publish_receipt(uuid, uuid, uuid, text, text, text, text) to authenticated;

commit;
