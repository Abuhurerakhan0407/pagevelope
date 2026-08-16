begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'brand-owner-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'brand-owner-b@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('41000000-0000-4000-8000-000000000001', 'Brand Workspace A', 'brand-workspace-a', '40000000-0000-4000-8000-000000000001'),
  ('42000000-0000-4000-8000-000000000001', 'Brand Workspace B', 'brand-workspace-b', '40000000-0000-4000-8000-000000000002');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'owner'),
  ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'owner');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"40000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.create_brand_profile(
      '41000000-0000-4000-8000-000000000001',
      'Northstar',
      'northstar',
      '#111111',
      '#6F5CFB',
      '#FFFFFF',
      '#0F1221',
      'Inter',
      'https://northstar.example',
      'Northstar Commerce Pvt Ltd',
      'Mumbai, Maharashtra, India'
    )$$,
  'owner can create a complete brand profile atomically'
);

select extensions.is(
  (select count(*) from public.brands),
  1::bigint,
  'owner sees only own brand through RLS'
);

select extensions.is(
  (select primary_color from public.brands where slug = 'northstar'),
  '#111111'::text,
  'brand color is normalized and persisted'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'brand.created'),
  1::bigint,
  'brand creation writes an audit event'
);

select extensions.throws_ok(
  $$select public.create_brand_profile('41000000-0000-4000-8000-000000000001', 'Bad Color', 'bad-color', 'purple')$$,
  '23514',
  null,
  'invalid primary color fails closed'
);

select extensions.throws_ok(
  $$select public.create_brand_profile(
      '41000000-0000-4000-8000-000000000001', 'Bad URL', 'bad-url',
      '#6F5CFB', '#A78BFA', '#FFFFFF', '#0F1221', 'Inter', 'http://insecure.example'
    )$$,
  '23514',
  null,
  'non-https brand website is rejected'
);

select extensions.throws_ok(
  $$select public.create_brand_profile('42000000-0000-4000-8000-000000000001', 'Cross tenant', 'cross-tenant')$$,
  '42501',
  null,
  'owner cannot create brand in another workspace'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"40000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.create_brand_profile('42000000-0000-4000-8000-000000000001', 'Tenant B Brand', 'tenant-b-brand')$$,
  'second tenant can create its own brand'
);

select extensions.is(
  (select count(*) from public.brands),
  1::bigint,
  'second tenant cannot read first tenant brand'
);

select extensions.is(
  (select font_family from public.brands where slug = 'tenant-b-brand'),
  'Inter'::text,
  'brand defaults are applied'
);

reset role;
select * from extensions.finish();
rollback;
