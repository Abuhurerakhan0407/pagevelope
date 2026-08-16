begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'asset-owner@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'asset-viewer@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values ('92000000-0000-4000-8000-000000000001', 'Asset Workspace', 'asset-workspace', '91000000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'owner'),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'viewer');

insert into public.brands (id, workspace_id, name, slug, created_by)
values ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Asset Brand', 'asset-brand', '91000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"91000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.register_delivery_asset(
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001/delivery/' || repeat('a', 64) || '.gif',
    'image/gif', 1800000, repeat('a', 64)
  )$$,
  'workspace owner can register a content-addressed delivery asset'
);

select extensions.is(
  (select kind from public.assets where workspace_id = '92000000-0000-4000-8000-000000000001' limit 1),
  'derived'::public.asset_kind,
  'delivery asset metadata is marked derived'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'asset.delivery.registered'),
  1::bigint,
  'delivery asset registration is audit logged'
);

select extensions.lives_ok(
  $$select public.register_delivery_asset(
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001/delivery/' || repeat('a', 64) || '.gif',
    'image/gif', 1800000, repeat('a', 64)
  )$$,
  'registering the same immutable delivery asset is idempotent'
);

select extensions.is(
  (select count(*) from public.assets where workspace_id = '92000000-0000-4000-8000-000000000001'),
  1::bigint,
  'idempotent registration does not duplicate asset metadata'
);

select extensions.throws_ok(
  $$select public.register_delivery_asset(
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001/delivery/not-content-addressed.gif',
    'image/gif', 1000, repeat('b', 64)
  )$$,
  '22023', null,
  'delivery metadata rejects non-content-addressed object paths'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"91000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.register_delivery_asset(
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001/delivery/' || repeat('c', 64) || '.png',
    'image/png', 2000, repeat('c', 64)
  )$$,
  '42501', null,
  'viewer cannot register delivery assets'
);

select extensions.is(
  (select count(*) from public.assets where workspace_id = '92000000-0000-4000-8000-000000000001'),
  1::bigint,
  'viewer can read workspace delivery asset metadata without gaining write access'
);

reset role;
select * from extensions.finish();
rollback;
