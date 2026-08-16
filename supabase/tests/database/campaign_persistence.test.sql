begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'campaign-owner-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'campaign-owner-b@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('51000000-0000-4000-8000-000000000001', 'Campaign Workspace A', 'campaign-workspace-a', '50000000-0000-4000-8000-000000000001'),
  ('52000000-0000-4000-8000-000000000001', 'Campaign Workspace B', 'campaign-workspace-b', '50000000-0000-4000-8000-000000000002');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'owner'),
  ('52000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'owner');

insert into public.brands (id, workspace_id, name, slug, created_by)
values
  ('51100000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Campaign Brand A', 'campaign-brand-a', '50000000-0000-4000-8000-000000000001'),
  ('52100000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'Campaign Brand B', 'campaign-brand-b', '50000000-0000-4000-8000-000000000002');

create temporary table campaign_test_state (campaign_id uuid not null);
grant select, insert on campaign_test_state to authenticated;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"50000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$insert into campaign_test_state (campaign_id)
    select public.create_campaign_draft(
      '51000000-0000-4000-8000-000000000001',
      '51100000-0000-4000-8000-000000000001',
      'Orbit Launch'
    )$$,
  'editor-capable member can create a draft campaign atomically'
);

select extensions.is(
  (select count(*) from public.campaigns where workspace_id = '51000000-0000-4000-8000-000000000001' and name = 'Orbit Launch'),
  1::bigint,
  'campaign draft is persisted'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'campaign.created'),
  1::bigint,
  'campaign creation is audited'
);

select extensions.throws_ok(
  $$select public.create_campaign_draft(
      '52000000-0000-4000-8000-000000000001',
      '52100000-0000-4000-8000-000000000001',
      'Cross tenant campaign'
    )$$,
  '42501',
  null,
  'campaign creation cannot cross workspace boundaries'
);

select extensions.lives_ok(
  $$select public.save_campaign_version(
      '51000000-0000-4000-8000-000000000001',
      (select campaign_id from campaign_test_state),
      0,
      jsonb_build_object(
        'schemaVersion', '1.0.0',
        'id', (select campaign_id::text from campaign_test_state),
        'name', 'Orbit Launch'
      ),
      repeat('a', 64)
    )$$,
  'first immutable campaign version saves from expected version zero'
);

select extensions.is(
  (select current_version_number from public.campaigns where id = (select campaign_id from campaign_test_state)),
  1,
  'campaign pointer advances to version one'
);

select extensions.is(
  (select count(*) from public.campaign_versions where campaign_id = (select campaign_id from campaign_test_state)),
  1::bigint,
  'first immutable version row exists'
);

select extensions.is(
  (select source_sha256 from public.campaign_versions where campaign_id = (select campaign_id from campaign_test_state) and version_number = 1),
  repeat('a', 64),
  'canonical source SHA-256 is stored'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'campaign.version.created'),
  1::bigint,
  'version creation is audited'
);

select extensions.throws_ok(
  $$select public.save_campaign_version(
      '51000000-0000-4000-8000-000000000001',
      (select campaign_id from campaign_test_state),
      0,
      jsonb_build_object('schemaVersion', '1.0.0', 'id', (select campaign_id::text from campaign_test_state)),
      repeat('b', 64)
    )$$,
  '40001',
  null,
  'stale expected version is rejected instead of overwriting newer work'
);

select extensions.throws_ok(
  $$select public.save_campaign_version(
      '51000000-0000-4000-8000-000000000001',
      (select campaign_id from campaign_test_state),
      1,
      jsonb_build_object('schemaVersion', '1.0.0', 'id', '00000000-0000-4000-8000-000000000099'),
      repeat('b', 64)
    )$$,
  '22023',
  null,
  'source document cannot target a different campaign id'
);

select extensions.lives_ok(
  $$select public.save_campaign_version(
      '51000000-0000-4000-8000-000000000001',
      (select campaign_id from campaign_test_state),
      1,
      jsonb_build_object(
        'schemaVersion', '1.0.0',
        'id', (select campaign_id::text from campaign_test_state),
        'name', 'Orbit Launch v2'
      ),
      repeat('c', 64)
    )$$,
  'second immutable campaign version saves from the current version'
);

select extensions.is(
  (select current_version_number from public.campaigns where id = (select campaign_id from campaign_test_state)),
  2,
  'campaign pointer advances to version two'
);

select extensions.is(
  (select count(*) from public.campaign_versions where campaign_id = (select campaign_id from campaign_test_state)),
  2::bigint,
  'campaign history keeps both immutable versions'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"50000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

select extensions.is(
  (select count(*) from public.campaigns where id = (select campaign_id from campaign_test_state)),
  0::bigint,
  'other tenant cannot read the campaign'
);

select extensions.is(
  (select count(*) from public.campaign_versions where campaign_id = (select campaign_id from campaign_test_state)),
  0::bigint,
  'other tenant cannot read immutable campaign versions'
);

reset role;
select * from extensions.finish();
rollback;
