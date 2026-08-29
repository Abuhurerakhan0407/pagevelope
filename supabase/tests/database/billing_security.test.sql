begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(11);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.razorpay_webhook_events', 'SELECT'),
  'authenticated users cannot read billing webhook receipts'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.razorpay_webhook_events', 'INSERT'),
  'service role can record billing webhook receipts'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.billing_checkout_locks', 'SELECT'),
  'authenticated users cannot read checkout locks'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.billing_checkout_locks', 'INSERT'),
  'service role can serialize checkout creation'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'billing-owner@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values ('31000000-0000-4000-8000-000000000001', 'Billing workspace', 'billing-workspace', '30000000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role)
values ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'owner');

select extensions.is(
  (select status::text from public.workspace_subscriptions where workspace_id = '31000000-0000-4000-8000-000000000001'),
  'incomplete',
  'new workspaces start unpaid'
);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"30000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.is((select count(*) from public.workspace_subscriptions), 1::bigint, 'owner can read subscription');
select extensions.throws_ok(
  $$update public.workspace_subscriptions set tier = 'agency', status = 'active' where workspace_id = '31000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot self-upgrade'
);
select extensions.throws_ok(
  $$delete from public.workspace_subscriptions where workspace_id = '31000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot delete billing state'
);
select extensions.is(private.can_edit_workspace('31000000-0000-4000-8000-000000000001'), false, 'unpaid owner cannot edit content');
reset role;

update public.workspace_subscriptions
set tier = 'pro', status = 'active', current_period_end = now() + interval '30 days'
where workspace_id = '31000000-0000-4000-8000-000000000001';

set local role authenticated;
select extensions.is(private.can_edit_workspace('31000000-0000-4000-8000-000000000001'), true, 'paid owner can edit content');
reset role;

update public.workspace_subscriptions
set status = 'canceled', cancel_at_period_end = true
where workspace_id = '31000000-0000-4000-8000-000000000001';

set local role authenticated;
select extensions.is(private.can_edit_workspace('31000000-0000-4000-8000-000000000001'), true, 'canceled subscription retains access through paid period');
reset role;

update public.workspace_subscriptions
set current_period_end = now() - interval '1 minute'
where workspace_id = '31000000-0000-4000-8000-000000000001';

set local role authenticated;
select extensions.is(private.can_edit_workspace('31000000-0000-4000-8000-000000000001'), false, 'access ends after paid period');
reset role;

select * from extensions.finish();
rollback;
