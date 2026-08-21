-- M2-I06 Ingredient Handling & Operational Attributes Foundation.
--
-- Establishes organization-governed Ingredient Handling Definitions
-- and the foundation for effective-dated Ingredient handling instructions.
--
-- This checkpoint does NOT establish temperature conversion,
-- shelf-life arithmetic, expiry calculations, fixed handling taxonomies,
-- arbitrary JSON metadata, legacy migration, or UI.

-- ---------------------------------------------------------------------------
-- Permission catalog.
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
    'm2.claim.manage',
    'm2.handling.read',
    'm2.handling.manage'
  ));

insert into private.permissions (id)
values
  ('m2.handling.read'),
  ('m2.handling.manage')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Governed Handling Definitions.
-- ---------------------------------------------------------------------------

create table public.ingredient_handling_definitions (
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
    default 'active'
    check (
      lifecycle_status in (
        'active',
        'inactive',
        'archived'
      )
    ),

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

-- Code is stable/governed within an organization.
-- UUID remains relational identity.
create unique index ingredient_handling_definitions_code_idx
  on public.ingredient_handling_definitions (
    organization_id,
    lower(code)
  );

create index ingredient_handling_definitions_display_name_idx
  on public.ingredient_handling_definitions (
    organization_id,
    lower(display_name)
  );

-- ---------------------------------------------------------------------------
-- Immutable effective-dated Ingredient Handling Instructions.
-- ---------------------------------------------------------------------------

create table public.ingredient_handling_instructions (
  id uuid primary key
    default extensions.gen_random_uuid(),

  organization_id uuid not null,

  ingredient_id uuid not null,

  handling_definition_id uuid not null,

  value_state foundation.value_state not null,

  instruction_text text
    check (
      instruction_text is null
      or (
        instruction_text <> ''
        and instruction_text = btrim(instruction_text)
      )
    ),

  effective_from timestamptz not null,

  created_at timestamptz not null
    default now(),

  unique (id, organization_id),

  unique (
    ingredient_id,
    handling_definition_id,
    effective_from
  ),

  check (
    foundation.is_uuid_v4(id)
  ),

  check (
    foundation.is_valid_value_state_pair(
      value_state,
      instruction_text is not null
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
    handling_definition_id,
    organization_id
  )
    references public.ingredient_handling_definitions (
      id,
      organization_id
    )
);

create index ingredient_handling_instructions_effective_idx
  on public.ingredient_handling_instructions (
    ingredient_id,
    handling_definition_id,
    effective_from desc
  );

-- ---------------------------------------------------------------------------
-- Instruction history is immutable.
-- ---------------------------------------------------------------------------

create or replace function private.reject_m2_handling_instruction_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception
    'Ingredient Handling instruction history is immutable'
    using errcode = '42501';
end;
$$;

create trigger ingredient_handling_instruction_history_immutable
before update or delete
on public.ingredient_handling_instructions
for each row
execute function private.reject_m2_handling_instruction_mutation();

revoke all
  on function private.reject_m2_handling_instruction_mutation()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS / direct mutation boundaries.
-- ---------------------------------------------------------------------------

alter table public.ingredient_handling_definitions
  enable row level security;

create policy ingredient_handling_definitions_read
on public.ingredient_handling_definitions
for select
to authenticated
using (
  private.current_has_permission(
    'm2.handling.read',
    'organization',
    organization_id,
    null
  )
);

alter table public.ingredient_handling_instructions
  enable row level security;

create policy ingredient_handling_instructions_read
on public.ingredient_handling_instructions
for select
to authenticated
using (
  private.current_has_permission(
    'm2.handling.read',
    'organization',
    organization_id,
    null
  )
);

revoke all
  on table public.ingredient_handling_definitions
  from public, anon, authenticated, service_role;

revoke all
  on table public.ingredient_handling_instructions
  from public, anon, authenticated, service_role;

grant select
  on table public.ingredient_handling_definitions
  to authenticated, service_role;

grant select
  on table public.ingredient_handling_instructions
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Create governed Handling Definition.
-- ---------------------------------------------------------------------------

create or replace function public.m2_create_ingredient_handling_definition(
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
  new_definition_id uuid;
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
    'm2.handling.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Ingredient Handling'
      using errcode = '42501';
  end if;

  if p_code is null or btrim(p_code) = '' then
    raise exception
      'handling code is required'
      using errcode = '23514';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception
      'handling display name is required'
      using errcode = '23514';
  end if;

  if p_description is not null
     and btrim(p_description) = '' then
    raise exception
      'handling description cannot be blank'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.ingredient_handling_definitions
    where organization_id = p_organization_id
      and lower(code) = lower(btrim(p_code))
  ) then
    raise exception
      'handling code already exists in organization'
      using errcode = '23505';
  end if;

  insert into public.ingredient_handling_definitions (
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
  into new_definition_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.handling_definition.create',
    'ingredient_handling_definition',
    new_definition_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.create_ingredient_handling_definition',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'handlingDefinitionId', new_definition_id,
        'code', btrim(p_code),
        'displayName', btrim(p_display_name),
        'description', p_description,
        'lifecycleStatus', 'active'
      )
    )
  );

  return new_definition_id;
end;
$$;

revoke all
  on function public.m2_create_ingredient_handling_definition(
    uuid, uuid, text, uuid, text, text, text, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_create_ingredient_handling_definition(
    uuid, uuid, text, uuid, text, text, text, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Record immutable Ingredient Handling Instruction.
-- ---------------------------------------------------------------------------

create or replace function public.m2_record_ingredient_handling_instruction(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_ingredient_id uuid,
  p_handling_definition_id uuid,
  p_value_state foundation.value_state,
  p_instruction_text text,
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
  definition_record
    public.ingredient_handling_definitions%rowtype;
  new_instruction_id uuid;
  normalized_instruction text;
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
    'm2.handling.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Ingredient Handling'
      using errcode = '42501';
  end if;

  select ingredient.*
  into ingredient_record
  from public.ingredients as ingredient
  where ingredient.id = p_ingredient_id
    and ingredient.organization_id = p_organization_id;

  if not found then
    raise exception
      'Ingredient does not exist in requested organization'
      using errcode = '23503';
  end if;

  if ingredient_record.lifecycle_status = 'archived' then
    raise exception
      'cannot record handling for archived Ingredient'
      using errcode = '23514';
  end if;

  select definition.*
  into definition_record
  from public.ingredient_handling_definitions as definition
  where definition.id = p_handling_definition_id
    and definition.organization_id = p_organization_id;

  if not found then
    raise exception
      'Handling Definition does not exist in requested organization'
      using errcode = '23503';
  end if;

  if definition_record.lifecycle_status <> 'active' then
    raise exception
      'cannot record instruction for inactive or archived Handling Definition'
      using errcode = '23514';
  end if;

  if p_effective_from is null then
    raise exception
      'handling instruction effective_from is required'
      using errcode = '23502';
  end if;

  if p_value_state = 'known' then
    if p_instruction_text is null
       or btrim(p_instruction_text) = '' then
      raise exception
        'known handling state requires instruction text'
        using errcode = '23514';
    end if;

    normalized_instruction := btrim(p_instruction_text);

  elsif p_value_state in (
    'unknown',
    'not_applicable'
  ) then
    if p_instruction_text is not null then
      raise exception
        'unknown or not_applicable handling state requires null instruction'
        using errcode = '23514';
    end if;

    normalized_instruction := null;

  else
    raise exception
      'invalid handling value state'
      using errcode = '23514';
  end if;

  insert into public.ingredient_handling_instructions (
    organization_id,
    ingredient_id,
    handling_definition_id,
    value_state,
    instruction_text,
    effective_from
  )
  values (
    p_organization_id,
    p_ingredient_id,
    p_handling_definition_id,
    p_value_state,
    normalized_instruction,
    p_effective_from
  )
  returning id
  into new_instruction_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.handling_instruction.record',
    'ingredient_handling_instruction',
    new_instruction_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.record_ingredient_handling_instruction',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'handlingInstructionId', new_instruction_id,
        'ingredientId', p_ingredient_id,
        'handlingDefinitionId',
          p_handling_definition_id,
        'valueState', p_value_state,
        'instructionText', normalized_instruction,
        'effectiveFrom', p_effective_from
      )
    )
  );

  return new_instruction_id;
end;
$$;

revoke all
  on function public.m2_record_ingredient_handling_instruction(
    uuid, uuid, text, uuid, uuid, uuid,
    foundation.value_state, text,
    timestamptz, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_record_ingredient_handling_instruction(
    uuid, uuid, text, uuid, uuid, uuid,
    foundation.value_state, text,
    timestamptz, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Update governed Handling Definition.
-- Code is immutable. Active/inactive only.
-- Archive is a separate AAL2 command.
-- ---------------------------------------------------------------------------

create or replace function public.m2_update_ingredient_handling_definition(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_handling_definition_id uuid,
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
    public.ingredient_handling_definitions%rowtype;
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
    'm2.handling.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Ingredient Handling'
      using errcode = '42501';
  end if;

  select definition.*
  into current_definition
  from public.ingredient_handling_definitions as definition
  where definition.id = p_handling_definition_id
    and definition.organization_id = p_organization_id;

  if not found then
    raise exception
      'Handling Definition does not exist in requested organization'
      using errcode = '23503';
  end if;

  if current_definition.lifecycle_status = 'archived' then
    raise exception
      'archived Handling Definition cannot be updated'
      using errcode = '23514';
  end if;

  if p_display_name is null
     or btrim(p_display_name) = '' then
    raise exception
      'handling display name is required'
      using errcode = '23514';
  end if;

  if p_description is not null
     and btrim(p_description) = '' then
    raise exception
      'handling description cannot be blank'
      using errcode = '23514';
  end if;

  if p_lifecycle_status not in (
    'active',
    'inactive'
  ) then
    raise exception
      'Handling Definition update status must be active or inactive'
      using errcode = '23514';
  end if;

  old_context := jsonb_build_object(
    'handlingDefinitionId',
      current_definition.id,
    'code',
      current_definition.code,
    'displayName',
      current_definition.display_name,
    'description',
      current_definition.description,
    'lifecycleStatus',
      current_definition.lifecycle_status
  );

  update public.ingredient_handling_definitions
  set
    display_name = btrim(p_display_name),
    description = case
      when p_description is null then null
      else btrim(p_description)
    end,
    lifecycle_status = p_lifecycle_status,
    updated_at = now()
  where id = p_handling_definition_id
    and organization_id = p_organization_id;

  select definition.*
  into current_definition
  from public.ingredient_handling_definitions as definition
  where definition.id = p_handling_definition_id
    and definition.organization_id = p_organization_id;

  new_context := jsonb_build_object(
    'handlingDefinitionId',
      current_definition.id,
    'code',
      current_definition.code,
    'displayName',
      current_definition.display_name,
    'description',
      current_definition.description,
    'lifecycleStatus',
      current_definition.lifecycle_status
  );

  perform private.append_audit_record(
    p_application_user_id,
    'm2.handling_definition.update',
    'ingredient_handling_definition',
    p_handling_definition_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.update_ingredient_handling_definition',
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
  on function public.m2_update_ingredient_handling_definition(
    uuid, uuid, text, uuid, uuid,
    text, text, text, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_update_ingredient_handling_definition(
    uuid, uuid, text, uuid, uuid,
    text, text, text, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Archive governed Handling Definition.
-- Non-destructive and explicitly AAL2.
-- ---------------------------------------------------------------------------

create or replace function public.m2_archive_ingredient_handling_definition(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_handling_definition_id uuid,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_definition
    public.ingredient_handling_definitions%rowtype;
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
    'm2.handling.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Ingredient Handling'
      using errcode = '42501';
  end if;

  if not private.aal_satisfies(
    p_aal,
    'aal2'
  ) then
    raise exception
      'Handling Definition archive requires aal2'
      using errcode = '42501';
  end if;

  select definition.*
  into current_definition
  from public.ingredient_handling_definitions as definition
  where definition.id = p_handling_definition_id
    and definition.organization_id = p_organization_id;

  if not found then
    raise exception
      'Handling Definition does not exist in requested organization'
      using errcode = '23503';
  end if;

  if current_definition.lifecycle_status = 'archived' then
    raise exception
      'Handling Definition is already archived'
      using errcode = '23514';
  end if;

  old_context := jsonb_build_object(
    'handlingDefinitionId',
      current_definition.id,
    'code',
      current_definition.code,
    'displayName',
      current_definition.display_name,
    'description',
      current_definition.description,
    'lifecycleStatus',
      current_definition.lifecycle_status,
    'archivedAt',
      current_definition.archived_at
  );

  update public.ingredient_handling_definitions
  set
    lifecycle_status = 'archived',
    archived_at = now(),
    updated_at = now()
  where id = p_handling_definition_id
    and organization_id = p_organization_id;

  select definition.*
  into current_definition
  from public.ingredient_handling_definitions as definition
  where definition.id = p_handling_definition_id
    and definition.organization_id = p_organization_id;

  new_context := jsonb_build_object(
    'handlingDefinitionId',
      current_definition.id,
    'code',
      current_definition.code,
    'displayName',
      current_definition.display_name,
    'description',
      current_definition.description,
    'lifecycleStatus',
      current_definition.lifecycle_status,
    'archivedAt',
      current_definition.archived_at
  );

  perform private.append_audit_record(
    p_application_user_id,
    'm2.handling_definition.archive',
    'ingredient_handling_definition',
    p_handling_definition_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.archive_ingredient_handling_definition',
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
  on function public.m2_archive_ingredient_handling_definition(
    uuid, uuid, text, uuid, uuid, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_archive_ingredient_handling_definition(
    uuid, uuid, text, uuid, uuid, uuid
  )
  to service_role;
