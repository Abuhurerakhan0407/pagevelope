begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(13);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'brief-owner-a@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'brief-owner-b@pagevelope.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('61000000-0000-4000-8000-000000000001', 'Brief Workspace A', 'brief-workspace-a', '60000000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000001', 'Brief Workspace B', 'brief-workspace-b', '60000000-0000-4000-8000-000000000002');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'owner'),
  ('62000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 'owner');

insert into public.brands (id, workspace_id, name, slug, created_by)
values
  ('61100000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'Brief Brand A', 'brief-brand-a', '60000000-0000-4000-8000-000000000001'),
  ('62100000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Brief Brand B', 'brief-brand-b', '60000000-0000-4000-8000-000000000002');

insert into public.campaigns (id, workspace_id, brand_id, name, created_by, updated_by)
values
  ('61200000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '61100000-0000-4000-8000-000000000001', 'Orbit Launch', '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'),
  ('62200000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', '62100000-0000-4000-8000-000000000001', 'Tenant B Launch', '60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"60000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.save_campaign_brief(
      '61000000-0000-4000-8000-000000000001',
      '61200000-0000-4000-8000-000000000001',
      'product-launch',
      'Launch Orbit as the everyday carry bottle.',
      'Urban professionals in Mumbai',
      'Early access with free shipping',
      'Confident and clean',
      'subtle'
    )$$,
  'editor can save a campaign brief inside the workspace'
);

select extensions.is(
  (select campaign_system from public.campaigns where id = '61200000-0000-4000-8000-000000000001'),
  'product-launch'::text,
  'approved campaign system is persisted'
);

select extensions.is(
  (select jsonb_array_length(creative_directions) from public.campaigns where id = '61200000-0000-4000-8000-000000000001'),
  3,
  'exactly three creative directions are generated'
);

select extensions.is(
  (select brief_motion_level from public.campaigns where id = '61200000-0000-4000-8000-000000000001'),
  'subtle'::text,
  'motion preference is persisted'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'campaign.brief.saved'),
  1::bigint,
  'brief save is audited'
);

select extensions.throws_ok(
  $$select public.save_campaign_brief(
      '61000000-0000-4000-8000-000000000001',
      '61200000-0000-4000-8000-000000000001',
      'made-up-system', 'Goal text', 'Audience', 'Offer', 'Tone', 'subtle'
    )$$,
  '22023',
  null,
  'unknown campaign system fails closed'
);

select extensions.throws_ok(
  $$select public.save_campaign_brief(
      '62000000-0000-4000-8000-000000000001',
      '62200000-0000-4000-8000-000000000001',
      'product-launch', 'Cross tenant goal', 'Audience', 'Offer', 'Tone', 'subtle'
    )$$,
  '42501',
  null,
  'brief save cannot cross workspace boundaries'
);

select extensions.lives_ok(
  $$select public.select_campaign_direction(
      '61000000-0000-4000-8000-000000000001',
      '61200000-0000-4000-8000-000000000001',
      'product'
    )$$,
  'editor can select one generated creative direction'
);

select extensions.is(
  (select selected_direction_key from public.campaigns where id = '61200000-0000-4000-8000-000000000001'),
  'product'::text,
  'selected direction is persisted'
);

select extensions.is(
  (select count(*) from public.audit_events where action = 'campaign.direction.selected'),
  1::bigint,
  'direction selection is audited'
);

select extensions.throws_ok(
  $$select public.select_campaign_direction(
      '61000000-0000-4000-8000-000000000001',
      '61200000-0000-4000-8000-000000000001',
      'random'
    )$$,
  '22023',
  null,
  'unknown creative direction fails closed'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"60000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

select extensions.is(
  (select count(*) from public.campaigns where id = '61200000-0000-4000-8000-000000000001'),
  0::bigint,
  'other tenant cannot read the campaign brief'
);

select extensions.throws_ok(
  $$select public.select_campaign_direction(
      '61000000-0000-4000-8000-000000000001',
      '61200000-0000-4000-8000-000000000001',
      'product'
    )$$,
  '42501',
  null,
  'other tenant cannot select a direction'
);

reset role;
select * from extensions.finish();
rollback;
