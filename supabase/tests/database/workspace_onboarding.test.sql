begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'onboarding@pagevelope.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"30000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.create_workspace('Northstar Studio', 'northstar-studio')$$,
  'authenticated user can create a workspace atomically'
);

select extensions.is(
  (select count(*) from public.workspaces where slug = 'northstar-studio'),
  1::bigint,
  'workspace row is created'
);

select extensions.is(
  (select count(*) from public.workspace_memberships wm join public.workspaces w on w.id = wm.workspace_id where w.slug = 'northstar-studio' and wm.user_id = '30000000-0000-4000-8000-000000000001' and wm.role = 'owner'),
  1::bigint,
  'creator becomes owner'
);

select extensions.is(
  (select count(*) from public.audit_events ae join public.workspaces w on w.id = ae.workspace_id where w.slug = 'northstar-studio' and ae.action = 'workspace.created'),
  1::bigint,
  'workspace creation is audited'
);

select extensions.throws_ok(
  $$select public.create_workspace('Bad Slug', 'Bad Slug!')$$,
  '22023',
  null,
  'invalid slug fails closed'
);

select extensions.throws_ok(
  $$select public.create_workspace('Duplicate', 'northstar-studio')$$,
  '23505',
  null,
  'duplicate slug cannot create a second workspace'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.create_workspace('Anonymous Workspace', 'anonymous-workspace')$$,
  '42501',
  null,
  'missing authenticated identity is rejected'
);
reset role;

select * from extensions.finish();
rollback;
