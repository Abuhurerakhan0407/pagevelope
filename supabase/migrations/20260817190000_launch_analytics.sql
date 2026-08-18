-- Create analytics events table
create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_event_name_idx on public.analytics_events(event_name);
create index analytics_events_workspace_id_idx on public.analytics_events(workspace_id);
create index analytics_events_created_at_idx on public.analytics_events(created_at desc);

alter table public.analytics_events enable row level security;

create policy analytics_events_select_admin
on public.analytics_events for select
to authenticated
using (
  exists (
    select 1 from public.workspace_memberships
    where workspace_memberships.workspace_id = analytics_events.workspace_id
    and workspace_memberships.user_id = auth.uid()
  )
);

create policy analytics_events_insert
on public.analytics_events for insert
to authenticated
with check (true);
