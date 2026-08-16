begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(4);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  '74000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'product-delete-integrity@pagevelope.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '74100000-0000-4000-8000-000000000001',
  'Product Delete Workspace',
  'product-delete-workspace',
  '74000000-0000-4000-8000-000000000001'
);

insert into public.workspace_memberships (workspace_id, user_id, role)
values (
  '74100000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000001',
  'owner'
);

insert into public.brands (id, workspace_id, name, slug, created_by)
values (
  '74200000-0000-4000-8000-000000000001',
  '74100000-0000-4000-8000-000000000001',
  'Delete Brand',
  'delete-brand',
  '74000000-0000-4000-8000-000000000001'
);

insert into public.campaigns (id, workspace_id, brand_id, name, created_by, updated_by)
values (
  '74300000-0000-4000-8000-000000000001',
  '74100000-0000-4000-8000-000000000001',
  '74200000-0000-4000-8000-000000000001',
  'Delete Integrity Campaign',
  '74000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000001'
);

create temporary table delete_product_state (product_id uuid);
insert into delete_product_state default values;
grant select, update on delete_product_state to authenticated;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

update delete_product_state
set product_id = public.create_manual_product(
  '74100000-0000-4000-8000-000000000001',
  '74200000-0000-4000-8000-000000000001',
  'Delete Product', 'DEL-001', 999, 'INR',
  'https://images.example.com/delete.jpg', 'https://example.com/delete'
);

select public.set_campaign_products(
  '74100000-0000-4000-8000-000000000001',
  '74300000-0000-4000-8000-000000000001',
  array[(select product_id from delete_product_state)]::uuid[]
);

select public.save_campaign_brief(
  '74100000-0000-4000-8000-000000000001',
  '74300000-0000-4000-8000-000000000001',
  'product-launch',
  'Validate delete invalidation.',
  'Existing buyers',
  'Free shipping',
  'Confident',
  'subtle'
);

select extensions.throws_ok(
  $$delete from public.campaign_products
    where campaign_id = '74300000-0000-4000-8000-000000000001'
      and product_id = (select product_id from delete_product_state)$$,
  '42501',
  null,
  'authenticated clients cannot delete campaign-product links outside the audited RPC'
);

reset role;

select extensions.lives_ok(
  $$delete from public.campaign_products
    where campaign_id = '74300000-0000-4000-8000-000000000001'
      and product_id = (select product_id from delete_product_state)$$,
  'database-level campaign product deletion completes without NEW-record trigger errors'
);

set local role authenticated;

select extensions.is(
  (select product_selection_completed_at from public.campaigns where id = '74300000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'deleting a selected product clears the product gate'
);

select extensions.is(
  (select brief_completed_at from public.campaigns where id = '74300000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'deleting a selected product clears the stale brief'
);

reset role;
select * from extensions.finish();
rollback;
