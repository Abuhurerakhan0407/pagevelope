begin;

create type public.subscription_tier as enum ('free', 'starter', 'pro', 'agency');
create type public.subscription_status as enum ('active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing', 'paused');

create table public.workspace_subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  tier public.subscription_tier not null default 'free',
  status public.subscription_status not null default 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_subscriptions enable row level security;

create policy subscriptions_select_member
on public.workspace_subscriptions for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy subscriptions_update_admin
on public.workspace_subscriptions for update
to authenticated
using (private.can_admin_workspace(workspace_id))
with check (private.can_admin_workspace(workspace_id));

create policy subscriptions_insert_admin
on public.workspace_subscriptions for insert
to authenticated
with check (private.can_admin_workspace(workspace_id));

grant select, insert, update on public.workspace_subscriptions to authenticated;

-- Function to handle setting initial subscription tier on workspace creation
create or replace function private.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_subscriptions (workspace_id, tier, status)
  values (new.id, 'free'::public.subscription_tier, 'active'::public.subscription_status);
  return new;
end;
$$;

create trigger on_workspace_created
after insert on public.workspaces
for each row execute function private.handle_new_workspace();

commit;
