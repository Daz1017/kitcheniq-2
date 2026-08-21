-- M2-I05 Ingredient Claims & Governed Attributes Foundation.
--
-- Establishes organization-governed Ingredient Claim Definitions
-- and effective-dated Ingredient Claim Assertions.
--
-- This checkpoint does NOT establish a fixed allergen/dietary taxonomy,
-- arbitrary JSON metadata, recipe aggregation, menu labeling,
-- nutrition calculation, external regulatory taxonomy integration,
-- legacy migration, or UI.

-- ---------------------------------------------------------------------------
-- Permission catalog
-- ---------------------------------------------------------------------------

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
    'm2.ingredient.archive',
    'm2.purchase_spec.read',
    'm2.purchase_spec.manage',
    'm2.vendor_mapping.read',
    'm2.vendor_mapping.manage',
    'm2.cost.read',
    'm2.cost.manage',
    'm2.claim.read',
    'm2.claim.manage'
  ));

insert into private.permissions (id)
values
  ('m2.claim.read'),
  ('m2.claim.manage')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Governed Claim Definitions.
-- ---------------------------------------------------------------------------

create table public.ingredient_claim_definitions (
  id uuid primary key
    default extensions.gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id),

  code text not null
    check (
      code <> ''
      and code = btrim(code)
    ),

  display_name text not null
    check (
      display_name <> ''
      and display_name = btrim(display_name)
    ),

  description text
    check (
      description is null
      or (
        description <> ''
        and description = btrim(description)
      )
    ),

  lifecycle_status text not null
    check (
      lifecycle_status in (
        'active',
        'inactive',
        'archived'
      )
    )
    default 'active',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  archived_at timestamptz,

  unique (id, organization_id),

  check (
    foundation.is_uuid_v4(id)
  ),

  check (
    (
      lifecycle_status = 'archived'
      and archived_at is not null
    )
    or
    (
      lifecycle_status <> 'archived'
      and archived_at is null
    )
  )
);

-- Claim code is governed within an organization.
-- UUID remains relational identity.
create unique index ingredient_claim_definitions_code_idx
  on public.ingredient_claim_definitions (
    organization_id,
    lower(code)
  );

create index ingredient_claim_definitions_display_name_idx
  on public.ingredient_claim_definitions (
    organization_id,
    lower(display_name)
  );

-- ---------------------------------------------------------------------------
-- Immutable effective-dated Ingredient Claim Assertions.
-- ---------------------------------------------------------------------------

create table public.ingredient_claim_assertions (
  id uuid primary key
    default extensions.gen_random_uuid(),

  organization_id uuid not null,

  ingredient_id uuid not null,

  claim_definition_id uuid not null,

  value_state foundation.value_state not null,

  boolean_value boolean,

  effective_from timestamptz not null,

  created_at timestamptz not null
    default now(),

  unique (id, organization_id),

  -- One authoritative assertion for the same claim at an exact instant.
  unique (
    ingredient_id,
    claim_definition_id,
    effective_from
  ),

  check (
    foundation.is_uuid_v4(id)
  ),

  check (
    foundation.is_valid_value_state_pair(
      value_state,
      boolean_value is not null
    )
  ),

  foreign key (
    ingredient_id,
    organization_id
  )
    references public.ingredients (
      id,
      organization_id
    ),

  foreign key (
    claim_definition_id,
    organization_id
  )
    references public.ingredient_claim_definitions (
      id,
      organization_id
    )
);

create index ingredient_claim_assertions_effective_idx
  on public.ingredient_claim_assertions (
    ingredient_id,
    claim_definition_id,
    effective_from desc
  );

-- ---------------------------------------------------------------------------
-- Assertion history is immutable.
-- ---------------------------------------------------------------------------

create or replace function private.reject_m2_claim_assertion_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception
    'Ingredient Claim assertion history is immutable'
    using errcode = '42501';
end;
$$;

create trigger ingredient_claim_assertion_history_immutable
before update or delete
on public.ingredient_claim_assertions
for each row
execute function private.reject_m2_claim_assertion_mutation();

revoke all
  on function private.reject_m2_claim_assertion_mutation()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS / direct mutation boundaries.
-- ---------------------------------------------------------------------------

alter table public.ingredient_claim_definitions
  enable row level security;

create policy ingredient_claim_definitions_read
on public.ingredient_claim_definitions
for select
to authenticated
using (
  private.current_has_permission(
    'm2.claim.read',
    'organization',
    organization_id,
    null
  )
);

alter table public.ingredient_claim_assertions
  enable row level security;

create policy ingredient_claim_assertions_read
on public.ingredient_claim_assertions
for select
to authenticated
using (
  private.current_has_permission(
    'm2.claim.read',
    'organization',
    organization_id,
    null
  )
);

revoke all
  on table public.ingredient_claim_definitions
  from public, anon, authenticated, service_role;

revoke all
  on table public.ingredient_claim_assertions
  from public, anon, authenticated, service_role;

grant select
  on table public.ingredient_claim_definitions
  to authenticated, service_role;

grant select
  on table public.ingredient_claim_assertions
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Create governed Claim Definition.
-- ---------------------------------------------------------------------------

create or replace function public.m2_create_ingredient_claim_definition(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_code text,
  p_display_name text,
  p_description text,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  new_claim_definition_id uuid;
  normalized_code text;
begin
  if not exists (
    select 1
    from private.application_users as application_user
    where application_user.id = p_application_user_id
      and application_user.auth_principal_id = p_auth_principal_id
  ) then
    raise exception
      'caller identity is not a valid application-user mapping'
      using errcode = '42501';
  end if;

  if not private.has_permission(
    p_application_user_id,
    'm2.claim.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Ingredient Claims'
      using errcode = '42501';
  end if;

  if p_code is null or btrim(p_code) = '' then
    raise exception
      'claim code is required'
      using errcode = '23514';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception
      'claim display name is required'
      using errcode = '23514';
  end if;

  if p_description is not null
     and btrim(p_description) = '' then
    raise exception
      'claim description cannot be blank'
      using errcode = '23514';
  end if;

  normalized_code := lower(btrim(p_code));

  if exists (
    select 1
    from public.ingredient_claim_definitions
    where organization_id = p_organization_id
      and lower(code) = normalized_code
  ) then
    raise exception
      'claim code already exists in organization'
      using errcode = '23505';
  end if;

  insert into public.ingredient_claim_definitions (
    organization_id,
    code,
    display_name,
    description,
    lifecycle_status
  )
  values (
    p_organization_id,
    btrim(p_code),
    btrim(p_display_name),
    case
      when p_description is null then null
      else btrim(p_description)
    end,
    'active'
  )
  returning id
  into new_claim_definition_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.claim_definition.create',
    'ingredient_claim_definition',
    new_claim_definition_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.create_ingredient_claim_definition',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'claimDefinitionId', new_claim_definition_id,
        'code', btrim(p_code),
        'displayName', btrim(p_display_name),
        'description', p_description,
        'lifecycleStatus', 'active'
      )
    )
  );

  return new_claim_definition_id;
end;
$$;

revoke all
  on function public.m2_create_ingredient_claim_definition(
    uuid, uuid, text, uuid, text, text, text, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_create_ingredient_claim_definition(
    uuid, uuid, text, uuid, text, text, text, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Record immutable Ingredient Claim Assertion.
-- ---------------------------------------------------------------------------

create or replace function public.m2_record_ingredient_claim_assertion(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_ingredient_id uuid,
  p_claim_definition_id uuid,
  p_value_state foundation.value_state,
  p_boolean_value boolean,
  p_effective_from timestamptz,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  ingredient_record public.ingredients%rowtype;
  claim_definition_record
    public.ingredient_claim_definitions%rowtype;
  new_assertion_id uuid;
begin
  if not exists (
    select 1
    from private.application_users as application_user
    where application_user.id = p_application_user_id
      and application_user.auth_principal_id =
        p_auth_principal_id
  ) then
    raise exception
      'caller identity is not a valid application-user mapping'
      using errcode = '42501';
  end if;

  if not private.has_permission(
    p_application_user_id,
    'm2.claim.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Ingredient Claims'
      using errcode = '42501';
  end if;

  select ingredient.*
  into ingredient_record
  from public.ingredients as ingredient
  where ingredient.id = p_ingredient_id
    and ingredient.organization_id =
      p_organization_id;

  if not found then
    raise exception
      'Ingredient does not exist in requested organization'
      using errcode = '23503';
  end if;

  if ingredient_record.lifecycle_status = 'archived' then
    raise exception
      'cannot record claim for archived Ingredient'
      using errcode = '23514';
  end if;

  select definition.*
  into claim_definition_record
  from public.ingredient_claim_definitions as definition
  where definition.id = p_claim_definition_id
    and definition.organization_id =
      p_organization_id;

  if not found then
    raise exception
      'Claim Definition does not exist in requested organization'
      using errcode = '23503';
  end if;

  if claim_definition_record.lifecycle_status <> 'active' then
    raise exception
      'cannot record assertion for inactive or archived Claim Definition'
      using errcode = '23514';
  end if;

  if p_effective_from is null then
    raise exception
      'claim assertion effective_from is required'
      using errcode = '23502';
  end if;

  if p_value_state = 'known' then
    if p_boolean_value is null then
      raise exception
        'known claim state requires boolean value'
        using errcode = '23514';
    end if;
  elsif p_value_state in (
    'unknown',
    'not_applicable'
  ) then
    if p_boolean_value is not null then
      raise exception
        'unknown or not_applicable claim state requires null value'
        using errcode = '23514';
    end if;
  else
    raise exception
      'invalid claim value state'
      using errcode = '23514';
  end if;

  insert into public.ingredient_claim_assertions (
    organization_id,
    ingredient_id,
    claim_definition_id,
    value_state,
    boolean_value,
    effective_from
  )
  values (
    p_organization_id,
    p_ingredient_id,
    p_claim_definition_id,
    p_value_state,
    p_boolean_value,
    p_effective_from
  )
  returning id
  into new_assertion_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.claim_assertion.record',
    'ingredient_claim_assertion',
    new_assertion_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.record_ingredient_claim_assertion',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'claimAssertionId', new_assertion_id,
        'ingredientId', p_ingredient_id,
        'claimDefinitionId',
          p_claim_definition_id,
        'valueState', p_value_state,
        'booleanValue', p_boolean_value,
        'effectiveFrom', p_effective_from
      )
    )
  );

  return new_assertion_id;
end;
$$;

revoke all
  on function public.m2_record_ingredient_claim_assertion(
    uuid, uuid, text, uuid, uuid, uuid,
    foundation.value_state, boolean,
    timestamptz, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_record_ingredient_claim_assertion(
    uuid, uuid, text, uuid, uuid, uuid,
    foundation.value_state, boolean,
    timestamptz, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Update governed Claim Definition.
-- Active/inactive only. Archive is a separate AAL2 command.
-- ---------------------------------------------------------------------------

create or replace function public.m2_update_ingredient_claim_definition(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_claim_definition_id uuid,
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
  current_definition
    public.ingredient_claim_definitions%rowtype;
  old_context jsonb;
  new_context jsonb;
begin
  if not exists (
    select 1
    from private.application_users as application_user
    where application_user.id = p_application_user_id
      and application_user.auth_principal_id =
        p_auth_principal_id
  ) then
    raise exception
      'caller identity is not a valid application-user mapping'
      using errcode = '42501';
  end if;

  if not private.has_permission(
    p_application_user_id,
    'm2.claim.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Ingredient Claims'
      using errcode = '42501';
  end if;

  select definition.*
  into current_definition
  from public.ingredient_claim_definitions as definition
  where definition.id = p_claim_definition_id
    and definition.organization_id = p_organization_id;

  if not found then
    raise exception
      'Claim Definition does not exist in requested organization'
      using errcode = '23503';
  end if;

  if current_definition.lifecycle_status = 'archived' then
    raise exception
      'archived Claim Definition cannot be updated'
      using errcode = '23514';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception
      'claim display name is required'
      using errcode = '23514';
  end if;

  if p_description is not null
     and btrim(p_description) = '' then
    raise exception
      'claim description cannot be blank'
      using errcode = '23514';
  end if;

  if p_lifecycle_status not in ('active', 'inactive') then
    raise exception
      'Claim Definition update status must be active or inactive'
      using errcode = '23514';
  end if;

  old_context := jsonb_build_object(
    'claimDefinitionId', current_definition.id,
    'code', current_definition.code,
    'displayName', current_definition.display_name,
    'description', current_definition.description,
    'lifecycleStatus', current_definition.lifecycle_status
  );

  update public.ingredient_claim_definitions
  set
    display_name = btrim(p_display_name),
    description = case
      when p_description is null then null
      else btrim(p_description)
    end,
    lifecycle_status = p_lifecycle_status,
    updated_at = now()
  where id = p_claim_definition_id
    and organization_id = p_organization_id;

  select definition.*
  into current_definition
  from public.ingredient_claim_definitions as definition
  where definition.id = p_claim_definition_id
    and definition.organization_id = p_organization_id;

  new_context := jsonb_build_object(
    'claimDefinitionId', current_definition.id,
    'code', current_definition.code,
    'displayName', current_definition.display_name,
    'description', current_definition.description,
    'lifecycleStatus', current_definition.lifecycle_status
  );

  perform private.append_audit_record(
    p_application_user_id,
    'm2.claim_definition.update',
    'ingredient_claim_definition',
    p_claim_definition_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.update_ingredient_claim_definition',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', old_context,
      'after', new_context
    )
  );
end;
$$;

revoke all
  on function public.m2_update_ingredient_claim_definition(
    uuid, uuid, text, uuid, uuid,
    text, text, text, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_update_ingredient_claim_definition(
    uuid, uuid, text, uuid, uuid,
    text, text, text, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Archive governed Claim Definition.
-- Non-destructive and explicitly AAL2.
-- ---------------------------------------------------------------------------

create or replace function public.m2_archive_ingredient_claim_definition(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_claim_definition_id uuid,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_definition
    public.ingredient_claim_definitions%rowtype;
  old_context jsonb;
  new_context jsonb;
begin
  if not exists (
    select 1
    from private.application_users as application_user
    where application_user.id = p_application_user_id
      and application_user.auth_principal_id =
        p_auth_principal_id
  ) then
    raise exception
      'caller identity is not a valid application-user mapping'
      using errcode = '42501';
  end if;

  if not private.has_permission(
    p_application_user_id,
    'm2.claim.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Ingredient Claims'
      using errcode = '42501';
  end if;

  if not private.aal_satisfies(
    p_aal,
    'aal2'
  ) then
    raise exception
      'Claim Definition archive requires aal2'
      using errcode = '42501';
  end if;

  select definition.*
  into current_definition
  from public.ingredient_claim_definitions as definition
  where definition.id = p_claim_definition_id
    and definition.organization_id = p_organization_id;

  if not found then
    raise exception
      'Claim Definition does not exist in requested organization'
      using errcode = '23503';
  end if;

  if current_definition.lifecycle_status = 'archived' then
    raise exception
      'Claim Definition is already archived'
      using errcode = '23514';
  end if;

  old_context := jsonb_build_object(
    'claimDefinitionId', current_definition.id,
    'code', current_definition.code,
    'displayName', current_definition.display_name,
    'description', current_definition.description,
    'lifecycleStatus', current_definition.lifecycle_status,
    'archivedAt', current_definition.archived_at
  );

  update public.ingredient_claim_definitions
  set
    lifecycle_status = 'archived',
    archived_at = now(),
    updated_at = now()
  where id = p_claim_definition_id
    and organization_id = p_organization_id;

  select definition.*
  into current_definition
  from public.ingredient_claim_definitions as definition
  where definition.id = p_claim_definition_id
    and definition.organization_id = p_organization_id;

  new_context := jsonb_build_object(
    'claimDefinitionId', current_definition.id,
    'code', current_definition.code,
    'displayName', current_definition.display_name,
    'description', current_definition.description,
    'lifecycleStatus', current_definition.lifecycle_status,
    'archivedAt', current_definition.archived_at
  );

  perform private.append_audit_record(
    p_application_user_id,
    'm2.claim_definition.archive',
    'ingredient_claim_definition',
    p_claim_definition_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.archive_ingredient_claim_definition',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', old_context,
      'after', new_context
    )
  );
end;
$$;

revoke all
  on function public.m2_archive_ingredient_claim_definition(
    uuid, uuid, text, uuid, uuid, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_archive_ingredient_claim_definition(
    uuid, uuid, text, uuid, uuid, uuid
  )
  to service_role;
