-- Provider-confirmed writes must only be recorded by trusted server code.
-- Authenticated users can initiate workflows through app routes, but cannot forge
-- Shopify source syncs or Klaviyo publish receipts through PostgREST RPCs.

begin;

revoke all on function public.record_klaviyo_publish_receipt(uuid, uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.upsert_shopify_product(uuid, uuid, text, text, text, numeric, text, text, text, timestamptz)
  from public, anon, authenticated;

create or replace function public.record_klaviyo_publish_receipt_server(
  target_workspace_id uuid,
  target_release_candidate_id uuid,
  target_connection_id uuid,
  provider_revision text,
  external_template_id text,
  external_campaign_id text,
  external_message_id text,
  actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_campaign_id uuid;
  candidate_version integer;
  candidate_source_sha text;
  candidate_manifest_sha text;
  campaign_current_version integer;
  campaign_status public.campaign_status;
  new_receipt_id uuid;
begin
  if actor_user_id is null or not exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = actor_user_id
      and wm.role in ('owner'::public.workspace_role, 'admin'::public.workspace_role, 'editor'::public.workspace_role)
  ) then
    raise exception 'Workspace edit access is required.' using errcode = '42501';
  end if;

  if provider_revision !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Provider revision must be a date revision.' using errcode = '22023';
  end if;
  if char_length(trim(external_template_id)) < 1 then
    raise exception 'Klaviyo template id is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.integration_connections ic
    where ic.workspace_id = target_workspace_id
      and ic.id = target_connection_id
      and ic.provider = 'klaviyo'::public.integration_provider
      and ic.status = 'connected'::public.integration_status
  ) then
    raise exception 'Connected Klaviyo account required.' using errcode = '42501';
  end if;

  select rc.campaign_id, rc.version_number, rc.source_sha256, rc.manifest_sha256
    into candidate_campaign_id, candidate_version, candidate_source_sha, candidate_manifest_sha
  from public.campaign_release_candidates rc
  where rc.workspace_id = target_workspace_id
    and rc.id = target_release_candidate_id;

  if candidate_campaign_id is null then
    raise exception 'Release candidate is unavailable.' using errcode = '23503';
  end if;

  select c.current_version_number, c.status
    into campaign_current_version, campaign_status
  from public.campaigns c
  where c.workspace_id = target_workspace_id
    and c.id = candidate_campaign_id
  for update;

  if campaign_current_version is null
     or campaign_current_version <> candidate_version
     or campaign_status <> 'approved'::public.campaign_status then
    raise exception 'Only the current approved campaign version can publish.' using errcode = '40001';
  end if;

  insert into public.campaign_publish_receipts (
    workspace_id, campaign_id, release_candidate_id, connection_id, provider,
    provider_revision, external_template_id, external_campaign_id, external_message_id,
    source_sha256, manifest_sha256, published_by
  ) values (
    target_workspace_id, candidate_campaign_id, target_release_candidate_id,
    target_connection_id, 'klaviyo'::public.integration_provider,
    provider_revision, trim(external_template_id), nullif(trim(external_campaign_id), ''),
    nullif(trim(external_message_id), ''), candidate_source_sha, candidate_manifest_sha, actor_user_id
  )
  returning id into new_receipt_id;

  update public.campaigns
  set status = 'published'::public.campaign_status,
      updated_by = actor_user_id,
      updated_at = now()
  where workspace_id = target_workspace_id
    and id = candidate_campaign_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    actor_user_id,
    'campaign.published.klaviyo',
    'publish_receipt',
    new_receipt_id,
    jsonb_build_object(
      'campaign_id', candidate_campaign_id,
      'release_candidate_id', target_release_candidate_id,
      'connection_id', target_connection_id,
      'provider_revision', provider_revision,
      'external_template_id', trim(external_template_id),
      'external_campaign_id', nullif(trim(external_campaign_id), ''),
      'external_message_id', nullif(trim(external_message_id), ''),
      'source_sha256', candidate_source_sha,
      'manifest_sha256', candidate_manifest_sha,
      'completed_by', 'server'
    )
  );

  return new_receipt_id;
exception
  when unique_violation then
    raise exception 'This immutable release candidate already has a publish receipt.' using errcode = '23505';
end;
$$;

revoke all on function public.record_klaviyo_publish_receipt_server(uuid, uuid, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_klaviyo_publish_receipt_server(uuid, uuid, uuid, text, text, text, text, uuid)
  to service_role;

create or replace function public.upsert_shopify_product_server(
  target_workspace_id uuid,
  target_brand_id uuid,
  shopify_product_id text,
  product_title text,
  product_sku text,
  product_price numeric,
  product_currency text,
  product_image_url text,
  product_url text,
  shopify_updated_at timestamptz,
  actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_external_id text := trim(shopify_product_id);
  clean_title text := trim(product_title);
  clean_sku text := nullif(trim(product_sku), '');
  clean_currency text := upper(trim(product_currency));
  clean_image_url text := nullif(trim(product_image_url), '');
  clean_product_url text := nullif(trim(product_url), '');
  product_id uuid;
begin
  if actor_user_id is null or not exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = actor_user_id
      and wm.role in ('owner'::public.workspace_role, 'admin'::public.workspace_role, 'editor'::public.workspace_role)
  ) then
    raise exception 'Workspace edit access is required.' using errcode = '42501';
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
    clean_image_url, clean_product_url, actor_user_id, shopify_updated_at, now()
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
    actor_user_id,
    'product.synced.shopify',
    'product',
    product_id,
    jsonb_build_object('brand_id', target_brand_id, 'external_id', clean_external_id, 'completed_by', 'server')
  );

  return product_id;
end;
$$;

revoke all on function public.upsert_shopify_product_server(uuid, uuid, text, text, text, numeric, text, text, text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.upsert_shopify_product_server(uuid, uuid, text, text, text, numeric, text, text, text, timestamptz, uuid)
  to service_role;

commit;
