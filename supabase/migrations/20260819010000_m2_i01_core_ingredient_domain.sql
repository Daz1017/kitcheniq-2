-- M2-I01 core ingredient domain foundation.
-- Implements the smallest trustworthy persistence and security foundation for
-- the authoritative KitchenIQ 2.0 Ingredient master.

-- Extend the permissions table check constraint to include Module 2 Ingredient permissions.
alter table private.permissions
  drop constraint permissions_id_check;

alter table private.permissions
  add constraint permissions_id_check
  check (id in (
    'foundation.scope.read',
    'foundation.location.create',
    'm2.ingredient.read',
    'm2.ingredient.create',
    'm2.ingredient.update',
    'm2.ingredient.archive'
  ));

-- Add Module 2 Ingredient permissions to private.permissions.
insert into private.permissions (id)
values
  ('m2.ingredient.read'),
  ('m2.ingredient.create'),
  ('m2.ingredient.update'),
  ('m2.ingredient.archive')
on conflict (id) do nothing;

-- Create the public.ingredients table.
-- Ingredient is organization-owned with UUIDv4 identity and lifecycle governance.
create table public.ingredients (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  display_name text not null check (display_name <> '' and display_name = btrim(display_name)),
  description text check (description is null or (description <> '' and description = btrim(description))),
  base_canonical_unit foundation.canonical_unit_code not null,
  lifecycle_status text not null check (lifecycle_status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id),
  check (foundation.is_uuid_v4(id)),
  check ((lifecycle_status = 'archived' and archived_at is not null)
      or (lifecycle_status <> 'archived' and archived_at is null))
);

-- Create duplicate-candidate index for exact normalized duplicate detection.
-- Exact trimmed/case-insensitive display name match within organization.
create index ingredients_duplicate_candidate_idx
  on public.ingredients (organization_id, lower(display_name));

-- Enable Row-Level Security.
alter table public.ingredients enable row level security;

-- RLS policy: authenticated users can read ingredients they have m2.ingredient.read
-- permission for at exact organization scope.
create policy ingredients_read on public.ingredients
  for select to authenticated
  using (private.current_has_permission('m2.ingredient.read', 'organization', organization_id, null));

-- Revoke direct DML from authenticated users.
revoke insert, update, delete on public.ingredients from authenticated;

-- Create m2_create_ingredient function.
-- Creates a new Ingredient with exact duplicate-candidate detection.
create or replace function public.m2_create_ingredient(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_display_name text,
  p_description text,
  p_base_canonical_unit foundation.canonical_unit_code,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  new_ingredient_id uuid;
  trimmed_display_name text;
  normalized_display_name text;
  candidate_count integer;
begin
  -- Verify caller identity mapping.
  if not exists (
    select 1
    from private.application_users as application_user
    where application_user.id = p_application_user_id
      and application_user.auth_principal_id = p_auth_principal_id
  ) then
    raise exception 'caller identity is not a valid application-user mapping' using errcode = '42501';
  end if;

  -- Verify create permission at organization scope.
  if not private.has_permission(
    p_application_user_id,
    'm2.ingredient.create',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception 'caller is not authorized to create an ingredient' using errcode = '42501';
  end if;

  -- Validate display name.
  if p_display_name is null or p_display_name = '' then
    raise exception 'display name is required' using errcode = '23502';
  end if;

  trimmed_display_name := btrim(p_display_name);
  if trimmed_display_name = '' then
    raise exception 'display name must not be only whitespace' using errcode = '23514';
  end if;

  normalized_display_name := lower(trimmed_display_name);

  -- Exact duplicate-candidate detection within organization.
  select count(*)
  into candidate_count
  from public.ingredients
  where organization_id = p_organization_id
    and lower(display_name) = normalized_display_name;

  if candidate_count > 0 then
    raise exception 'an ingredient with this display name already exists in this organization' using errcode = '23505';
  end if;

  -- Insert new ingredient.
  insert into public.ingredients (
    organization_id,
    display_name,
    description,
    base_canonical_unit,
    lifecycle_status
  ) values (
    p_organization_id,
    trimmed_display_name,
    p_description,
    p_base_canonical_unit,
    'active'
  ) returning id into new_ingredient_id;

  -- Append audit record.
  perform private.append_audit_record(
    p_application_user_id,
    'm2.ingredient.create',
    'ingredient',
    new_ingredient_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'public.m2_create_ingredient',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'ingredientId', new_ingredient_id,
        'organizationId', p_organization_id,
        'displayName', trimmed_display_name,
        'description', p_description,
        'baseCanonicalUnit', p_base_canonical_unit,
        'lifecycleStatus', 'active'
      )
    )
  );

  return new_ingredient_id;
end;
$$;

revoke all on function public.m2_create_ingredient(uuid, uuid, text, uuid, text, text, foundation.canonical_unit_code, uuid) from public, anon, authenticated;
grant execute on function public.m2_create_ingredient(uuid, uuid, text, uuid, text, text, foundation.canonical_unit_code, uuid) to service_role;

-- Overloaded variant without correlation_id that raises an error.
create or replace function public.m2_create_ingredient(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_display_name text,
  p_description text,
  p_base_canonical_unit foundation.canonical_unit_code
)
returns uuid
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'm2_create_ingredient requires a correlation id' using errcode = '42501';
end;
$$;

revoke all on function public.m2_create_ingredient(uuid, uuid, text, uuid, text, text, foundation.canonical_unit_code) from public, anon, authenticated, service_role;

-- Create m2_update_ingredient function.
-- Updates display_name, description, or lifecycle status (active <-> inactive only).
-- Cannot update archived ingredients or change base_canonical_unit.
create or replace function public.m2_update_ingredient(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_ingredient_id uuid,
  p_display_name text,
  p_description text,
  p_lifecycle_status text,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_ingredient record;
  trimmed_display_name text;
  normalized_display_name text;
  candidate_count integer;
  old_context jsonb;
  new_context jsonb;
begin
  -- Verify caller identity mapping.
  if not exists (
    select 1
    from private.application_users as application_user
    where application_user.id = p_application_user_id
      and application_user.auth_principal_id = p_auth_principal_id
  ) then
    raise exception 'caller identity is not a valid application-user mapping' using errcode = '42501';
  end if;

  -- Verify update permission at organization scope.
  if not private.has_permission(
    p_application_user_id,
    'm2.ingredient.update',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception 'caller is not authorized to update an ingredient' using errcode = '42501';
  end if;

  -- Fetch current ingredient state.
  select *
  into current_ingredient
  from public.ingredients
  where id = p_ingredient_id
    and organization_id = p_organization_id;

  if current_ingredient is null then
    raise exception 'ingredient not found' using errcode = '02000';
  end if;

  -- Cannot update archived ingredients.
  if current_ingredient.lifecycle_status = 'archived' then
    raise exception 'cannot update an archived ingredient' using errcode = '42501';
  end if;

  -- Validate new display name if provided.
  if p_display_name is not null then
    if p_display_name = '' then
      raise exception 'display name must not be empty' using errcode = '23502';
    end if;

    trimmed_display_name := btrim(p_display_name);
    if trimmed_display_name = '' then
      raise exception 'display name must not be only whitespace' using errcode = '23514';
    end if;

    normalized_display_name := lower(trimmed_display_name);

    -- Exact duplicate-candidate detection within organization (excluding current).
    select count(*)
    into candidate_count
    from public.ingredients
    where organization_id = p_organization_id
      and id <> p_ingredient_id
      and lower(display_name) = normalized_display_name;

    if candidate_count > 0 then
      raise exception 'an ingredient with this display name already exists in this organization' using errcode = '23505';
    end if;
  else
    trimmed_display_name := current_ingredient.display_name;
  end if;

  -- Validate lifecycle status transitions (only active <-> inactive allowed).
  if p_lifecycle_status is not null then
    if p_lifecycle_status not in ('active', 'inactive') then
      raise exception 'invalid lifecycle status for update' using errcode = '23514';
    end if;

    if (current_ingredient.lifecycle_status = 'active' and p_lifecycle_status = 'active')
       or (current_ingredient.lifecycle_status = 'inactive' and p_lifecycle_status = 'inactive') then
      -- No-op transition, still allow it.
      null;
    elsif (current_ingredient.lifecycle_status in ('active', 'inactive') and p_lifecycle_status in ('active', 'inactive')) then
      -- Valid transition between active and inactive.
      null;
    else
      raise exception 'invalid lifecycle status transition' using errcode = '23514';
    end if;
  end if;

  -- Build before context.
  old_context := jsonb_build_object(
    'ingredientId', current_ingredient.id,
    'organizationId', current_ingredient.organization_id,
    'displayName', current_ingredient.display_name,
    'description', current_ingredient.description,
    'baseCanonicalUnit', current_ingredient.base_canonical_unit,
    'lifecycleStatus', current_ingredient.lifecycle_status
  );

  -- Update ingredient.
  update public.ingredients
  set
    display_name = trimmed_display_name,
    description = coalesce(p_description, description),
    lifecycle_status = coalesce(p_lifecycle_status, lifecycle_status),
    updated_at = now()
  where id = p_ingredient_id
    and organization_id = p_organization_id;

  -- Fetch updated state for audit context.
  select *
  into current_ingredient
  from public.ingredients
  where id = p_ingredient_id
    and organization_id = p_organization_id;

  new_context := jsonb_build_object(
    'ingredientId', current_ingredient.id,
    'organizationId', current_ingredient.organization_id,
    'displayName', current_ingredient.display_name,
    'description', current_ingredient.description,
    'baseCanonicalUnit', current_ingredient.base_canonical_unit,
    'lifecycleStatus', current_ingredient.lifecycle_status
  );

  -- Append audit record.
  perform private.append_audit_record(
    p_application_user_id,
    'm2.ingredient.update',
    'ingredient',
    p_ingredient_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'public.m2_update_ingredient',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', old_context,
      'after', new_context
    )
  );
end;
$$;

revoke all on function public.m2_update_ingredient(uuid, uuid, text, uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.m2_update_ingredient(uuid, uuid, text, uuid, uuid, text, text, text, uuid) to service_role;

-- Overloaded variant without correlation_id that raises an error.
create or replace function public.m2_update_ingredient(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_ingredient_id uuid,
  p_display_name text,
  p_description text,
  p_lifecycle_status text
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'm2_update_ingredient requires a correlation id' using errcode = '42501';
end;
$$;

revoke all on function public.m2_update_ingredient(uuid, uuid, text, uuid, uuid, text, text, text) from public, anon, authenticated, service_role;

-- Create m2_archive_ingredient function.
-- Archives an ingredient (non-destructive). Requires AAL2.
-- Cannot archive an already-archived ingredient.
create or replace function public.m2_archive_ingredient(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_ingredient_id uuid,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_ingredient record;
  old_context jsonb;
  new_context jsonb;
begin
  -- Verify caller identity mapping.
  if not exists (
    select 1
    from private.application_users as application_user
    where application_user.id = p_application_user_id
      and application_user.auth_principal_id = p_auth_principal_id
  ) then
    raise exception 'caller identity is not a valid application-user mapping' using errcode = '42501';
  end if;

  -- Verify archive permission at organization scope.
  -- Archive requires AAL2 regardless of role class.
  if not private.has_permission(
    p_application_user_id,
    'm2.ingredient.archive',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception 'caller is not authorized to archive an ingredient' using errcode = '42501';
  end if;

  -- Explicitly check AAL2 for archive operation.
  if p_aal <> 'aal2' then
    raise exception 'archive operation requires aal2' using errcode = '42501';
  end if;

  -- Fetch current ingredient state.
  select *
  into current_ingredient
  from public.ingredients
  where id = p_ingredient_id
    and organization_id = p_organization_id;

  if current_ingredient is null then
    raise exception 'ingredient not found' using errcode = '02000';
  end if;

  -- Cannot archive an already-archived ingredient.
  if current_ingredient.lifecycle_status = 'archived' then
    raise exception 'ingredient is already archived' using errcode = '42501';
  end if;

  -- Build before context.
  old_context := jsonb_build_object(
    'ingredientId', current_ingredient.id,
    'organizationId', current_ingredient.organization_id,
    'displayName', current_ingredient.display_name,
    'description', current_ingredient.description,
    'baseCanonicalUnit', current_ingredient.base_canonical_unit,
    'lifecycleStatus', current_ingredient.lifecycle_status,
    'archivedAt', current_ingredient.archived_at
  );

  -- Archive ingredient.
  update public.ingredients
  set
    lifecycle_status = 'archived',
    archived_at = now(),
    updated_at = now()
  where id = p_ingredient_id
    and organization_id = p_organization_id;

  -- Fetch updated state for audit context.
  select *
  into current_ingredient
  from public.ingredients
  where id = p_ingredient_id
    and organization_id = p_organization_id;

  new_context := jsonb_build_object(
    'ingredientId', current_ingredient.id,
    'organizationId', current_ingredient.organization_id,
    'displayName', current_ingredient.display_name,
    'description', current_ingredient.description,
    'baseCanonicalUnit', current_ingredient.base_canonical_unit,
    'lifecycleStatus', current_ingredient.lifecycle_status,
    'archivedAt', current_ingredient.archived_at
  );

  -- Append audit record.
  perform private.append_audit_record(
    p_application_user_id,
    'm2.ingredient.archive',
    'ingredient',
    p_ingredient_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'public.m2_archive_ingredient',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', old_context,
      'after', new_context
    )
  );
end;
$$;

revoke all on function public.m2_archive_ingredient(uuid, uuid, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.m2_archive_ingredient(uuid, uuid, text, uuid, uuid, uuid) to service_role;

-- Overloaded variant without correlation_id that raises an error.
create or replace function public.m2_archive_ingredient(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_ingredient_id uuid
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'm2_archive_ingredient requires a correlation id' using errcode = '42501';
end;
$$;

revoke all on function public.m2_archive_ingredient(uuid, uuid, text, uuid, uuid) from public, anon, authenticated, service_role;
