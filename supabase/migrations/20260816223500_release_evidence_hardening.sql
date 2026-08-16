-- Harden release evidence so a passing inbox check cannot exist without inspectable evidence.
-- Production application remains human-controlled.

begin;

alter table public.inbox_evidence
  add constraint inbox_pass_requires_evidence
  check (
    status = 'fail'::public.inbox_check_status
    or evidence_url is not null
  );

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

  if check_status = 'pass'::public.inbox_check_status and clean_url is null then
    raise exception 'Passing inbox evidence requires an HTTPS evidence URL.' using errcode = '23514';
  end if;

  if clean_notes is not null and char_length(clean_notes) > 2000 then
    raise exception 'Inbox evidence notes are too long.' using errcode = '22023';
  end if;

  insert into public.inbox_evidence (
    workspace_id, release_candidate_id, client_key, provider, status,
    evidence_url, notes, checked_at, created_by
  ) values (
    target_workspace_id, target_release_candidate_id, clean_client, clean_provider,
    check_status, clean_url, clean_notes, clock_timestamp(), caller_id
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
      'status', check_status,
      'has_evidence_url', clean_url is not null
    )
  );

  return new_evidence_id;
end;
$$;

revoke all on function public.record_inbox_evidence(uuid, uuid, text, text, public.inbox_check_status, text, text) from public, anon;
grant execute on function public.record_inbox_evidence(uuid, uuid, text, text, public.inbox_check_status, text, text) to authenticated;

commit;
