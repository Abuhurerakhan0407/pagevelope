-- Move encrypted OAuth credentials into the exposed public schema so the
-- server-side service-role client can access them through PostgREST. RLS has no
-- authenticated policies and table grants are revoked, so browser/user clients
-- cannot read token ciphertext.

begin;

drop table if exists private.integration_credentials;

create table public.integration_credentials_secure (
  connection_id uuid primary key references public.integration_connections(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_expires_at timestamptz not null,
  token_type text not null default 'bearer' check (lower(token_type) = 'bearer'),
  updated_at timestamptz not null default now()
);

alter table public.integration_credentials_secure enable row level security;
revoke all on public.integration_credentials_secure from public, anon, authenticated;

comment on table public.integration_credentials_secure is
  'Encrypted OAuth credentials. Service-role access only; no authenticated RLS policies or grants.';

commit;
