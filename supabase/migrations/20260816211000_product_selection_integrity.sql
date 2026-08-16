-- Harden campaign product integrity against direct table mutations.
-- Authored/tested against disposable Supabase only; production migration remains human-controlled.

begin;

create or replace function private.assert_campaign_product_brand()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_brand_id uuid;
  product_brand_id uuid;
begin
  select c.brand_id
    into campaign_brand_id
  from public.campaigns c
  where c.workspace_id = new.workspace_id
    and c.id = new.campaign_id;

  select p.brand_id
    into product_brand_id
  from public.products p
  where p.workspace_id = new.workspace_id
    and p.id = new.product_id;

  if campaign_brand_id is null
     or product_brand_id is null
     or campaign_brand_id <> product_brand_id then
    raise exception 'Campaign products must belong to the campaign brand.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger campaign_products_require_same_brand
before insert or update of workspace_id, campaign_id, product_id
on public.campaign_products
for each row execute function private.assert_campaign_product_brand();

create or replace function private.invalidate_campaign_after_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  target_campaign_id uuid;
  caller_id uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    target_workspace_id := old.workspace_id;
    target_campaign_id := old.campaign_id;
  else
    target_workspace_id := new.workspace_id;
    target_campaign_id := new.campaign_id;
  end if;

  update public.campaigns c
  set product_selection_completed_at = null,
      brief_completed_at = null,
      creative_directions = '[]'::jsonb,
      selected_direction_key = null,
      updated_by = coalesce(caller_id, c.updated_by),
      updated_at = now()
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger campaign_products_invalidate_downstream
  after insert or delete or update of product_id, position
  on public.campaign_products
  for each row execute function private.invalidate_campaign_after_product_change();

create or replace function private.require_campaign_product_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_count integer;
begin
  if new.product_selection_completed_at is not null or new.brief_completed_at is not null then
    select count(*)::integer
      into selected_count
    from public.campaign_products cp
    where cp.workspace_id = new.workspace_id
      and cp.campaign_id = new.id;

    if selected_count < 1 or selected_count > 6 then
      raise exception 'Campaign product selection must contain between one and six products.' using errcode = '23514';
    end if;
  end if;

  if new.brief_completed_at is not null and new.product_selection_completed_at is null then
    raise exception 'Campaign products must be selected before the brief.' using errcode = '23514';
  end if;

  if new.selected_direction_key is not null then
    if new.brief_completed_at is null then
      raise exception 'Campaign brief must be complete before selecting a direction.' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(new.creative_directions) as direction
      where direction ->> 'key' = new.selected_direction_key
    ) then
      raise exception 'Selected direction must exist in the generated direction set.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger campaigns_require_product_integrity
before update of product_selection_completed_at, brief_completed_at, creative_directions, selected_direction_key
on public.campaigns
for each row execute function private.require_campaign_product_integrity();

revoke all on function private.assert_campaign_product_brand() from public, anon, authenticated;
revoke all on function private.invalidate_campaign_after_product_change() from public, anon, authenticated;
revoke all on function private.require_campaign_product_integrity() from public, anon, authenticated;

commit;
