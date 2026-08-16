-- Single-recipient test delivery boundary for release candidates.
-- Production credentials are never stored here; provider calls happen server-side.

begin;

create type public.test_send_status as enum ('queued', 'sent', 'failed');

create table public.campaign_test_sends (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  release_candidate_id uuid not null,
  recipient_email text not null check (
    char_length(recipient_email) between 3 and 320
    and recipient_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text check (
    provider_message_id is null
    or char_length(trim(provider_message_id)) between 1 and 200
  ),
  status public.test_send_status not null default 'queued',
  failure_code text check (
    failure_code is null
    or failure_code ~ '^[a-z0-9_:-]{1,120}$'
  ),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, id),
  constraint campaign_test_sends_candidate_workspace_fk
    foreign key (workspace_id, release_candidate_id)
    references public.campaign_release_candidates(workspace_id, id)
    on delete cascade,
  constraint campaign_test_sends_terminal_state_check
    check (
      (status = 'queued'::public.test_send_status and completed_at is null and provider_message_id is null)
      or (status = 'sent'::public.test_send_status and completed_at is not null and provider_message_id is not null and failure_code is null)
      or (status = 'failed'::public.test_send_status and completed_at is not null and provider_message_id is null)
    )
);

create index campaign_test_sends_candidate_idx
  on public.campaign_test_sends(workspace_id, release_candidate_id, created_at desc);
create index campaign_test_sends_actor_rate_idx
  on public.campaign_test_sends(workspace_id, release_candidate_id, created_by, created_at desc);

alter table public.campaign_test_sends enable row level security;

create policy campaign_test_sends_select_member
on public.campaign_test_sends for select
to authenticated
using (private.is_workspace_member(workspace_id));

revoke all on public.campaign_test_sends from anon, authenticated;
grant select on public.campaign_test_sends to authenticated;

create or replace function private.release_candidate_inbox_passed(
  target_workspace_id uuid,
  target_release_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with required(client_key) as (
    values ('gmail-web'::text), ('apple-mail'::text), ('outlook-windows'::text)
  ),
  latest as (
    select distinct on (ie.client_key)
      ie.client_key,
      ie.status,
      ie.evidence_url
    from public.inbox_evidence ie
    where ie.workspace_id = target_workspace_id
      and ie.release_candidate_id = target_release_candidate_id
      and ie.client_key in ('gmail-web', 'apple-mail', 'outlook-windows')
    order by ie.client_key, ie.checked_at desc, ie.created_at desc, ie.id desc
  )
  select count(*) = 3
    and bool_and(latest.status = 'pass'::public.inbox_check_status)
    and bool_and(latest.evidence_url is not null)
  from required
  join latest using (client_key);
$$;

create or replace function public.create_test_send_attempt(
  target_workspace_id uuid,
  target_release_candidate_id uuid,
  target_recipient_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_email text := lower(trim(target_recipient_email));
  candidate_version integer;
  current_version integer;
  campaign_status public.campaign_status;
  recent_count integer;
  new_attempt_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if char_length(clean_email) not between 3 and 320
     or clean_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Test recipient email is invalid.' using errcode = '22023';
  end if;

  select rc.version_number, c.current_version_number, c.status
    into candidate_version, current_version, campaign_status
  from public.campaign_release_candidates rc
  join public.campaigns c
    on c.workspace_id = rc.workspace_id
   and c.id = rc.campaign_id
  where rc.workspace_id = target_workspace_id
    and rc.id = target_release_candidate_id
  for update of c;

  if candidate_version is null then
    raise exception 'Release candidate is unavailable.' using errcode = '42501';
  end if;

  if candidate_version <> current_version then
    raise exception 'Release candidate is stale.' using errcode = '40001';
  end if;

  if campaign_status not in ('review'::public.campaign_status, 'approved'::public.campaign_status) then
    raise exception 'Campaign is not in release review.' using errcode = '23514';
  end if;

  if not private.release_candidate_inbox_passed(target_workspace_id, target_release_candidate_id) then
    raise exception 'Required inbox evidence must pass before a test send.' using errcode = '23514';
  end if;

  select count(*)::integer into recent_count
  from public.campaign_test_sends ts
  where ts.workspace_id = target_workspace_id
    and ts.release_candidate_id = target_release_candidate_id
    and ts.created_by = caller_id
    and ts.created_at >= now() - interval '10 minutes';

  if recent_count >= 5 then
    raise exception 'Test send rate limit reached. Try again later.' using errcode = '54000';
  end if;

  insert into public.campaign_test_sends (
    workspace_id, release_candidate_id, recipient_email, provider, created_by
  ) values (
    target_workspace_id, target_release_candidate_id, clean_email, 'resend', caller_id
  )
  returning id into new_attempt_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.test_send.queued',
    'test_send',
    new_attempt_id,
    jsonb_build_object(
      'release_candidate_id', target_release_candidate_id,
      'recipient_email', clean_email,
      'provider', 'resend'
    )
  );

  return new_attempt_id;
end;
$$;

create or replace function public.complete_test_send_attempt(
  target_workspace_id uuid,
  target_attempt_id uuid,
  terminal_status public.test_send_status,
  target_provider_message_id text,
  target_failure_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_message_id text := nullif(trim(target_provider_message_id), '');
  clean_failure_code text := nullif(lower(trim(target_failure_code)), '');
  candidate_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if terminal_status not in ('sent'::public.test_send_status, 'failed'::public.test_send_status) then
    raise exception 'Test send completion must be terminal.' using errcode = '22023';
  end if;

  if terminal_status = 'sent'::public.test_send_status and clean_message_id is null then
    raise exception 'Sent test delivery requires a provider message id.' using errcode = '22023';
  end if;

  if terminal_status = 'failed'::public.test_send_status and clean_message_id is not null then
    raise exception 'Failed test delivery cannot claim a provider message id.' using errcode = '22023';
  end if;

  if clean_failure_code is not null and clean_failure_code !~ '^[a-z0-9_:-]{1,120}$' then
    raise exception 'Test send failure code is invalid.' using errcode = '22023';
  end if;

  update public.campaign_test_sends ts
  set status = terminal_status,
      provider_message_id = case when terminal_status = 'sent'::public.test_send_status then clean_message_id else null end,
      failure_code = case when terminal_status = 'failed'::public.test_send_status then coalesce(clean_failure_code, 'provider_error') else null end,
      completed_at = clock_timestamp()
  where ts.workspace_id = target_workspace_id
    and ts.id = target_attempt_id
    and ts.created_by = caller_id
    and ts.status = 'queued'::public.test_send_status
  returning ts.release_candidate_id into candidate_id;

  if candidate_id is null then
    raise exception 'Test send attempt is unavailable or already completed.' using errcode = '40001';
  end if;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    case
      when terminal_status = 'sent'::public.test_send_status then 'campaign.test_send.sent'
      else 'campaign.test_send.failed'
    end,
    'test_send',
    target_attempt_id,
    jsonb_build_object(
      'release_candidate_id', candidate_id,
      'provider', 'resend',
      'status', terminal_status,
      'provider_message_id', clean_message_id,
      'failure_code', clean_failure_code
    )
  );

  return true;
end;
$$;

-- Approval is allowed only after at least one successful test delivery for the same
-- immutable release candidate. This keeps the workflow Inbox Lab -> test send -> approval.
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

  if not exists (
    select 1 from public.campaign_test_sends ts
    where ts.workspace_id = target_workspace_id
      and ts.release_candidate_id = target_release_candidate_id
      and ts.status = 'sent'::public.test_send_status
  ) then
    raise exception 'A successful test send is required before approval.' using errcode = '23514';
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
  successful_test_sends integer := 0;
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
      ie.status,
      ie.evidence_url
    from public.inbox_evidence ie
    where ie.workspace_id = target_workspace_id
      and ie.release_candidate_id = target_release_candidate_id
      and ie.client_key = any(required_clients)
    order by ie.client_key, ie.checked_at desc, ie.created_at desc, ie.id desc
  )
  select count(*)::integer into passed_clients
  from latest
  where status = 'pass'::public.inbox_check_status
    and evidence_url is not null;

  select count(*)::integer into successful_test_sends
  from public.campaign_test_sends ts
  where ts.workspace_id = target_workspace_id
    and ts.release_candidate_id = target_release_candidate_id
    and ts.status = 'sent'::public.test_send_status;

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
    and successful_test_sends > 0
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
    'successful_test_send_count', successful_test_sends,
    'approval_count', approval_count,
    'changes_requested_count', changes_requested_count
  );
end;
$$;

revoke all on function private.release_candidate_inbox_passed(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_test_send_attempt(uuid, uuid, text) from public, anon;
grant execute on function public.create_test_send_attempt(uuid, uuid, text) to authenticated;
revoke all on function public.complete_test_send_attempt(uuid, uuid, public.test_send_status, text, text) from public, anon;
grant execute on function public.complete_test_send_attempt(uuid, uuid, public.test_send_status, text, text) to authenticated;

commit;
