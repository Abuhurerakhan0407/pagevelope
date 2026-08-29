begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'product-owner-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'product-owner-b@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('71000000-0000-4000-8000-000000000001', 'Product Workspace A', 'product-workspace-a', '70000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000001', 'Product Workspace B', 'product-workspace-b', '70000000-0000-4000-8000-000000000002');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'owner'),
  ('72000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', 'owner');

insert into public.brands (id, workspace_id, name, slug, created_by)
values
  ('71100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Product Brand A', 'product-brand-a', '70000000-0000-4000-8000-000000000001'),
  ('72100000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'Product Brand B', 'product-brand-b', '70000000-0000-4000-8000-000000000002');

insert into public.campaigns (id, workspace_id, brand_id, name, created_by, updated_by)
values
  ('71200000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '71100000-0000-4000-8000-000000000001', 'Product Launch A', '70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001'),
  ('72200000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '72100000-0000-4000-8000-000000000001', 'Product Launch B', '70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002');

create temporary table product_test_state (product_id uuid not null);
grant select, insert on product_test_state to authenticated;

-- Historical workflow tests exercise paid workspace capabilities.
update public.workspace_subscriptions
set tier = 'pro', status = 'active', current_period_end = now() + interval '30 days';

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"70000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.save_campaign_brief(
      '71000000-0000-4000-8000-000000000001',
      '71200000-0000-4000-8000-000000000001',
      'product-launch', 'Launch the collection', 'Past buyers', 'Free shipping', 'Premium', 'subtle'
    )$$,
  '23514',
  null,
  'brief cannot be completed before products are selected'
);

select extensions.lives_ok(
  $$insert into product_test_state (product_id)
    select public.create_manual_product(
      '71000000-0000-4000-8000-000000000001',
      '71100000-0000-4000-8000-000000000001',
      'Orbit Bottle', 'ORB-001', 2499.00, 'inr',
      'https://images.example.com/orbit.jpg',
      'https://example.com/products/orbit'
    )$$,
  'editor can create a manual product inside the brand'
);

select extensions.is(
  (select count(*) from public.products),
  1::bigint,
  'tenant sees its created product'
);

select extensions.is(
  (select currency from public.products where id = (select product_id from product_test_state)),
  'INR'::text,
  'currency is normalized to uppercase'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'product.created'),
  1::bigint,
  'product creation is audited'
);

select extensions.throws_ok(
  $$select public.create_manual_product(
      '71000000-0000-4000-8000-000000000001',
      '71100000-0000-4000-8000-000000000001',
      'Unsafe Product', '', 10, 'INR', 'http://unsafe.example/image.jpg', 'https://example.com/product'
    )$$,
  '22023',
  null,
  'non-HTTPS image URL fails closed'
);

select extensions.throws_ok(
  $$select public.create_manual_product(
      '72000000-0000-4000-8000-000000000001',
      '72100000-0000-4000-8000-000000000001',
      'Cross Tenant Product', '', 10, 'INR', '', ''
    )$$,
  '42501',
  null,
  'product creation cannot cross workspaces'
);

select extensions.lives_ok(
  $$select public.set_campaign_products(
      '71000000-0000-4000-8000-000000000001',
      '71200000-0000-4000-8000-000000000001',
      array[(select product_id from product_test_state)]::uuid[]
    )$$,
  'editor can bind one brand product to the draft campaign'
);

select extensions.is(
  (select count(*) from public.campaign_products where campaign_id = '71200000-0000-4000-8000-000000000001'),
  1::bigint,
  'campaign product selection is persisted'
);

select extensions.ok(
  (select product_selection_completed_at is not null from public.campaigns where id = '71200000-0000-4000-8000-000000000001'),
  'product-selection gate is marked complete'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'campaign.products.updated'),
  1::bigint,
  'campaign product selection is audited'
);

select extensions.lives_ok(
  $$select public.save_campaign_brief(
      '71000000-0000-4000-8000-000000000001',
      '71200000-0000-4000-8000-000000000001',
      'product-launch', 'Launch the collection', 'Past buyers', 'Free shipping', 'Premium', 'subtle'
    )$$,
  'brief can be completed after product selection'
);

select extensions.throws_ok(
  $$select public.set_campaign_products(
      '71000000-0000-4000-8000-000000000001',
      '71200000-0000-4000-8000-000000000001',
      array[(select product_id from product_test_state), (select product_id from product_test_state)]::uuid[]
    )$$,
  '22023',
  null,
  'duplicate product selection fails closed'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"70000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

select extensions.is(
  (select count(*) from public.products where id = (select product_id from product_test_state)),
  0::bigint,
  'other tenant cannot read the product'
);

select extensions.throws_ok(
  $$select public.set_campaign_products(
      '71000000-0000-4000-8000-000000000001',
      '71200000-0000-4000-8000-000000000001',
      array[(select product_id from product_test_state)]::uuid[]
    )$$,
  '42501',
  null,
  'other tenant cannot change campaign products'
);

reset role;
select * from extensions.finish();
rollback;
