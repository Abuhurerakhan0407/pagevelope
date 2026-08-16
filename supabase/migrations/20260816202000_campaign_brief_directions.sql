-- Campaign brief + three-direction selection gate for Pagevelope.
-- Authored/tested against disposable Supabase only; production migration remains human-controlled.

begin;

alter table public.campaigns
  add column campaign_system text,
  add column brief_goal text,
  add column brief_audience text,
  add column brief_offer text,
  add column brief_tone text,
  add column brief_motion_level text,
  add column creative_directions jsonb not null default '[]'::jsonb,
  add column selected_direction_key text,
  add column brief_completed_at timestamptz,
  add constraint campaigns_system_allowed check (
    campaign_system is null or campaign_system in (
      'product-launch',
      'collection-editorial',
      'restock-waitlist',
      'limited-offer',
      'lifecycle-reminder'
    )
  ),
  add constraint campaigns_brief_goal_length check (brief_goal is null or char_length(trim(brief_goal)) between 3 and 600),
  add constraint campaigns_brief_audience_length check (brief_audience is null or char_length(trim(brief_audience)) between 2 and 300),
  add constraint campaigns_brief_offer_length check (brief_offer is null or char_length(trim(brief_offer)) between 1 and 300),
  add constraint campaigns_brief_tone_length check (brief_tone is null or char_length(trim(brief_tone)) between 2 and 120),
  add constraint campaigns_motion_allowed check (brief_motion_level is null or brief_motion_level in ('none', 'subtle', 'expressive')),
  add constraint campaigns_directions_shape check (
    case
      when jsonb_typeof(creative_directions) = 'array'
        then jsonb_array_length(creative_directions) in (0, 3)
      else false
    end
  ),
  add constraint campaigns_direction_key_allowed check (
    selected_direction_key is null or selected_direction_key in ('editorial', 'product', 'motion')
  );

create or replace function public.save_campaign_brief(
  target_workspace_id uuid,
  target_campaign_id uuid,
  requested_system text,
  requested_goal text,
  requested_audience text,
  requested_offer text,
  requested_tone text,
  requested_motion_level text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_system text := lower(trim(requested_system));
  clean_goal text := trim(requested_goal);
  clean_audience text := trim(requested_audience);
  clean_offer text := trim(requested_offer);
  clean_tone text := trim(requested_tone);
  clean_motion text := lower(trim(requested_motion_level));
  direction_payload jsonb;
  updated_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if clean_system not in ('product-launch', 'collection-editorial', 'restock-waitlist', 'limited-offer', 'lifecycle-reminder') then
    raise exception 'Unsupported campaign system.' using errcode = '22023';
  end if;
  if char_length(clean_goal) not between 3 and 600 then
    raise exception 'Campaign goal must be between 3 and 600 characters.' using errcode = '22023';
  end if;
  if char_length(clean_audience) not between 2 and 300 then
    raise exception 'Audience must be between 2 and 300 characters.' using errcode = '22023';
  end if;
  if char_length(clean_offer) not between 1 and 300 then
    raise exception 'Offer must be between 1 and 300 characters.' using errcode = '22023';
  end if;
  if char_length(clean_tone) not between 2 and 120 then
    raise exception 'Tone must be between 2 and 120 characters.' using errcode = '22023';
  end if;
  if clean_motion not in ('none', 'subtle', 'expressive') then
    raise exception 'Unsupported motion level.' using errcode = '22023';
  end if;

  direction_payload := jsonb_build_array(
    jsonb_build_object(
      'key', 'editorial',
      'title', 'Editorial Story',
      'description', format('Lead with story and atmosphere for %s. Keep the voice %s and let product proof arrive after the hook.', clean_audience, clean_tone),
      'layout', 'story-first',
      'motion', case when clean_motion = 'none' then 'static' else 'restrained' end
    ),
    jsonb_build_object(
      'key', 'product',
      'title', 'Product Spotlight',
      'description', format('Put the offer — %s — and product value above the fold, with direct proof and a decisive CTA.', clean_offer),
      'layout', 'product-first',
      'motion', case when clean_motion = 'expressive' then 'product-loop' else clean_motion end
    ),
    jsonb_build_object(
      'key', 'motion',
      'title', 'Motion Hook',
      'description', format('Use a safe first-frame hook around the goal: %s. Motion supports attention, with a meaningful static fallback.', clean_goal),
      'layout', 'motion-first',
      'motion', clean_motion
    )
  );

  update public.campaigns c
  set campaign_system = clean_system,
      brief_goal = clean_goal,
      brief_audience = clean_audience,
      brief_offer = clean_offer,
      brief_tone = clean_tone,
      brief_motion_level = clean_motion,
      creative_directions = direction_payload,
      selected_direction_key = null,
      brief_completed_at = now(),
      updated_by = caller_id,
      updated_at = now()
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id
    and c.status = 'draft'::public.campaign_status;

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'Campaign is unavailable or no longer editable.' using errcode = '40001';
  end if;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.brief.saved',
    'campaign',
    target_campaign_id,
    jsonb_build_object('campaign_system', clean_system, 'motion_level', clean_motion)
  );

  return true;
end;
$$;

create or replace function public.select_campaign_direction(
  target_workspace_id uuid,
  target_campaign_id uuid,
  direction_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_key text := lower(trim(direction_key));
  updated_count integer;
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

  update public.campaigns c
  set selected_direction_key = clean_key,
      updated_by = caller_id,
      updated_at = now()
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id
    and c.status = 'draft'::public.campaign_status
    and c.brief_completed_at is not null
    and exists (
      select 1
      from jsonb_array_elements(c.creative_directions) as direction
      where direction ->> 'key' = clean_key
    );

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'Campaign brief is incomplete or campaign is unavailable.' using errcode = '40001';
  end if;

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

  return true;
end;
$$;

revoke all on function public.save_campaign_brief(uuid, uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_campaign_brief(uuid, uuid, text, text, text, text, text, text) to authenticated;

revoke all on function public.select_campaign_direction(uuid, uuid, text) from public, anon;
grant execute on function public.select_campaign_direction(uuid, uuid, text) to authenticated;

commit;
