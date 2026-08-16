-- Atomic workspace onboarding for authenticated Pagevelope users.
-- This migration is authored/tested in CI only; production application remains human-controlled.

begin;

create or replace function public.create_workspace(
  workspace_name text,
  workspace_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_workspace_id uuid;
  clean_name text := trim(workspace_name);
  clean_slug text := lower(trim(workspace_slug));
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if char_length(clean_name) < 1 or char_length(clean_name) > 120 then
    raise exception 'Workspace name must be between 1 and 120 characters.' using errcode = '22023';
  end if;

  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Workspace slug is invalid.' using errcode = '22023';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (clean_name, clean_slug, caller_id)
  returning id into new_workspace_id;

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (new_workspace_id, caller_id, 'owner'::public.workspace_role);

  insert into public.audit_events (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    new_workspace_id,
    caller_id,
    'workspace.created',
    'workspace',
    new_workspace_id,
    jsonb_build_object('slug', clean_slug)
  );

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

commit;
