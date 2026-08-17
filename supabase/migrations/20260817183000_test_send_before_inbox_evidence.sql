-- Make the assisted-pilot review flow executable without a separate paid inbox-testing provider.
-- A current, reviewable release may be test-delivered first so reviewers can capture
-- real mailbox evidence from that exact immutable release. Final readiness still
-- requires all required inbox evidence, a provider-confirmed test send, and approval.

begin;

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

  if campaign_status <> 'review'::public.campaign_status then
    raise exception 'Campaign is not in release review.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.campaign_approvals ca
    where ca.workspace_id = target_workspace_id
      and ca.release_candidate_id = target_release_candidate_id
      and ca.decision = 'changes_requested'::public.approval_decision
  ) then
    raise exception 'Release candidate has changes requested.' using errcode = '23514';
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
      'provider', 'resend',
      'inbox_evidence_required_for_final_approval', true
    )
  );

  return new_attempt_id;
end;
$$;

revoke all on function public.create_test_send_attempt(uuid, uuid, text) from public, anon;
grant execute on function public.create_test_send_attempt(uuid, uuid, text) to authenticated;

commit;
