-- Extend the shared integration boundary for Shopify offline access tokens.
-- No production credentials are stored by this migration.

begin;

alter type public.integration_provider add value if not exists 'shopify';

alter table public.integration_credentials_secure
  alter column refresh_token_ciphertext drop not null,
  alter column access_expires_at drop not null;

commit;
