-- Tenant-safe Shopify product synchronization into the existing product catalog.

begin;

alter table public.products
  add column external_updated_at timestamptz,
  add column last_synced_at timestamptz;

create unique index products_shopify_external_unique
  on public.products(workspace_id, brand_id, external_id)
  where source = 'shopify'::public.product_source and external_id is not null;

create or replace function public.upsert_shopify_product(
  target_workspace_id uuid,
  target_brand_id uuid,
  shopify_product_id text,
  product_title text,
  product_sku text,
  product_price numeric,
  product_currency text,
  product_image_url text,
  product_url text,
  shopify_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_external_id text := trim(shopify_product_id);
  clean_title text := trim(product_title);
  clean_sku text := nullif(trim(product_sku), '');
  clean_currency text := upper(trim(product_currency));
  clean_image_url text := nullif(trim(product_image_url), '');
  clean_product_url text := nullif(trim(product_url), '');
  product_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.brands b
    where b.workspace_id = target_workspace_id and b.id = target_brand_id
  ) then
    raise exception 'Brand does not belong to the workspace.' using errcode = '23503';
  end if;

  if char_length(clean_external_id) < 1 or char_length(clean_external_id) > 220 then
    raise exception 'Shopify product id is invalid.' using errcode = '22023';
  end if;
  if char_length(clean_title) not between 1 and 200 then
    raise exception 'Product title must be between 1 and 200 characters.' using errcode = '22023';
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
    workspace_id, brand_id, source, external_id, title, sku, price_amount,
    currency, image_url, product_url, created_by, external_updated_at, last_synced_at
  ) values (
    target_workspace_id, target_brand_id, 'shopify'::public.product_source,
    clean_external_id, clean_title, clean_sku, product_price, clean_currency,
    clean_image_url, clean_product_url, caller_id, shopify_updated_at, now()
  )
  on conflict (workspace_id, brand_id, external_id)
    where source = 'shopify'::public.product_source and external_id is not null
  do update set
    title = excluded.title,
    sku = excluded.sku,
    price_amount = excluded.price_amount,
    currency = excluded.currency,
    image_url = excluded.image_url,
    product_url = excluded.product_url,
    external_updated_at = excluded.external_updated_at,
    last_synced_at = now(),
    updated_at = now()
  returning id into product_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'product.synced.shopify',
    'product',
    product_id,
    jsonb_build_object('brand_id', target_brand_id, 'external_id', clean_external_id)
  );

  return product_id;
end;
$$;

revoke all on function public.upsert_shopify_product(uuid, uuid, text, text, text, numeric, text, text, text, timestamptz) from public, anon;
grant execute on function public.upsert_shopify_product(uuid, uuid, text, text, text, numeric, text, text, text, timestamptz) to authenticated;

commit;
