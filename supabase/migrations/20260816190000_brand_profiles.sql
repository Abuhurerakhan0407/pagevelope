-- Brand identity and legal metadata used by the Pagevelope renderer.
-- Authored and tested locally/CI only; production application remains human-controlled.

begin;

alter table public.assets
  add constraint assets_workspace_id_id_unique unique (workspace_id, id);

alter table public.brands
  add column primary_color text not null default '#6F5CFB',
  add column accent_color text not null default '#A78BFA',
  add column background_color text not null default '#FFFFFF',
  add column text_color text not null default '#0F1221',
  add column font_family text not null default 'Inter',
  add column website_url text,
  add column company_name text,
  add column legal_address text,
  add column logo_asset_id uuid,
  add column onboarding_completed_at timestamptz,
  add constraint brands_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint brands_accent_color_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint brands_background_color_hex check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint brands_text_color_hex check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint brands_font_family_length check (char_length(trim(font_family)) between 1 and 80),
  add constraint brands_website_https check (website_url is null or website_url ~ '^https://'),
  add constraint brands_company_name_length check (company_name is null or char_length(trim(company_name)) between 1 and 160),
  add constraint brands_legal_address_length check (legal_address is null or char_length(trim(legal_address)) between 5 and 500),
  add constraint brands_logo_asset_workspace_fk
    foreign key (workspace_id, logo_asset_id)
    references public.assets(workspace_id, id)
    on delete set null;

create index brands_logo_asset_idx on public.brands(workspace_id, logo_asset_id)
where logo_asset_id is not null;

create or replace function public.create_brand_profile(
  target_workspace_id uuid,
  brand_name text,
  brand_slug text,
  brand_primary_color text default '#6F5CFB',
  brand_accent_color text default '#A78BFA',
  brand_background_color text default '#FFFFFF',
  brand_text_color text default '#0F1221',
  brand_font_family text default 'Inter',
  brand_website_url text default null,
  brand_company_name text default null,
  brand_legal_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_brand_id uuid;
  clean_name text := trim(brand_name);
  clean_slug text := lower(trim(brand_slug));
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  insert into public.brands (
    workspace_id,
    name,
    slug,
    created_by,
    primary_color,
    accent_color,
    background_color,
    text_color,
    font_family,
    website_url,
    company_name,
    legal_address,
    onboarding_completed_at
  )
  values (
    target_workspace_id,
    clean_name,
    clean_slug,
    caller_id,
    upper(brand_primary_color),
    upper(brand_accent_color),
    upper(brand_background_color),
    upper(brand_text_color),
    trim(brand_font_family),
    nullif(trim(brand_website_url), ''),
    nullif(trim(brand_company_name), ''),
    nullif(trim(brand_legal_address), ''),
    now()
  )
  returning id into new_brand_id;

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
    'brand.created',
    'brand',
    new_brand_id,
    jsonb_build_object('slug', clean_slug)
  );

  return new_brand_id;
end;
$$;

revoke all on function public.create_brand_profile(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_brand_profile(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;

commit;
