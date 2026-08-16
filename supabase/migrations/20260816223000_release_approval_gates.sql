-- Immutable release-candidate, inbox-evidence, and approval gates for Pagevelope.
-- Authored/tested against disposable Supabase only. Production application remains human-controlled.

begin;

create type public.inbox_check_status as enum ('pass', 'fail');
create type public.approval_decision as enum ('approved', 'changes_requested');

create table public.campaign_release_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id uuid not null,
  version_number integer not null check (version_number > 0),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  renderer_version text not null check (char_length(trim(renderer_version)) between 1 and 80),
  qa_status text not null check (qa_status in ('PASS', 'WARN')),
  manifest_json jsonb not null check (jsonb_typeof(manifest_json) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (campaign_id, version_number),
  constraint release_candidate_campaign_workspace_fk
    foreign key (workspace_id, campaign_id)
    references public.campaigns(workspace_id, id)
    on delete cascade,
  constraint release_candidate_version_fk
    foreign key (campaign_id, version_number)
    references public.campaign_versions(campaign_id, version_number)
    on delete cascade
);

create table public.inbox_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  release_candidate_id uuid not null,
  client_key text not null check (client_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  provider text not null default 'manual' check (char_length(trim(provider)) between 1 and 80),
  status public.inbox_check_status not null,
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
  notes text check (notes is null or char_length(notes) <= 2000),
  checked_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint inbox_evidence_candidate_workspace_fk
    foreign key (workspace_id, release_candidate_id)
    references public.campaign_release_candidates(workspace_id, id)
    on delete cascade
);

create table public.campaign_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  release_candidate_id uuid not null,
  decision public.approval_decision not null,
  note text check (note is null or char_length(note) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (release_candidate_id, created_by),
  constraint campaign_approvals_candidate_workspace_fk
    foreign key (workspace_id, release_candidate_id)
    references public.campaign_release_candidates(workspace_id, id)
    on delete cascade
);

create index release_candidates_workspace_idx
  on public.campaign_release_candidates(workspace_id, campaign_id, created_at desc);
create index inbox_evidence_candidate_idx
  on public.inbox_evidence(workspace_id, release_candidate_id, client_key, checked_at desc, created_at desc);
create index campaign_approvals_candidate_idx
  on public.campaign_approvals(workspace_id, release_candidate_id, created_at desc);

create or replace function private.can_review_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    private.workspace_role_for(target_workspace_id) in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'reviewer'::public.workspace_role
    ),
    false
  );
$$;

create or replace function public.create_release_candidate(
  target_workspace_id uuid,
  target_campaign_id uuid,
  target_version_number integer,
  source_sha256 text,
  manifest_sha256 text,
  renderer_version text,
  qa_status text,
  manifest_json jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  expected_source_sha text;
  campaign_current_version integer;
  new_candidate_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if target_version_number < 1 then
    raise exception 'Release candidate requires a persisted campaign version.' using errcode = '22023';
  end if;

  if source_sha256 !~ '^[0-9a-f]{64}$' or manifest_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Release fingerprints must be lowercase SHA-256 values.' using errcode = '22023';
  end if;

  if char_length(trim(renderer_version)) < 1 or char_length(trim(renderer_version)) > 80 then
    raise exception 'Renderer version is invalid.' using errcode = '22023';
  end if;

  if qa_status not in ('PASS', 'WARN') then
    raise exception 'Blocking QA cannot become a release candidate.' using errcode = '23514';
  end if;

  if jsonb_typeof(manifest_json) <> 'object' then
    raise exception 'Release manifest must be a JSON object.' using errcode = '22023';
  end if;

  if coalesce(manifest_json #>> '{qa,status}', '') <> qa_status then
    raise exception 'Manifest QA status does not match the release gate.' using errcode = '22023';
  end if;

  select c.current_version_number
    into campaign_current_version
  from public.campaigns c
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id
    and c.status in ('draft'::public.campaign_status, 'review'::public.campaign_status)
  for update;

  if campaign_current_version is null or campaign_current_version <> target_version_number then
    raise exception 'Release candidate must target the current editable campaign version.' using errcode = '40001';
  end if;

  select cv.source_sha256
    into expected_source_sha
  from public.campaign_versions cv
  where cv.workspace_id = target_workspace_id
    and cv.campaign_id = target_campaign_id
    and cv.version_number = target_version_number;

  if expected_source_sha is null or expected_source_sha <> source_sha256 then
    raise exception 'Release candidate source fingerprint does not match the immutable campaign version.' using errcode = '22023';
  end if;

  insert into public.campaign_release_candidates (
    workspace_id, campaign_id, version_number, source_sha256, manifest_sha256,
    renderer_version, qa_status, manifest_json, created_by
  ) values (
    target_workspace_id, target_campaign_id, target_version_number, source_sha256,
    manifest_sha256, trim(renderer_version), qa_status, manifest_json, caller_id
  )
  returning id into new_candidate_id;

  update public.campaigns
  set status = 'review'::public.campaign_status,
      updated_by = caller_id,
      updated_at = now()
  where workspace_id = target_workspace_id
    and id = target_campaign_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.release_candidate.created',
    'release_candidate',
    new_candidate_id,
    jsonb_build_object(
      'campaign_id', target_campaign_id,
      'version_number', target_version_number,
      'source_sha256', source_sha256,
      'manifest_sha256', manifest_sha256,
      'renderer_version', trim(renderer_version),
      'qa_status', qa_status
    )
  );

  return new_candidate_id;
exception
  when unique_violation then
    raise exception 'This immutable campaign version already has a release candidate.' using errcode = '23505';
end;
$$;

create or replace function public.record_inbox_evidence(
  target_workspace_id uuid,
  target_release_candidate_id uuid,
  client_key text,
  provider text,
  check_status public.inbox_check_status,
  evidence_url text,
  notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_client text := lower(trim(client_key));
  clean_provider text := trim(provider);
  clean_url text := nullif(trim(evidence_url), '');
  clean_notes text := nullif(trim(notes), '');
  new_evidence_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_review_workspace(target_workspace_id) then
    raise exception 'Workspace review access required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.campaign_release_candidates rc
    where rc.workspace_id = target_workspace_id
      and rc.id = target_release_candidate_id
  ) then
    raise exception 'Release candidate is unavailable.' using errcode = '42501';
  end if;

  if clean_client !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Inbox client key is invalid.' using errcode = '22023';
  end if;

  if char_length(clean_provider) < 1 or char_length(clean_provider) > 80 then
    raise exception 'Inbox evidence provider is invalid.' using errcode = '22023';
  end if;

  if clean_url is not null and clean_url !~ '^https://' then
    raise exception 'Inbox evidence URL must use HTTPS.' using errcode = '22023';
  end if;

  if clean_notes is not null and char_length(clean_notes) > 2000 then
    raise exception 'Inbox evidence notes are too long.' using errcode = '22023';
  end if;

  insert into public.inbox_evidence (
    workspace_id, release_candidate_id, client_key, provider, status,
    evidence_url, notes, created_by
  ) values (
    target_workspace_id, target_release_candidate_id, clean_client, clean_provider,
    check_status, clean_url, clean_notes, caller_id
  )
  returning id into new_evidence_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.inbox_evidence.recorded',
    'inbox_evidence',
    new_evidence_id,
    jsonb_build_object(
      'release_candidate_id', target_release_candidate_id,
      'client_key', clean_client,
      'provider', clean_provider,
      'status', check_status
    )
  );

  return new_evidence_id;
end;
$$;

create or replace function public.record_campaign_approval(
  target_workspace_id uuid,
  target_release_candidate_id uuid,
  approval_decision public.approval_decision,
  approval_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_note text := nullif(trim(approval_note), '');
  new_approval_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_review_workspace(target_workspace_id) then
    raise exception 'Workspace review access required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.campaign_release_candidates rc
    where rc.workspace_id = target_workspace_id
      and rc.id = target_release_candidate_id
  ) then
    raise exception 'Release candidate is unavailable.' using errcode = '42501';
  end if;

  if clean_note is not null and char_length(clean_note) > 2000 then
    raise exception 'Approval note is too long.' using errcode = '22023';
  end if;

  insert into public.campaign_approvals (
    workspace_id, release_candidate_id, decision, note, created_by
  ) values (
    target_workspace_id, target_release_candidate_id, approval_decision, clean_note, caller_id
  )
  returning id into new_approval_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.approval.recorded',
    'campaign_approval',
    new_approval_id,
    jsonb_build_object(
      'release_candidate_id', target_release_candidate_id,
      'decision', approval_decision
    )
  );

  return new_approval_id;
exception
  when unique_violation then
    raise exception 'A reviewer decision for this release candidate is immutable.' using errcode = '23505';
end;
$$;

create or replace function public.release_candidate_readiness(
  target_workspace_id uuid,
  target_release_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_campaign_id uuid;
  target_version integer;
  campaign_current_version integer;
  qa_status text;
  required_clients text[] := array['gmail-web', 'apple-mail', 'outlook-windows'];
  passed_clients integer := 0;
  approval_count integer := 0;
  changes_requested_count integer := 0;
  is_current boolean := false;
  is_ready boolean := false;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.is_workspace_member(target_workspace_id) then
    raise exception 'Workspace membership required.' using errcode = '42501';
  end if;

  select rc.campaign_id, rc.version_number, rc.qa_status, c.current_version_number
    into target_campaign_id, target_version, qa_status, campaign_current_version
  from public.campaign_release_candidates rc
  join public.campaigns c
    on c.workspace_id = rc.workspace_id
   and c.id = rc.campaign_id
  where rc.workspace_id = target_workspace_id
    and rc.id = target_release_candidate_id;

  if target_campaign_id is null then
    raise exception 'Release candidate is unavailable.' using errcode = '42501';
  end if;

  is_current := campaign_current_version = target_version;

  with latest as (
    select distinct on (ie.client_key)
      ie.client_key,
      ie.status
    from public.inbox_evidence ie
    where ie.workspace_id = target_workspace_id
      and ie.release_candidate_id = target_release_candidate_id
      and ie.client_key = any(required_clients)
    order by ie.client_key, ie.checked_at desc, ie.created_at desc, ie.id desc
  )
  select count(*)::integer
    into passed_clients
  from latest
  where status = 'pass'::public.inbox_check_status;

  select
    count(*) filter (where ca.decision = 'approved'::public.approval_decision)::integer,
    count(*) filter (where ca.decision = 'changes_requested'::public.approval_decision)::integer
    into approval_count, changes_requested_count
  from public.campaign_approvals ca
  where ca.workspace_id = target_workspace_id
    and ca.release_candidate_id = target_release_candidate_id;

  is_ready :=
    qa_status in ('PASS', 'WARN')
    and is_current
    and passed_clients = cardinality(required_clients)
    and approval_count > 0
    and changes_requested_count = 0;

  return jsonb_build_object(
    'ready', is_ready,
    'campaign_id', target_campaign_id,
    'version_number', target_version,
    'current_version', is_current,
    'qa_status', qa_status,
    'required_clients', required_clients,
    'passed_client_count', passed_clients,
    'required_client_count', cardinality(required_clients),
    'approval_count', approval_count,
    'changes_requested_count', changes_requested_count
  );
end;
$$;

create or replace function public.approve_release_candidate(
  target_workspace_id uuid,
  target_release_candidate_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  readiness jsonb;
  target_campaign_id uuid;
  target_version integer;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_review_workspace(target_workspace_id) then
    raise exception 'Workspace review access required.' using errcode = '42501';
  end if;

  readiness := public.release_candidate_readiness(target_workspace_id, target_release_candidate_id);

  if coalesce((readiness ->> 'ready')::boolean, false) is not true then
    raise exception 'Release candidate is not ready for approval.' using errcode = '23514';
  end if;

  target_campaign_id := (readiness ->> 'campaign_id')::uuid;
  target_version := (readiness ->> 'version_number')::integer;

  update public.campaigns c
  set status = 'approved'::public.campaign_status,
      updated_by = caller_id,
      updated_at = now()
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id
    and c.current_version_number = target_version
    and c.status = 'review'::public.campaign_status;

  if not found then
    raise exception 'Campaign changed while approval was being finalized.' using errcode = '40001';
  end if;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.approved',
    'campaign',
    target_campaign_id,
    jsonb_build_object(
      'release_candidate_id', target_release_candidate_id,
      'version_number', target_version
    )
  );

  return true;
end;
$$;

alter table public.campaign_release_candidates enable row level security;
alter table public.inbox_evidence enable row level security;
alter table public.campaign_approvals enable row level security;

create policy release_candidates_select_member
on public.campaign_release_candidates for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy inbox_evidence_select_member
on public.inbox_evidence for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy campaign_approvals_select_member
on public.campaign_approvals for select
to authenticated
using (private.is_workspace_member(workspace_id));

revoke all on public.campaign_release_candidates from anon, authenticated;
revoke all on public.inbox_evidence from anon, authenticated;
revoke all on public.campaign_approvals from anon, authenticated;

grant select on public.campaign_release_candidates to authenticated;
grant select on public.inbox_evidence to authenticated;
grant select on public.campaign_approvals to authenticated;

revoke all on function private.can_review_workspace(uuid) from public, anon;
grant execute on function private.can_review_workspace(uuid) to authenticated;

revoke all on function public.create_release_candidate(uuid, uuid, integer, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_release_candidate(uuid, uuid, integer, text, text, text, text, jsonb) to authenticated;

revoke all on function public.record_inbox_evidence(uuid, uuid, text, text, public.inbox_check_status, text, text) from public, anon;
grant execute on function public.record_inbox_evidence(uuid, uuid, text, text, public.inbox_check_status, text, text) to authenticated;

revoke all on function public.record_campaign_approval(uuid, uuid, public.approval_decision, text) from public, anon;
grant execute on function public.record_campaign_approval(uuid, uuid, public.approval_decision, text) to authenticated;

revoke all on function public.release_candidate_readiness(uuid, uuid) from public, anon;
grant execute on function public.release_candidate_readiness(uuid, uuid) to authenticated;

revoke all on function public.approve_release_candidate(uuid, uuid) from public, anon;
grant execute on function public.approve_release_candidate(uuid, uuid) to authenticated;

commit;
