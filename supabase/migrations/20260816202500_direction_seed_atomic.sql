-- Atomically select a generated creative direction and persist its initial immutable campaign version.
-- Authored/tested against disposable Supabase only; production migration remains human-controlled.

begin;

create or replace function public.select_campaign_direction_and_seed(
  target_workspace_id uuid,
  target_campaign_id uuid,
  direction_key text,
  expected_current_version integer,
  source_json jsonb,
  source_sha256 text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_key text := lower(trim(direction_key));
  next_version integer;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if clean_key not in ('editorial', 'product', 'motion') then
    raise exception 'Unknown creative direction.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.campaigns c
    where c.workspace_id = target_workspace_id
      and c.id = target_campaign_id
      and c.status = 'draft'::public.campaign_status
      and c.current_version_number = expected_current_version
      and c.brief_completed_at is not null
      and exists (
        select 1
        from jsonb_array_elements(c.creative_directions) as direction
        where direction ->> 'key' = clean_key
      )
  ) then
    raise exception 'Campaign brief, direction, or version state is no longer current.' using errcode = '40001';
  end if;

  update public.campaigns c
  set selected_direction_key = clean_key,
      updated_by = caller_id,
      updated_at = now()
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.direction.selected',
    'campaign',
    target_campaign_id,
    jsonb_build_object('direction_key', clean_key)
  );

  next_version := public.save_campaign_version(
    target_workspace_id,
    target_campaign_id,
    expected_current_version,
    source_json,
    source_sha256
  );

  return next_version;
end;
$$;

revoke all on function public.select_campaign_direction_and_seed(uuid, uuid, text, integer, jsonb, text) from public, anon;
grant execute on function public.select_campaign_direction_and_seed(uuid, uuid, text, integer, jsonb, text) to authenticated;

commit;
