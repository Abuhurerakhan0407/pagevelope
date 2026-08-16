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

commit;
