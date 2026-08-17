begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  '93000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'ordering-owner@pagevelope.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into public.workspaces (id, name, slug, created_by)
values ('93100000-0000-4000-8000-000000000001', 'Ordering Workspace', 'ordering-workspace', '93000000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role)
values ('93100000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'owner');

insert into public.brands (id, workspace_id, name, slug, created_by)
values ('93200000-0000-4000-8000-000000000001', '93100000-0000-4000-8000-000000000001', 'Ordering Brand', 'ordering-brand', '93000000-0000-4000-8000-000000000001');

insert into public.campaigns (
  id, workspace_id, brand_id, name, status, current_version_number, created_by, updated_by
)
values (
  '93300000-0000-4000-8000-000000000001', '93100000-0000-4000-8000-000000000001',
  '93200000-0000-4000-8000-000000000001', 'Ordering Campaign', 'draft', 1,
  '93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001'
);

insert into public.campaign_versions (
  workspace_id, campaign_id, version_number, source_json, source_sha256, created_by
)
values (
  '93100000-0000-4000-8000-000000000001', '93300000-0000-4000-8000-000000000001',
  1, '{"schemaVersion":"1.0.0","id":"93300000-0000-4000-8000-000000000001"}'::jsonb,
  repeat('a', 64), '93000000-0000-4000-8000-000000000001'
);

create temporary table ordering_test_state (candidate_id uuid, attempt_id uuid);
insert into ordering_test_state default values;
grant select, update on ordering_test_state to authenticated, service_role;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"93000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$update ordering_test_state set candidate_id = public.create_release_candidate(
    '93100000-0000-4000-8000-000000000001', '93300000-0000-4000-8000-000000000001',
    1, repeat('a', 64), repeat('b', 64), '0.2.0', 'PASS',
    '{"qa":{"status":"PASS"},"rendererVersion":"0.2.0"}'::jsonb
  )$$,
  'current immutable release can enter review'
);

select extensions.is(
  (select count(*) from public.inbox_evidence where release_candidate_id = (select candidate_id from ordering_test_state)),
  0::bigint,
  'release starts with no inbox evidence'
);

select extensions.lives_ok(
  $$update ordering_test_state set attempt_id = public.create_test_send_attempt(
    '93100000-0000-4000-8000-000000000001',
    (select candidate_id from ordering_test_state),
    'pilot-inbox@pagevelope.test'
  )$$,
  'editor can queue the exact release before inbox evidence exists'
);

select extensions.is(
  (select status from public.campaign_test_sends where id = (select attempt_id from ordering_test_state)),
  'queued'::public.test_send_status,
  'pre-evidence test send is persisted as queued'
);

select extensions.is(
  (public.release_candidate_readiness(
    '93100000-0000-4000-8000-000000000001',
    (select candidate_id from ordering_test_state)
  ) ->> 'ready')::boolean,
  false,
  'final release readiness still fails closed without inbox evidence, provider success, and approval'
);

reset role;
select * from extensions.finish();
rollback;
