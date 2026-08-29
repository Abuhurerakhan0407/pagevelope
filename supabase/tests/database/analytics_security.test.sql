begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'analytics-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'analytics-b@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('41000000-0000-4000-8000-000000000001', 'Analytics A', 'analytics-a', '40000000-0000-4000-8000-000000000001'),
  ('41000000-0000-4000-8000-000000000002', 'Analytics B', 'analytics-b', '40000000-0000-4000-8000-000000000002');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'owner'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'owner');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"40000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$insert into public.analytics_events (event_name, workspace_id, user_id) values ('campaign_created', '41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001')$$,
  'user can append own workspace event'
);
select extensions.throws_ok(
  $$insert into public.analytics_events (event_name, workspace_id, user_id) values ('campaign_created', '41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'user cannot append event to another workspace'
);
select extensions.throws_ok(
  $$insert into public.analytics_events (event_name, workspace_id, user_id) values ('campaign_created', '41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'user cannot spoof another actor'
);
select extensions.throws_ok(
  $$insert into public.analytics_events (event_name, user_id) values ('invented_event', '40000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'unknown event names fail closed'
);
select extensions.throws_ok(
  $$delete from public.analytics_events where workspace_id = '41000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'analytics remains append-only'
);
reset role;

select * from extensions.finish();
rollback;
