begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'klaviyo-owner-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'klaviyo-owner-b@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('81000000-0000-4000-8000-000000000001', 'Klaviyo Workspace A', 'klaviyo-workspace-a', '80000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000001', 'Klaviyo Workspace B', 'klaviyo-workspace-b', '80000000-0000-4000-8000-000000000002');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'owner'),
  ('82000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', 'owner');

insert into public.campaigns (
  id, workspace_id, name, status, current_version_number, created_by, updated_by
)
values
  ('81100000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'Approved Campaign A', 'approved', 1, '80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001'),
  ('82100000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'Approved Campaign B', 'approved', 1, '80000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002');

insert into public.campaign_versions (
  workspace_id, campaign_id, version_number, source_json, source_sha256, created_by
)
values
  ('81000000-0000-4000-8000-000000000001', '81100000-0000-4000-8000-000000000001', 1, '{}'::jsonb, repeat('a', 64), '80000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000001', '82100000-0000-4000-8000-000000000001', 1, '{}'::jsonb, repeat('b', 64), '80000000-0000-4000-8000-000000000002');

insert into public.campaign_release_candidates (
  id, workspace_id, campaign_id, version_number, source_sha256, manifest_sha256,
  renderer_version, qa_status, manifest_json, created_by
)
values
  ('81200000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '81100000-0000-4000-8000-000000000001', 1, repeat('a', 64), repeat('c', 64), '0.2.0', 'PASS', '{"qa":{"status":"PASS"}}'::jsonb, '80000000-0000-4000-8000-000000000001'),
  ('82200000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '82100000-0000-4000-8000-000000000001', 1, repeat('b', 64), repeat('d', 64), '0.2.0', 'PASS', '{"qa":{"status":"PASS"}}'::jsonb, '80000000-0000-4000-8000-000000000002');

insert into public.integration_connections (
  id, workspace_id, provider, status, external_account_id, external_account_name, scopes, connected_by
)
values
  ('81300000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'klaviyo', 'connected', 'acct-a', 'Account A', array['accounts:read','templates:write','campaigns:write'], '80000000-0000-4000-8000-000000000001'),
  ('82300000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'klaviyo', 'connected', 'acct-b', 'Account B', array['accounts:read','templates:write','campaigns:write'], '80000000-0000-4000-8000-000000000002');

insert into public.integration_credentials_secure (
  connection_id, access_token_ciphertext, refresh_token_ciphertext, access_expires_at
)
values
  ('81300000-0000-4000-8000-000000000001', 'v1.test.test.test', 'v1.test.test.test', now() + interval '1 hour'),
  ('82300000-0000-4000-8000-000000000001', 'v1.test.test.test', 'v1.test.test.test', now() + interval '1 hour');

select extensions.ok(
  not has_table_privilege('authenticated', 'public.integration_credentials_secure', 'SELECT'),
  'authenticated role cannot read encrypted OAuth credential rows'
);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"80000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.record_klaviyo_publish_receipt(
      '81000000-0000-4000-8000-000000000001',
      '81200000-0000-4000-8000-000000000001',
      '81300000-0000-4000-8000-000000000001',
      '2026-07-15', 'forged-template', 'forged-campaign', 'forged-message'
    )$$,
  '42501', null,
  'authenticated editor cannot forge a provider-confirmed publish receipt'
);

reset role;
set local role service_role;
select extensions.lives_ok(
  $$select public.record_klaviyo_publish_receipt_server(
      '81000000-0000-4000-8000-000000000001',
      '81200000-0000-4000-8000-000000000001',
      '81300000-0000-4000-8000-000000000001',
      '2026-07-15', 'tpl-a', 'campaign-a', 'message-a',
      '80000000-0000-4000-8000-000000000001'
    )$$,
  'service role can record provider-confirmed Klaviyo completion for an authorized actor'
);
reset role;

select extensions.is(
  (select count(*) from public.campaign_publish_receipts where release_candidate_id = '81200000-0000-4000-8000-000000000001'),
  1::bigint,
  'one immutable publish receipt is stored'
);
select extensions.is(
  (select status::text from public.campaigns where id = '81100000-0000-4000-8000-000000000001'),
  'published'::text,
  'successful receipt advances campaign to published'
);
select extensions.is(
  (select count(*) from public.audit_events where action = 'campaign.published.klaviyo'),
  1::bigint,
  'Klaviyo publish is audited'
);

set local role service_role;
select extensions.throws_ok(
  $$select public.record_klaviyo_publish_receipt_server(
      '81000000-0000-4000-8000-000000000001',
      '81200000-0000-4000-8000-000000000001',
      '81300000-0000-4000-8000-000000000001',
      '2026-07-15', 'tpl-a', '', '',
      '80000000-0000-4000-8000-000000000001'
    )$$,
  '40001', null,
  'already-published campaign cannot be published again through the server receipt RPC'
);
select extensions.throws_ok(
  $$select public.record_klaviyo_publish_receipt_server(
      '82000000-0000-4000-8000-000000000001',
      '82200000-0000-4000-8000-000000000001',
      '82300000-0000-4000-8000-000000000001',
      '2026-07-15', 'tpl-b', '', '',
      '80000000-0000-4000-8000-000000000001'
    )$$,
  '42501', null,
  'server receipt cannot attribute a cross-workspace actor'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"80000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select extensions.is(
  (select count(*) from public.campaign_publish_receipts where release_candidate_id = '81200000-0000-4000-8000-000000000001'),
  0::bigint,
  'other tenant cannot read publish receipt'
);

reset role;
select * from extensions.finish();
rollback;
