-- Atomic campaign creation and immutable version persistence for Pagevelope.
-- Authored and tested against disposable Supabase only; production application remains human-controlled.

begin;

create or replace function public.create_campaign_draft(
  target_workspace_id uuid,
  target_brand_id uuid,
  campaign_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_name text := trim(campaign_name);
  new_campaign_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if char_length(clean_name) < 1 or char_length(clean_name) > 200 then
    raise exception 'Campaign name must be between 1 and 200 characters.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.brands b
    where b.workspace_id = target_workspace_id
      and b.id = target_brand_id
  ) then
    raise exception 'Brand does not belong to the workspace.' using errcode = '23503';
  end if;

  insert into public.campaigns (
    workspace_id,
    brand_id,
    name,
    status,
    schema_version,
    created_by,
    updated_by
  )
  values (
    target_workspace_id,
    target_brand_id,
    clean_name,
    'draft'::public.campaign_status,
    '1.0.0',
    caller_id,
    caller_id
  )
  returning id into new_campaign_id;

  insert into public.audit_events (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    target_workspace_id,
    caller_id,
    'campaign.created',
    'campaign',
    new_campaign_id,
    jsonb_build_object('brand_id', target_brand_id, 'name', clean_name)
  );

  return new_campaign_id;
end;
$$;

create or replace function public.save_campaign_version(
  target_workspace_id uuid,
  target_campaign_id uuid,
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
  next_version integer;
  campaign_schema_version text;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if expected_current_version < 0 then
    raise exception 'Expected version must be zero or greater.' using errcode = '22023';
  end if;

  if jsonb_typeof(source_json) <> 'object' then
    raise exception 'Campaign source must be a JSON object.' using errcode = '22023';
  end if;

  campaign_schema_version := source_json ->> 'schemaVersion';
  if campaign_schema_version <> '1.0.0' then
    raise exception 'Unsupported campaign schema version.' using errcode = '22023';
  end if;

  if source_json ->> 'id' <> target_campaign_id::text then
    raise exception 'Campaign source id does not match the target campaign.' using errcode = '22023';
  end if;

  if source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Source SHA-256 must be 64 lowercase hexadecimal characters.' using errcode = '22023';
  end if;

  update public.campaigns c
  set current_version_number = c.current_version_number + 1,
      schema_version = campaign_schema_version,
      updated_by = caller_id,
      updated_at = now()
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id
    and c.current_version_number = expected_current_version
    and c.status in ('draft'::public.campaign_status, 'review'::public.campaign_status)
  returning c.current_version_number into next_version;

  if next_version is null then
    raise exception 'Campaign version conflict or campaign is not editable.' using errcode = '40001';
  end if;

  insert into public.campaign_versions (
    workspace_id,
    campaign_id,
    version_number,
    source_json,
    source_sha256,
    created_by
  )
  values (
    target_workspace_id,
    target_campaign_id,
    next_version,
    source_json,
    source_sha256,
    caller_id
  );

  insert into public.audit_events (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    target_workspace_id,
    caller_id,
    'campaign.version.created',
    'campaign',
    target_campaign_id,
    jsonb_build_object('version_number', next_version, 'source_sha256', source_sha256)
  );

  return next_version;
end;
$$;

revoke all on function public.create_campaign_draft(uuid, uuid, text) from public, anon;
grant execute on function public.create_campaign_draft(uuid, uuid, text) to authenticated;

revoke all on function public.save_campaign_version(uuid, uuid, integer, jsonb, text) from public, anon;
grant execute on function public.save_campaign_version(uuid, uuid, integer, jsonb, text) to authenticated;

commit;
