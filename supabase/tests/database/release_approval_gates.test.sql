begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(21);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'release-owner@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'release-editor@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'release-reviewer@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'release-other-owner@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('81000000-0000-4000-8000-000000000001', 'Release Workspace A', 'release-workspace-a', '80000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000001', 'Release Workspace B', 'release-workspace-b', '80000000-0000-4000-8000-000000000004');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'owner'),
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', 'editor'),
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000003', 'reviewer'),
  ('82000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000004', 'owner');

insert into public.brands (id, workspace_id, name, slug, created_by)
values
  ('81100000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'Release Brand A', 'release-brand-a', '80000000-0000-4000-8000-000000000001'),
  ('82100000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'Release Brand B', 'release-brand-b', '80000000-0000-4000-8000-000000000004');

insert into public.campaigns (
  id, workspace_id, brand_id, name, status, current_version_number, created_by, updated_by
)
values
  ('81200000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '81100000-0000-4000-8000-000000000001', 'Release Campaign A', 'draft', 1, '80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001'),
  ('82200000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '82100000-0000-4000-8000-000000000001', 'Release Campaign B', 'draft', 1, '80000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000004');

insert into public.campaign_versions (
  workspace_id, campaign_id, version_number, source_json, source_sha256, created_by
)
values
  ('81000000-0000-4000-8000-000000000001', '81200000-0000-4000-8000-000000000001', 1, '{"schemaVersion":"1.0.0","id":"81200000-0000-4000-8000-000000000001"}'::jsonb, repeat('a', 64), '80000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000001', '82200000-0000-4000-8000-000000000001', 1, '{"schemaVersion":"1.0.0","id":"82200000-0000-4000-8000-000000000001"}'::jsonb, repeat('d', 64), '80000000-0000-4000-8000-000000000004');

create temporary table release_test_state (candidate_id uuid);
insert into release_test_state default values;
grant select, update on release_test_state to authenticated;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"80000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$update release_test_state
    set candidate_id = public.create_release_candidate(
      '81000000-0000-4000-8000-000000000001',
      '81200000-0000-4000-8000-000000000001',
      1,
      repeat('a', 64),
      repeat('b', 64),
      '0.2.0',
      'PASS',
      '{"qa":{"status":"PASS"},"rendererVersion":"0.2.0"}'::jsonb
    )$$,
  'editor can create a release candidate from the current immutable version'
);

select extensions.is(
  (select status from public.campaigns where id = '81200000-0000-4000-8000-000000000001'),
  'review'::public.campaign_status,
  'release candidate moves the campaign into review'
);

select extensions.is(
  (select count(*) from public.campaign_release_candidates),
  1::bigint,
  'release candidate is persisted for the tenant'
);

select extensions.throws_ok(
  $$select public.create_release_candidate(
      '81000000-0000-4000-8000-000000000001',
      '81200000-0000-4000-8000-000000000001',
      1, repeat('a', 64), repeat('c', 64), '0.2.0', 'BLOCK',
      '{"qa":{"status":"BLOCK"}}'::jsonb
    )$$,
  '23514',
  null,
  'blocking QA cannot become a release candidate'
);

select extensions.throws_ok(
  $$select public.create_release_candidate(
      '81000000-0000-4000-8000-000000000001',
      '81200000-0000-4000-8000-000000000001',
      1, repeat('f', 64), repeat('c', 64), '0.2.0', 'PASS',
      '{"qa":{"status":"PASS"}}'::jsonb
    )$$,
  '22023',
  null,
  'release candidate cannot lie about the source fingerprint'
);

select extensions.throws_ok(
  $$select public.record_campaign_approval(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state),
      'approved'::public.approval_decision,
      'Editor must not approve.'
    )$$,
  '42501',
  null,
  'editor cannot approve a release candidate'
);

select extensions.throws_ok(
  $$select public.record_inbox_evidence(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state),
      'gmail-web', 'manual', 'pass'::public.inbox_check_status, '', ''
    )$$,
  '42501',
  null,
  'editor cannot manufacture inbox evidence'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"80000000-0000-4000-8000-000000000003"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.record_inbox_evidence(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state),
      'gmail-web', 'manual', 'pass'::public.inbox_check_status,
      'https://evidence.example/gmail', 'Manual assisted-pilot evidence.'
    )$$,
  'reviewer can record Gmail evidence'
);

select extensions.lives_ok(
  $$select public.record_inbox_evidence(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state),
      'apple-mail', 'manual', 'pass'::public.inbox_check_status,
      'https://evidence.example/apple', 'Manual assisted-pilot evidence.'
    )$$,
  'reviewer can record Apple Mail evidence'
);

select extensions.is(
  (public.release_candidate_readiness(
    '81000000-0000-4000-8000-000000000001',
    (select candidate_id from release_test_state)
  ) ->> 'ready')::boolean,
  false,
  'release remains blocked while a required inbox client is missing'
);

select extensions.lives_ok(
  $$select public.record_inbox_evidence(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state),
      'outlook-windows', 'manual', 'pass'::public.inbox_check_status,
      'https://evidence.example/outlook', 'Manual assisted-pilot evidence.'
    )$$,
  'reviewer can record Outlook Windows evidence'
);

select extensions.is(
  (public.release_candidate_readiness(
    '81000000-0000-4000-8000-000000000001',
    (select candidate_id from release_test_state)
  ) ->> 'passed_client_count')::integer,
  3,
  'all required inbox clients are counted only after evidence exists'
);

select extensions.lives_ok(
  $$select public.record_campaign_approval(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state),
      'approved'::public.approval_decision,
      'Approved for assisted pilot.'
    )$$,
  'reviewer can create an immutable approval decision'
);

select extensions.is(
  (public.release_candidate_readiness(
    '81000000-0000-4000-8000-000000000001',
    (select candidate_id from release_test_state)
  ) ->> 'ready')::boolean,
  true,
  'release becomes ready only after inbox evidence and approval both pass'
);

select extensions.lives_ok(
  $$select public.approve_release_candidate(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state)
    )$$,
  'ready release candidate can atomically approve the campaign'
);

select extensions.is(
  (select status from public.campaigns where id = '81200000-0000-4000-8000-000000000001'),
  'approved'::public.campaign_status,
  'approved release advances campaign status but does not publish it'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'campaign.approved'),
  1::bigint,
  'campaign approval is audit logged'
);

select extensions.throws_ok(
  $$select public.record_campaign_approval(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state),
      'approved'::public.approval_decision,
      'Attempt to rewrite immutable reviewer decision.'
    )$$,
  '23505',
  null,
  'same reviewer cannot rewrite an immutable decision'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"80000000-0000-4000-8000-000000000004"}', true);
set local role authenticated;

select extensions.is(
  (select count(*) from public.campaign_release_candidates where id = (select candidate_id from release_test_state)),
  0::bigint,
  'other tenant cannot read release candidates through RLS'
);

select extensions.throws_ok(
  $$select public.release_candidate_readiness(
      '81000000-0000-4000-8000-000000000001',
      (select candidate_id from release_test_state)
    )$$,
  '42501',
  null,
  'other tenant cannot inspect release readiness'
);

select extensions.throws_ok(
  $$select public.create_release_candidate(
      '81000000-0000-4000-8000-000000000001',
      '81200000-0000-4000-8000-000000000001',
      1, repeat('a', 64), repeat('e', 64), '0.2.0', 'PASS',
      '{"qa":{"status":"PASS"}}'::jsonb
    )$$,
  '42501',
  null,
  'other tenant cannot create a release candidate in this workspace'
);

reset role;
select * from extensions.finish();
rollback;
