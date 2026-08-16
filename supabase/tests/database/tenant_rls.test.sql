begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(17);

-- Fixed UUIDs make failures easy to reproduce in CI.
-- Users 1-5 belong to workspace A with one role each; user 6 owns workspace B;
-- user 7 is an unaffiliated candidate used for membership-management tests.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'editor-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'reviewer-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'viewer-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'owner-b@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'candidate@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000001', 'Workspace A', 'workspace-a', '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', 'Workspace B', 'workspace-b', '00000000-0000-4000-8000-000000000006');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'admin'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'editor'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'reviewer'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'viewer'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'owner');

insert into public.brands (id, workspace_id, name, slug, created_by)
values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Brand A', 'brand-a', '00000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Brand B', 'brand-b', '00000000-0000-4000-8000-000000000006');

insert into public.campaigns (id, workspace_id, brand_id, name, created_by, updated_by)
values
  ('12000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Campaign A', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('22000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Campaign B', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006');

insert into public.assets (id, workspace_id, brand_id, kind, object_path, mime_type, byte_size, sha256, created_by)
values
  ('13000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'original', '10000000-0000-4000-8000-000000000001/originals/a.png', 'image/png', 10, repeat('a', 64), '00000000-0000-4000-8000-000000000001'),
  ('23000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'original', '20000000-0000-4000-8000-000000000001/originals/b.png', 'image/png', 10, repeat('b', 64), '00000000-0000-4000-8000-000000000006');

insert into public.audit_events (workspace_id, actor_user_id, action, entity_type, entity_id)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'seed', 'campaign', '12000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'seed', 'campaign', '22000000-0000-4000-8000-000000000001');

insert into storage.objects (bucket_id, name)
values
  ('pagevelope-originals', '10000000-0000-4000-8000-000000000001/originals/a.png'),
  ('pagevelope-originals', '20000000-0000-4000-8000-000000000001/originals/b.png');

-- OWNER A: only tenant A is visible; owner can add non-owner members; last-owner guard blocks self-removal.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select extensions.is((select count(*) from public.workspaces), 1::bigint, 'owner sees only their workspace');
select extensions.is((select count(*) from public.brands), 1::bigint, 'owner cannot read another tenant brand');
select extensions.lives_ok(
  $$insert into public.workspace_memberships (workspace_id, user_id, role) values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007', 'admin')$$,
  'owner can add an admin'
);
select extensions.throws_ok(
  $$delete from public.workspace_memberships where workspace_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000001'$$,
  'P0001',
  null,
  'last workspace owner cannot remove themselves'
);
reset role;

-- ADMIN A: can update workspace and remove non-owner members, but cannot grant owner.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select extensions.is(
  (with changed as (update public.workspaces set name = 'Workspace A updated' where id = '10000000-0000-4000-8000-000000000001' returning id) select count(*) from changed),
  1::bigint,
  'admin can update workspace settings'
);
select extensions.throws_ok(
  $$update public.workspace_memberships set role = 'owner' where workspace_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000007'$$,
  '42501',
  null,
  'admin cannot promote a member to owner'
);
select extensions.is(
  (with removed as (delete from public.workspace_memberships where workspace_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000007' returning user_id) select count(*) from removed),
  1::bigint,
  'admin can remove a non-owner member'
);
select extensions.is((select count(*) from public.audit_events), 1::bigint, 'admin can read only own workspace audit events');
reset role;

-- EDITOR A: can create campaign data in tenant A, but cannot cross tenant boundary and cannot read audit events.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003"}', true);
set local role authenticated;
select extensions.lives_ok(
  $$insert into public.campaigns (workspace_id, brand_id, name, created_by, updated_by) values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Editor campaign', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003')$$,
  'editor can create campaign in own workspace'
);
select extensions.throws_ok(
  $$insert into public.brands (workspace_id, name, slug, created_by) values ('20000000-0000-4000-8000-000000000001', 'Cross tenant', 'cross-tenant', '00000000-0000-4000-8000-000000000003')$$,
  '42501',
  null,
  'editor cannot write into another workspace'
);
select extensions.is((select count(*) from public.audit_events), 0::bigint, 'editor cannot read audit log');
select extensions.lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('pagevelope-originals', '10000000-0000-4000-8000-000000000001/originals/editor.png')$$,
  'editor can insert private original in own workspace path'
);
reset role;

-- REVIEWER A: read access only; campaign writes fail closed.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004"}', true);
set local role authenticated;
select extensions.is((select count(*) from public.campaigns where workspace_id = '10000000-0000-4000-8000-000000000001'), 2::bigint, 'reviewer can read workspace campaigns');
select extensions.throws_ok(
  $$insert into public.campaigns (workspace_id, brand_id, name, created_by, updated_by) values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Reviewer write', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004')$$,
  '42501',
  null,
  'reviewer cannot create campaigns'
);
reset role;

-- VIEWER A: can read own workspace content and private originals, cannot mutate asset metadata or storage.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000005"}', true);
set local role authenticated;
select extensions.is((select count(*) from public.assets), 1::bigint, 'viewer sees only own workspace asset metadata');
select extensions.is((select count(*) from storage.objects where bucket_id = 'pagevelope-originals'), 2::bigint, 'viewer sees own original objects only, including editor upload');
select extensions.throws_ok(
  $$insert into public.assets (workspace_id, brand_id, kind, object_path, mime_type, byte_size, sha256, created_by) values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'original', '10000000-0000-4000-8000-000000000001/originals/viewer.png', 'image/png', 10, repeat('c', 64), '00000000-0000-4000-8000-000000000005')$$,
  '42501',
  null,
  'viewer cannot create asset metadata'
);
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('pagevelope-originals', '10000000-0000-4000-8000-000000000001/originals/viewer.png')$$,
  '42501',
  null,
  'viewer cannot upload private originals'
);
reset role;

select * from extensions.finish();
rollback;
