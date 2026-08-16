begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  '73000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'product-integrity@pagevelope.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '73100000-0000-4000-8000-000000000001',
  'Product Integrity Workspace',
  'product-integrity-workspace',
  '73000000-0000-4000-8000-000000000001'
);

insert into public.workspace_memberships (workspace_id, user_id, role)
values (
  '73100000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  'owner'
);

insert into public.brands (id, workspace_id, name, slug, created_by)
values
  ('73200000-0000-4000-8000-000000000001', '73100000-0000-4000-8000-000000000001', 'Brand A', 'integrity-brand-a', '73000000-0000-4000-8000-000000000001'),
  ('73200000-0000-4000-8000-000000000002', '73100000-0000-4000-8000-000000000001', 'Brand B', 'integrity-brand-b', '73000000-0000-4000-8000-000000000001');

insert into public.campaigns (id, workspace_id, brand_id, name, created_by, updated_by)
values (
  '73300000-0000-4000-8000-000000000001',
  '73100000-0000-4000-8000-000000000001',
  '73200000-0000-4000-8000-000000000001',
  'Integrity Campaign',
  '73000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001'
);

create temporary table integrity_product_state (
  product_a uuid,
  product_b uuid,
  product_c uuid
);
insert into integrity_product_state default values;
grant select, update on integrity_product_state to authenticated;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$update integrity_product_state
    set product_a = public.create_manual_product(
      '73100000-0000-4000-8000-000000000001',
      '73200000-0000-4000-8000-000000000001',
      'Brand A Product', 'A-001', 1000, 'INR',
      'https://images.example.com/a.jpg', 'https://example.com/a'
    )$$,
  'brand A product can be created'
);

select extensions.lives_ok(
  $$update integrity_product_state
    set product_b = public.create_manual_product(
      '73100000-0000-4000-8000-000000000001',
      '73200000-0000-4000-8000-000000000002',
      'Brand B Product', 'B-001', 1200, 'INR',
      'https://images.example.com/b.jpg', 'https://example.com/b'
    )$$,
  'brand B product can be created in the same workspace'
);

select extensions.throws_ok(
  $$insert into public.campaign_products (workspace_id, campaign_id, product_id, position)
    values (
      '73100000-0000-4000-8000-000000000001',
      '73300000-0000-4000-8000-000000000001',
      (select product_b from integrity_product_state),
      1
    )$$,
  '23514',
  null,
  'direct same-workspace cross-brand product insertion fails closed'
);

select extensions.lives_ok(
  $$insert into public.campaign_products (workspace_id, campaign_id, product_id, position)
    values (
      '73100000-0000-4000-8000-000000000001',
      '73300000-0000-4000-8000-000000000001',
      (select product_a from integrity_product_state),
      1
    )$$,
  'direct same-brand campaign product insertion remains valid'
);

select extensions.is(
  (select product_selection_completed_at from public.campaigns where id = '73300000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'raw campaign-product mutation does not silently mark the product gate complete'
);

select extensions.lives_ok(
  $$update public.campaigns
    set product_selection_completed_at = now(),
        updated_by = '73000000-0000-4000-8000-000000000001'
    where id = '73300000-0000-4000-8000-000000000001'$$,
  'product gate can only become complete when a valid product row actually exists'
);

select extensions.lives_ok(
  $$select public.save_campaign_brief(
      '73100000-0000-4000-8000-000000000001',
      '73300000-0000-4000-8000-000000000001',
      'product-launch',
      'Launch the selected product cleanly.',
      'Existing buyers',
      'Free shipping',
      'Confident',
      'subtle'
    )$$,
  'brief can complete after a real product selection exists'
);

select extensions.ok(
  (select brief_completed_at is not null from public.campaigns where id = '73300000-0000-4000-8000-000000000001'),
  'brief is marked complete before the selection changes'
);

select extensions.lives_ok(
  $$update integrity_product_state
    set product_c = public.create_manual_product(
      '73100000-0000-4000-8000-000000000001',
      '73200000-0000-4000-8000-000000000001',
      'Brand A Product Two', 'A-002', 1500, 'INR',
      'https://images.example.com/a-two.jpg', 'https://example.com/a-two'
    )$$,
  'a second same-brand product can be created'
);

select extensions.lives_ok(
  $$insert into public.campaign_products (workspace_id, campaign_id, product_id, position)
    values (
      '73100000-0000-4000-8000-000000000001',
      '73300000-0000-4000-8000-000000000001',
      (select product_c from integrity_product_state),
      2
    )$$,
  'changing campaign products directly invalidates downstream campaign state'
);

select extensions.is(
  (select product_selection_completed_at from public.campaigns where id = '73300000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'product change clears the product-completion marker'
);

select extensions.is(
  (select brief_completed_at from public.campaigns where id = '73300000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'product change clears the stale brief'
);

select extensions.is(
  (select jsonb_array_length(creative_directions) from public.campaigns where id = '73300000-0000-4000-8000-000000000001'),
  0,
  'product change clears stale creative directions'
);

select extensions.lives_ok(
  $$select public.set_campaign_products(
      '73100000-0000-4000-8000-000000000001',
      '73300000-0000-4000-8000-000000000001',
      array[
        (select product_a from integrity_product_state),
        (select product_c from integrity_product_state)
      ]::uuid[]
    )$$,
  'controlled product setter can re-establish the valid selection'
);

select extensions.ok(
  (select product_selection_completed_at is not null from public.campaigns where id = '73300000-0000-4000-8000-000000000001'),
  'controlled setter marks the product gate complete'
);

select extensions.is(
  (select count(*) from public.campaign_products where campaign_id = '73300000-0000-4000-8000-000000000001'),
  2::bigint,
  'controlled setter leaves exactly the intended valid product selection'
);

reset role;
select * from extensions.finish();
rollback;
