-- Tenant-safe manual product catalog + campaign product selection.
-- Authored/tested against disposable Supabase only; production migration remains human-controlled.

begin;

create type public.product_source as enum ('manual', 'shopify');

alter table public.campaigns
  add column product_selection_completed_at timestamptz;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null,
  source public.product_source not null default 'manual',
  external_id text,
  title text not null check (char_length(trim(title)) between 1 and 200),
  sku text check (sku is null or char_length(trim(sku)) between 1 and 120),
  price_amount numeric(12, 2) not null check (price_amount >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  product_url text check (product_url is null or product_url ~ '^https://'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint products_brand_workspace_fk
    foreign key (workspace_id, brand_id)
    references public.brands(workspace_id, id)
    on delete cascade
);

create table public.campaign_products (
  workspace_id uuid not null,
  campaign_id uuid not null,
  product_id uuid not null,
  position integer not null check (position between 1 and 6),
  added_at timestamptz not null default now(),
  primary key (campaign_id, product_id),
  unique (campaign_id, position),
  constraint campaign_products_campaign_workspace_fk
    foreign key (workspace_id, campaign_id)
    references public.campaigns(workspace_id, id)
    on delete cascade,
  constraint campaign_products_product_workspace_fk
    foreign key (workspace_id, product_id)
    references public.products(workspace_id, id)
    on delete cascade
);

create index products_brand_idx on public.products(workspace_id, brand_id, updated_at desc);
create index campaign_products_workspace_idx on public.campaign_products(workspace_id, campaign_id, position);

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

alter table public.products enable row level security;
alter table public.campaign_products enable row level security;

create policy products_select_member
on public.products for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy products_insert_editor
on public.products for insert
to authenticated
with check (
  private.can_edit_workspace(workspace_id)
  and created_by = (select auth.uid())
);

create policy products_update_editor
on public.products for update
to authenticated
using (private.can_edit_workspace(workspace_id))
with check (private.can_edit_workspace(workspace_id));

create policy products_delete_admin
on public.products for delete
to authenticated
using (private.can_admin_workspace(workspace_id));

create policy campaign_products_select_member
on public.campaign_products for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy campaign_products_insert_editor
on public.campaign_products for insert
to authenticated
with check (private.can_edit_workspace(workspace_id));

create policy campaign_products_delete_editor
on public.campaign_products for delete
to authenticated
using (private.can_edit_workspace(workspace_id));

create or replace function public.create_manual_product(
  target_workspace_id uuid,
  target_brand_id uuid,
  product_title text,
  product_sku text,
  product_price numeric,
  product_currency text,
  product_image_url text,
  product_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_title text := trim(product_title);
  clean_sku text := nullif(trim(product_sku), '');
  clean_currency text := upper(trim(product_currency));
  clean_image_url text := nullif(trim(product_image_url), '');
  clean_product_url text := nullif(trim(product_url), '');
  new_product_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.brands b
    where b.workspace_id = target_workspace_id
      and b.id = target_brand_id
  ) then
    raise exception 'Brand does not belong to the workspace.' using errcode = '23503';
  end if;

  if char_length(clean_title) not between 1 and 200 then
    raise exception 'Product title must be between 1 and 200 characters.' using errcode = '22023';
  end if;
  if clean_sku is not null and char_length(clean_sku) > 120 then
    raise exception 'SKU is too long.' using errcode = '22023';
  end if;
  if product_price is null or product_price < 0 or product_price > 9999999999.99 then
    raise exception 'Product price is invalid.' using errcode = '22023';
  end if;
  if clean_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a three-letter code.' using errcode = '22023';
  end if;
  if clean_image_url is not null and clean_image_url !~ '^https://' then
    raise exception 'Product image URL must use HTTPS.' using errcode = '22023';
  end if;
  if clean_product_url is not null and clean_product_url !~ '^https://' then
    raise exception 'Product URL must use HTTPS.' using errcode = '22023';
  end if;

  insert into public.products (
    workspace_id, brand_id, source, title, sku, price_amount, currency,
    image_url, product_url, created_by
  ) values (
    target_workspace_id, target_brand_id, 'manual'::public.product_source,
    clean_title, clean_sku, product_price, clean_currency,
    clean_image_url, clean_product_url, caller_id
  )
  returning id into new_product_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'product.created',
    'product',
    new_product_id,
    jsonb_build_object('brand_id', target_brand_id, 'source', 'manual')
  );

  return new_product_id;
end;
$$;

create or replace function public.set_campaign_products(
  target_workspace_id uuid,
  target_campaign_id uuid,
  product_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  campaign_brand_id uuid;
  selected_count integer := coalesce(cardinality(product_ids), 0);
  distinct_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if selected_count < 1 or selected_count > 6 then
    raise exception 'Select between one and six products.' using errcode = '22023';
  end if;

  select count(distinct id)::integer into distinct_count
  from unnest(product_ids) as selected(id);
  if distinct_count <> selected_count then
    raise exception 'Duplicate products are not allowed.' using errcode = '22023';
  end if;

  select c.brand_id into campaign_brand_id
  from public.campaigns c
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id
    and c.status = 'draft'::public.campaign_status
  for update;

  if campaign_brand_id is null then
    raise exception 'Campaign is unavailable or no longer editable.' using errcode = '40001';
  end if;

  if (
    select count(*)
    from public.products p
    where p.workspace_id = target_workspace_id
      and p.brand_id = campaign_brand_id
      and p.id = any(product_ids)
  ) <> selected_count then
    raise exception 'Every selected product must belong to this campaign brand.' using errcode = '42501';
  end if;

  delete from public.campaign_products cp
  where cp.workspace_id = target_workspace_id
    and cp.campaign_id = target_campaign_id;

  insert into public.campaign_products (workspace_id, campaign_id, product_id, position)
  select target_workspace_id, target_campaign_id, selected.id, selected.ordinality::integer
  from unnest(product_ids) with ordinality as selected(id, ordinality);

  update public.campaigns c
  set product_selection_completed_at = now(),
      brief_completed_at = null,
      creative_directions = '[]'::jsonb,
      selected_direction_key = null,
      updated_by = caller_id,
      updated_at = now()
  where c.workspace_id = target_workspace_id
    and c.id = target_campaign_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'campaign.products.updated',
    'campaign',
    target_campaign_id,
    jsonb_build_object('product_count', selected_count)
  );

  return selected_count;
end;
$$;

create or replace function private.require_products_before_brief()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.brief_completed_at is not null and new.product_selection_completed_at is null then
    raise exception 'Campaign products must be selected before the brief.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger campaigns_require_products_before_brief
before update of brief_completed_at on public.campaigns
for each row execute function private.require_products_before_brief();

revoke all on function private.require_products_before_brief() from public, anon, authenticated;
revoke all on function public.create_manual_product(uuid, uuid, text, text, numeric, text, text, text) from public, anon;
grant execute on function public.create_manual_product(uuid, uuid, text, text, numeric, text, text, text) to authenticated;
revoke all on function public.set_campaign_products(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.set_campaign_products(uuid, uuid, uuid[]) to authenticated;

commit;
