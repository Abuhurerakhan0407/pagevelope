-- Public delivery assets for images/GIFs embedded in recipient email HTML.
-- Originals stay private in pagevelope-originals. Only content-addressed derived assets
-- belong in this bucket so release URLs remain stable after a campaign is approved.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pagevelope-delivery',
  'pagevelope-delivery',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy pagevelope_delivery_select_member
on storage.objects for select
to authenticated
using (
  bucket_id = 'pagevelope-delivery'
  and private.is_workspace_member(private.path_workspace_id(name))
);

create policy pagevelope_delivery_insert_editor
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pagevelope-delivery'
  and private.can_edit_workspace(private.path_workspace_id(name))
  and split_part(name, '/', 2) = 'delivery'
  and split_part(name, '/', 3) ~ '^[0-9a-f]{64}\.(jpg|jpeg|png|webp|gif|mp4)$'
);

-- Delivery URLs are immutable by construction. There is intentionally no UPDATE policy.
create policy pagevelope_delivery_delete_admin
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pagevelope-delivery'
  and private.can_admin_workspace(private.path_workspace_id(name))
);

create or replace function public.register_delivery_asset(
  target_workspace_id uuid,
  target_brand_id uuid,
  target_object_path text,
  target_mime_type text,
  target_byte_size bigint,
  target_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_path text := trim(target_object_path);
  clean_mime text := lower(trim(target_mime_type));
  clean_sha text := lower(trim(target_sha256));
  required_prefix text := target_workspace_id::text || '/delivery/';
  expected_suffix text;
  existing_id uuid;
  existing_sha text;
  new_asset_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_edit_workspace(target_workspace_id) then
    raise exception 'Workspace edit access required.' using errcode = '42501';
  end if;

  if clean_sha !~ '^[0-9a-f]{64}$' then
    raise exception 'Asset SHA-256 is invalid.' using errcode = '22023';
  end if;

  if target_byte_size < 1 or target_byte_size > 26214400 then
    raise exception 'Delivery asset must be between 1 byte and 25 MiB.' using errcode = '22023';
  end if;

  expected_suffix := case clean_mime
    when 'image/jpeg' then '.jpg'
    when 'image/png' then '.png'
    when 'image/webp' then '.webp'
    when 'image/gif' then '.gif'
    when 'video/mp4' then '.mp4'
    else null
  end;

  if expected_suffix is null then
    raise exception 'Unsupported delivery asset MIME type.' using errcode = '22023';
  end if;

  if clean_path <> required_prefix || clean_sha || expected_suffix then
    raise exception 'Delivery asset path must be content-addressed by its SHA-256.' using errcode = '22023';
  end if;

  if target_brand_id is not null and not exists (
    select 1 from public.brands b
    where b.workspace_id = target_workspace_id
      and b.id = target_brand_id
  ) then
    raise exception 'Brand is unavailable in this workspace.' using errcode = '42501';
  end if;

  select a.id, a.sha256
    into existing_id, existing_sha
  from public.assets a
  where a.workspace_id = target_workspace_id
    and a.object_path = clean_path;

  if existing_id is not null then
    if existing_sha <> clean_sha then
      raise exception 'Existing delivery asset fingerprint does not match.' using errcode = '23514';
    end if;
    return existing_id;
  end if;

  insert into public.assets (
    workspace_id,
    brand_id,
    kind,
    object_path,
    mime_type,
    byte_size,
    sha256,
    created_by
  ) values (
    target_workspace_id,
    target_brand_id,
    'derived'::public.asset_kind,
    clean_path,
    clean_mime,
    target_byte_size,
    clean_sha,
    caller_id
  )
  returning id into new_asset_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace_id,
    caller_id,
    'asset.delivery.registered',
    'asset',
    new_asset_id,
    jsonb_build_object(
      'brand_id', target_brand_id,
      'object_path', clean_path,
      'mime_type', clean_mime,
      'byte_size', target_byte_size,
      'sha256', clean_sha
    )
  );

  return new_asset_id;
end;
$$;

revoke all on function public.register_delivery_asset(uuid, uuid, text, text, bigint, text) from public, anon;
grant execute on function public.register_delivery_asset(uuid, uuid, text, text, bigint, text) to authenticated;

commit;
