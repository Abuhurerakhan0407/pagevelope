begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'shopify-owner-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'shopify-owner-b@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('91000000-0000-4000-8000-000000000001', 'Shopify Workspace A', 'shopify-workspace-a', '90000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000001', 'Shopify Workspace B', 'shopify-workspace-b', '90000000-0000-4000-8000-000000000002');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'owner'),
  ('92000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'owner');

insert into public.brands (id, workspace_id, name, slug, created_by)
values
  ('91100000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Shopify Brand A', 'shopify-brand-a', '90000000-0000-4000-8000-000000000001'),
  ('92100000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Shopify Brand B', 'shopify-brand-b', '90000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"90000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.upsert_shopify_product(
      '91000000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000001',
      'gid://shopify/Product/1', 'Forged product', 'FORGED', 1, 'INR', '', '', now()
    )$$,
  '42501', null,
  'authenticated editor cannot forge a Shopify-sourced product'
);

reset role;
set local role service_role;

select extensions.lives_ok(
  $$select public.upsert_shopify_product_server(
      '91000000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000001',
      'gid://shopify/Product/1', 'Orbit Bottle', 'ORB-SHOP', 2499, 'inr',
      'https://cdn.shopify.com/orbit.jpg', 'https://example.myshopify.com/products/orbit', now(),
      '90000000-0000-4000-8000-000000000001'
    )$$,
  'service role can sync a Shopify product for an authorized workspace actor'
);

select extensions.is(
  (select source::text from public.products where external_id = 'gid://shopify/Product/1'),
  'shopify'::text,
  'synced product is marked as Shopify source'
);

select extensions.is(
  (select currency from public.products where external_id = 'gid://shopify/Product/1'),
  'INR'::text,
  'Shopify currency is normalized'
);

select extensions.lives_ok(
  $$select public.upsert_shopify_product_server(
      '91000000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000001',
      'gid://shopify/Product/1', 'Orbit Bottle Updated', 'ORB-SHOP', 2599, 'INR',
      'https://cdn.shopify.com/orbit-new.jpg', 'https://example.myshopify.com/products/orbit', now(),
      '90000000-0000-4000-8000-000000000001'
    )$$,
  'repeat provider sync updates the same external product'
);

select extensions.is(
  (select count(*) from public.products where external_id = 'gid://shopify/Product/1'),
  1::bigint,
  'repeat provider sync does not duplicate Shopify products'
);

select extensions.throws_ok(
  $$select public.upsert_shopify_product_server(
      '92000000-0000-4000-8000-000000000001',
      '92100000-0000-4000-8000-000000000001',
      'gid://shopify/Product/2', 'Cross tenant', '', 10, 'INR', '', '', now(),
      '90000000-0000-4000-8000-000000000001'
    )$$,
  '42501', null,
  'server sync cannot attribute a cross-workspace actor'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"90000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

select extensions.is(
  (select count(*) from public.products where external_id = 'gid://shopify/Product/1'),
  0::bigint,
  'other tenant cannot read synced Shopify products'
);

reset role;
select * from extensions.finish();
rollback;
