-- Launch security hardening.
-- This migration is authored for review only and must not be applied without
-- production access, migration parity, backups, and explicit authorization.

begin;

-- Billing state belongs to trusted server integrations. Workspace admins may
-- read it but must never be able to grant themselves a paid tier or status.
drop policy if exists subscriptions_insert_admin on public.workspace_subscriptions;
drop policy if exists subscriptions_update_admin on public.workspace_subscriptions;
revoke insert, update, delete on public.workspace_subscriptions from authenticated;
grant select on public.workspace_subscriptions to authenticated;
grant select, insert, update, delete on public.workspace_subscriptions to service_role;

create table public.razorpay_webhook_events (
  event_id text primary key check (char_length(event_id) between 16 and 200),
  event_name text not null check (char_length(event_name) between 1 and 120),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  processed_at timestamptz not null default now()
);

alter table public.razorpay_webhook_events enable row level security;
revoke all on public.razorpay_webhook_events from public, anon, authenticated;
grant select, insert on public.razorpay_webhook_events to service_role;

create table public.billing_checkout_locks (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table public.billing_checkout_locks enable row level security;
revoke all on public.billing_checkout_locks from public, anon, authenticated;
grant select, insert, delete on public.billing_checkout_locks to service_role;

create unique index workspace_subscriptions_razorpay_subscription_unique
on public.workspace_subscriptions (razorpay_subscription_id)
where razorpay_subscription_id is not null;

alter table public.workspace_subscriptions
  alter column status set default 'incomplete'::public.subscription_status;

update public.workspace_subscriptions
set status = 'incomplete'::public.subscription_status,
    updated_at = now()
where tier = 'free'::public.subscription_tier
  and status = 'active'::public.subscription_status
  and razorpay_subscription_id is null;

create or replace function private.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_subscriptions (workspace_id, tier, status)
  values (new.id, 'free'::public.subscription_tier, 'incomplete'::public.subscription_status);
  return new;
end;
$$;

create or replace function private.has_active_paid_subscription(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_subscriptions ws
    where ws.workspace_id = target_workspace_id
      and ws.tier in (
        'starter'::public.subscription_tier,
        'pro'::public.subscription_tier,
        'agency'::public.subscription_tier
      )
      and (
        (
          ws.status = 'active'::public.subscription_status
          and (ws.current_period_end is null or ws.current_period_end > now())
        )
        or (
          ws.status = 'canceled'::public.subscription_status
          and ws.cancel_at_period_end
          and ws.current_period_end > now()
        )
      )
  );
$$;

create or replace function private.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.workspace_role_for(target_workspace_id) in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'editor'::public.workspace_role
    ),
    false
  ) and private.has_active_paid_subscription(target_workspace_id);
$$;

revoke all on function private.has_active_paid_subscription(uuid) from public, anon;
grant execute on function private.has_active_paid_subscription(uuid) to authenticated, service_role;

-- Analytics accepts only known events for the signed-in user and their own
-- workspace. It remains append-only for application users.
drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert_own
on public.analytics_events for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    workspace_id is null
    or private.is_workspace_member(workspace_id)
  )
);

revoke update, delete, truncate on public.analytics_events from authenticated;
grant select, insert on public.analytics_events to authenticated;

alter table public.analytics_events
  add constraint analytics_events_known_name_check
  check (event_name in (
    'signup',
    'workspace_created',
    'brand_created',
    'campaign_created',
    'render_success',
    'render_failed',
    'test_send_success',
    'test_send_failed',
    'release_created',
    'approval_submitted',
    'publish_success',
    'publish_failed',
    'subscription_created',
    'subscription_upgraded'
  )) not valid;

commit;
