-- M2-I02 Purchase Specification + Package Structure Foundation.
-- Depends on frozen M2-I01 and Foundation contracts.
-- Does not implement supplier/vendor mappings, costs, SMC-01 generic
-- conversions, invoice integration, migration, inventory, yield, or UI.

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
    'm2.purchase_spec.manage'
  ));

insert into private.permissions (id)
values
  ('m2.purchase_spec.read'),
  ('m2.purchase_spec.manage')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Stable Purchase Specification identity
-- ---------------------------------------------------------------------------

create table public.ingredient_purchase_specifications (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  ingredient_id uuid not null,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  unique (id, organization_id),

  check (foundation.is_uuid_v4(id)),

  check (
    (lifecycle_status = 'archived' and archived_at is not null)
    or
    (lifecycle_status <> 'archived' and archived_at is null)
  ),

  foreign key (ingredient_id, organization_id)
    references public.ingredients(id, organization_id)
);

create index ingredient_purchase_specifications_ingredient_idx
  on public.ingredient_purchase_specifications
  (organization_id, ingredient_id);

-- ---------------------------------------------------------------------------
-- Immutable specification versions
-- ---------------------------------------------------------------------------

create table public.ingredient_purchase_specification_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  purchase_specification_id uuid not null,
  version_number integer not null check (version_number > 0),
  specification_label text not null
    check (
      specification_label <> ''
      and specification_label = btrim(specification_label)
    ),
  effective_from timestamptz not null,
  supersedes_version_id uuid,
  created_at timestamptz not null default now(),

  unique (id, organization_id),
  unique (id, purchase_specification_id),
  unique (purchase_specification_id, version_number),

  check (foundation.is_uuid_v4(id)),

  foreign key (purchase_specification_id, organization_id)
    references public.ingredient_purchase_specifications(id, organization_id),

  foreign key (supersedes_version_id, purchase_specification_id)
    references public.ingredient_purchase_specification_versions
      (id, purchase_specification_id)
);

create index ingredient_purchase_specification_versions_effective_idx
  on public.ingredient_purchase_specification_versions
  (purchase_specification_id, effective_from desc);

-- ---------------------------------------------------------------------------
-- Immutable contextual package hierarchy
--
-- Example:
--
-- ordinal 1: case, units_per_parent NULL
-- ordinal 2: bag,  units_per_parent 6
--            terminal_quantity 2267.96185000
--            terminal_unit g
--
-- Meaning:
-- one case contains six bags;
-- each bag ultimately represents 2267.96185000 canonical grams.
--
-- "case" and "bag" are contextual labels, NOT Foundation units.
-- ---------------------------------------------------------------------------

create table public.ingredient_purchase_specification_package_levels (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  purchase_specification_version_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  package_label text not null
    check (
      package_label <> ''
      and package_label = btrim(package_label)
    ),

  -- Null on ordinal 1.
  -- For later levels, represents how many of this level occur in one parent.
  units_per_parent foundation.physical_quantity,

  -- Present only on the terminal/final package level.
  terminal_quantity foundation.physical_quantity,
  terminal_unit foundation.canonical_unit_code,

  created_at timestamptz not null default now(),

  unique (id, organization_id),
  unique (purchase_specification_version_id, ordinal),

  check (foundation.is_uuid_v4(id)),

  check (
    units_per_parent is null
    or units_per_parent > 0
  ),

  check (
    terminal_quantity is null
    or terminal_quantity > 0
  ),

  check (
    (terminal_quantity is null and terminal_unit is null)
    or
    (terminal_quantity is not null and terminal_unit is not null)
  ),

  foreign key (purchase_specification_version_id, organization_id)
    references public.ingredient_purchase_specification_versions
      (id, organization_id)
);

create unique index ingredient_purchase_specification_one_terminal_idx
  on public.ingredient_purchase_specification_package_levels
  (purchase_specification_version_id)
  where terminal_quantity is not null;

-- ---------------------------------------------------------------------------
-- History immutability
-- ---------------------------------------------------------------------------

create or replace function private.reject_m2_purchase_spec_history_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception
    'purchase specification version/package history is immutable'
    using errcode = '42501';
end;
$$;

revoke all
  on function private.reject_m2_purchase_spec_history_mutation()
  from public, anon, authenticated, service_role;

create trigger ingredient_purchase_specification_versions_immutable
before update or delete
on public.ingredient_purchase_specification_versions
for each row
execute function private.reject_m2_purchase_spec_history_mutation();

create trigger ingredient_purchase_specification_package_levels_immutable
before update or delete
on public.ingredient_purchase_specification_package_levels
for each row
execute function private.reject_m2_purchase_spec_history_mutation();

-- Stable identity fields cannot be changed after creation.
create or replace function private.enforce_m2_purchase_spec_identity_immutability()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.ingredient_id is distinct from old.ingredient_id then
    raise exception
      'purchase specification identity, organization, and ingredient are immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all
  on function private.enforce_m2_purchase_spec_identity_immutability()
  from public, anon, authenticated, service_role;

create trigger ingredient_purchase_specifications_identity_immutable
before update
on public.ingredient_purchase_specifications
for each row
execute function private.enforce_m2_purchase_spec_identity_immutability();

-- ---------------------------------------------------------------------------
-- Package insertion integrity
--
-- Enforces:
-- - first level has no units_per_parent;
-- - later levels require a positive units_per_parent;
-- - ordinals are contiguous;
-- - nothing can be appended after the terminal level;
-- - terminal canonical unit matches the Ingredient base canonical unit.
-- ---------------------------------------------------------------------------

create or replace function private.validate_m2_purchase_spec_package_level_insert()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  expected_unit foundation.canonical_unit_code;
begin
  if new.ordinal = 1 then
    if new.units_per_parent is not null then
      raise exception
        'first package level must not define units_per_parent'
        using errcode = '23514';
    end if;
  else
    if new.units_per_parent is null or new.units_per_parent <= 0 then
      raise exception
        'package levels after ordinal 1 require positive units_per_parent'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.ingredient_purchase_specification_package_levels as previous_level
      where previous_level.purchase_specification_version_id =
            new.purchase_specification_version_id
        and previous_level.ordinal = new.ordinal - 1
    ) then
      raise exception
        'package level ordinals must be contiguous'
        using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1
    from public.ingredient_purchase_specification_package_levels as terminal_level
    where terminal_level.purchase_specification_version_id =
          new.purchase_specification_version_id
      and terminal_level.terminal_quantity is not null
  ) then
    raise exception
      'cannot append package level after terminal level'
      using errcode = '23514';
  end if;

  if new.terminal_quantity is not null then
    select ingredient.base_canonical_unit
      into expected_unit
    from public.ingredient_purchase_specification_versions as version
    join public.ingredient_purchase_specifications as specification
      on specification.id = version.purchase_specification_id
     and specification.organization_id = version.organization_id
    join public.ingredients as ingredient
      on ingredient.id = specification.ingredient_id
     and ingredient.organization_id = specification.organization_id
    where version.id = new.purchase_specification_version_id
      and version.organization_id = new.organization_id;

    if expected_unit is null then
      raise exception
        'purchase specification Ingredient could not be resolved'
        using errcode = '23503';
    end if;

    if new.terminal_unit is distinct from expected_unit then
      raise exception
        'terminal canonical unit must match Ingredient base canonical unit'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_m2_purchase_spec_package_level_insert()
  from public, anon, authenticated, service_role;

create trigger ingredient_purchase_specification_package_level_validate
before insert
on public.ingredient_purchase_specification_package_levels
for each row
execute function private.validate_m2_purchase_spec_package_level_insert();

-- ---------------------------------------------------------------------------
-- RLS / read boundary
-- ---------------------------------------------------------------------------

alter table public.ingredient_purchase_specifications enable row level security;
alter table public.ingredient_purchase_specification_versions enable row level security;
alter table public.ingredient_purchase_specification_package_levels enable row level security;

create policy ingredient_purchase_specifications_read
on public.ingredient_purchase_specifications
for select to authenticated
using (
  private.current_has_permission(
    'm2.purchase_spec.read',
    'organization',
    organization_id,
    null
  )
);

create policy ingredient_purchase_specification_versions_read
on public.ingredient_purchase_specification_versions
for select to authenticated
using (
  private.current_has_permission(
    'm2.purchase_spec.read',
    'organization',
    organization_id,
    null
  )
);

create policy ingredient_purchase_specification_package_levels_read
on public.ingredient_purchase_specification_package_levels
for select to authenticated
using (
  private.current_has_permission(
    'm2.purchase_spec.read',
    'organization',
    organization_id,
    null
  )
);

grant select
  on public.ingredient_purchase_specifications,
     public.ingredient_purchase_specification_versions,
     public.ingredient_purchase_specification_package_levels
  to authenticated, service_role;

revoke insert, update, delete
  on public.ingredient_purchase_specifications,
     public.ingredient_purchase_specification_versions,
     public.ingredient_purchase_specification_package_levels
  from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared package-array validation helper
-- ---------------------------------------------------------------------------

create or replace function private.validate_m2_package_definition(
  p_package_labels text[],
  p_units_per_parent numeric[]
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  level_count integer;
  level_index integer;
begin
  level_count := coalesce(array_length(p_package_labels, 1), 0);

  if level_count < 1 then
    raise exception
      'purchase specification requires at least one package level'
      using errcode = '23514';
  end if;

  if coalesce(array_length(p_units_per_parent, 1), 0) <> level_count then
    raise exception
      'package labels and units_per_parent arrays must have equal length'
      using errcode = '23514';
  end if;

  for level_index in 1..level_count loop
    if p_package_labels[level_index] is null
       or btrim(p_package_labels[level_index]) = '' then
      raise exception
        'package labels must not be empty'
        using errcode = '23514';
    end if;

    if level_index = 1 then
      if p_units_per_parent[level_index] is not null then
        raise exception
          'first package level must not define units_per_parent'
          using errcode = '23514';
      end if;
    else
      if p_units_per_parent[level_index] is null
         or p_units_per_parent[level_index] <= 0 then
        raise exception
          'package levels after ordinal 1 require positive units_per_parent'
          using errcode = '23514';
      end if;
    end if;
  end loop;
end;
$$;

revoke all
  on function private.validate_m2_package_definition(text[], numeric[])
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Create Purchase Specification + immutable version 1 + package structure
-- ---------------------------------------------------------------------------

create or replace function public.m2_create_purchase_specification(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_ingredient_id uuid,
  p_specification_label text,
  p_effective_from timestamptz,
  p_package_labels text[],
  p_units_per_parent numeric[],
  p_terminal_quantity foundation.physical_quantity,
  p_terminal_unit foundation.canonical_unit_code,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  ingredient_record public.ingredients%rowtype;
  new_specification_id uuid;
  new_version_id uuid;
  level_count integer;
  level_index integer;
  package_context jsonb;
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
    'm2.purchase_spec.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage purchase specifications'
      using errcode = '42501';
  end if;

  select ingredient.*
    into ingredient_record
  from public.ingredients as ingredient
  where ingredient.id = p_ingredient_id
    and ingredient.organization_id = p_organization_id;

  if not found then
    raise exception
      'Ingredient does not exist in the requested organization'
      using errcode = '23503';
  end if;

  if ingredient_record.lifecycle_status = 'archived' then
    raise exception
      'cannot create Purchase Specification for archived Ingredient'
      using errcode = '23514';
  end if;

  if p_specification_label is null
     or btrim(p_specification_label) = '' then
    raise exception
      'specification label must not be empty'
      using errcode = '23514';
  end if;

  if p_effective_from is null then
    raise exception
      'effective_from is required'
      using errcode = '23502';
  end if;

  perform private.validate_m2_package_definition(
    p_package_labels,
    p_units_per_parent
  );

  if p_terminal_quantity is null or p_terminal_quantity <= 0 then
    raise exception
      'terminal quantity must be positive'
      using errcode = '23514';
  end if;

  if p_terminal_unit is distinct from ingredient_record.base_canonical_unit then
    raise exception
      'terminal canonical unit must match Ingredient base canonical unit'
      using errcode = '23514';
  end if;

  insert into public.ingredient_purchase_specifications (
    organization_id,
    ingredient_id,
    lifecycle_status
  )
  values (
    p_organization_id,
    p_ingredient_id,
    'active'
  )
  returning id into new_specification_id;

  insert into public.ingredient_purchase_specification_versions (
    organization_id,
    purchase_specification_id,
    version_number,
    specification_label,
    effective_from,
    supersedes_version_id
  )
  values (
    p_organization_id,
    new_specification_id,
    1,
    btrim(p_specification_label),
    p_effective_from,
    null
  )
  returning id into new_version_id;

  level_count := array_length(p_package_labels, 1);

  for level_index in 1..level_count loop
    insert into public.ingredient_purchase_specification_package_levels (
      organization_id,
      purchase_specification_version_id,
      ordinal,
      package_label,
      units_per_parent,
      terminal_quantity,
      terminal_unit
    )
    values (
      p_organization_id,
      new_version_id,
      level_index,
      btrim(p_package_labels[level_index]),
      case
        when level_index = 1 then null
        else p_units_per_parent[level_index]::foundation.physical_quantity
      end,
      case
        when level_index = level_count then p_terminal_quantity
        else null
      end,
      case
        when level_index = level_count then p_terminal_unit
        else null
      end
    );
  end loop;

  select jsonb_agg(
    jsonb_build_object(
      'ordinal', package_level.ordinal,
      'packageLabel', package_level.package_label,
      'unitsPerParent', package_level.units_per_parent,
      'terminalQuantity', package_level.terminal_quantity,
      'terminalUnit', package_level.terminal_unit
    )
    order by package_level.ordinal
  )
  into package_context
  from public.ingredient_purchase_specification_package_levels as package_level
  where package_level.purchase_specification_version_id = new_version_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.purchase_spec.create',
    'ingredient_purchase_specification',
    new_specification_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.create_purchase_specification',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'purchaseSpecificationId', new_specification_id,
        'ingredientId', p_ingredient_id,
        'lifecycleStatus', 'active',
        'versionId', new_version_id,
        'versionNumber', 1,
        'specificationLabel', btrim(p_specification_label),
        'effectiveFrom', p_effective_from,
        'packageLevels', package_context
      )
    )
  );

  return new_specification_id;
end;
$$;

revoke all
  on function public.m2_create_purchase_specification(
    uuid, uuid, text, uuid, uuid, text, timestamptz,
    text[], numeric[], foundation.physical_quantity,
    foundation.canonical_unit_code, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_create_purchase_specification(
    uuid, uuid, text, uuid, uuid, text, timestamptz,
    text[], numeric[], foundation.physical_quantity,
    foundation.canonical_unit_code, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Add immutable new version to an existing Purchase Specification
-- ---------------------------------------------------------------------------

create or replace function public.m2_add_purchase_specification_version(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_purchase_specification_id uuid,
  p_specification_label text,
  p_effective_from timestamptz,
  p_package_labels text[],
  p_units_per_parent numeric[],
  p_terminal_quantity foundation.physical_quantity,
  p_terminal_unit foundation.canonical_unit_code,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  specification_record public.ingredient_purchase_specifications%rowtype;
  ingredient_record public.ingredients%rowtype;
  current_version public.ingredient_purchase_specification_versions%rowtype;
  new_version_id uuid;
  new_version_number integer;
  level_count integer;
  level_index integer;
  package_context jsonb;
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
    'm2.purchase_spec.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage purchase specifications'
      using errcode = '42501';
  end if;

  select specification.*
    into specification_record
  from public.ingredient_purchase_specifications as specification
  where specification.id = p_purchase_specification_id
    and specification.organization_id = p_organization_id;

  if not found then
    raise exception
      'Purchase Specification does not exist in the requested organization'
      using errcode = '23503';
  end if;

  if specification_record.lifecycle_status = 'archived' then
    raise exception
      'cannot version an archived Purchase Specification'
      using errcode = '23514';
  end if;

  select ingredient.*
    into ingredient_record
  from public.ingredients as ingredient
  where ingredient.id = specification_record.ingredient_id
    and ingredient.organization_id = specification_record.organization_id;

  if ingredient_record.lifecycle_status = 'archived' then
    raise exception
      'cannot version Purchase Specification for archived Ingredient'
      using errcode = '23514';
  end if;

  select version.*
    into current_version
  from public.ingredient_purchase_specification_versions as version
  where version.purchase_specification_id = p_purchase_specification_id
  order by version.version_number desc
  limit 1;

  if not found then
    raise exception
      'Purchase Specification has no current version'
      using errcode = '23514';
  end if;

  if p_effective_from is null
     or p_effective_from <= current_version.effective_from then
    raise exception
      'new version effective_from must be later than current version'
      using errcode = '23514';
  end if;

  if p_specification_label is null
     or btrim(p_specification_label) = '' then
    raise exception
      'specification label must not be empty'
      using errcode = '23514';
  end if;

  perform private.validate_m2_package_definition(
    p_package_labels,
    p_units_per_parent
  );

  if p_terminal_quantity is null or p_terminal_quantity <= 0 then
    raise exception
      'terminal quantity must be positive'
      using errcode = '23514';
  end if;

  if p_terminal_unit is distinct from ingredient_record.base_canonical_unit then
    raise exception
      'terminal canonical unit must match Ingredient base canonical unit'
      using errcode = '23514';
  end if;

  new_version_number := current_version.version_number + 1;

  insert into public.ingredient_purchase_specification_versions (
    organization_id,
    purchase_specification_id,
    version_number,
    specification_label,
    effective_from,
    supersedes_version_id
  )
  values (
    p_organization_id,
    p_purchase_specification_id,
    new_version_number,
    btrim(p_specification_label),
    p_effective_from,
    current_version.id
  )
  returning id into new_version_id;

  level_count := array_length(p_package_labels, 1);

  for level_index in 1..level_count loop
    insert into public.ingredient_purchase_specification_package_levels (
      organization_id,
      purchase_specification_version_id,
      ordinal,
      package_label,
      units_per_parent,
      terminal_quantity,
      terminal_unit
    )
    values (
      p_organization_id,
      new_version_id,
      level_index,
      btrim(p_package_labels[level_index]),
      case
        when level_index = 1 then null
        else p_units_per_parent[level_index]::foundation.physical_quantity
      end,
      case
        when level_index = level_count then p_terminal_quantity
        else null
      end,
      case
        when level_index = level_count then p_terminal_unit
        else null
      end
    );
  end loop;

  update public.ingredient_purchase_specifications
  set updated_at = now()
  where id = p_purchase_specification_id
    and organization_id = p_organization_id;

  select jsonb_agg(
    jsonb_build_object(
      'ordinal', package_level.ordinal,
      'packageLabel', package_level.package_label,
      'unitsPerParent', package_level.units_per_parent,
      'terminalQuantity', package_level.terminal_quantity,
      'terminalUnit', package_level.terminal_unit
    )
    order by package_level.ordinal
  )
  into package_context
  from public.ingredient_purchase_specification_package_levels as package_level
  where package_level.purchase_specification_version_id = new_version_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.purchase_spec.version_create',
    'ingredient_purchase_specification',
    p_purchase_specification_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.add_purchase_specification_version',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', jsonb_build_object(
        'versionId', current_version.id,
        'versionNumber', current_version.version_number,
        'specificationLabel', current_version.specification_label,
        'effectiveFrom', current_version.effective_from
      ),
      'after', jsonb_build_object(
        'versionId', new_version_id,
        'versionNumber', new_version_number,
        'specificationLabel', btrim(p_specification_label),
        'effectiveFrom', p_effective_from,
        'supersedesVersionId', current_version.id,
        'packageLevels', package_context
      )
    )
  );

  return new_version_id;
end;
$$;

revoke all
  on function public.m2_add_purchase_specification_version(
    uuid, uuid, text, uuid, uuid, text, timestamptz,
    text[], numeric[], foundation.physical_quantity,
    foundation.canonical_unit_code, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_add_purchase_specification_version(
    uuid, uuid, text, uuid, uuid, text, timestamptz,
    text[], numeric[], foundation.physical_quantity,
    foundation.canonical_unit_code, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Active / inactive lifecycle command
-- ---------------------------------------------------------------------------

create or replace function public.m2_set_purchase_specification_status(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_purchase_specification_id uuid,
  p_lifecycle_status text,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  specification_record public.ingredient_purchase_specifications%rowtype;
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
    'm2.purchase_spec.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage purchase specifications'
      using errcode = '42501';
  end if;

  select specification.*
    into specification_record
  from public.ingredient_purchase_specifications as specification
  where specification.id = p_purchase_specification_id
    and specification.organization_id = p_organization_id;

  if not found then
    raise exception
      'Purchase Specification does not exist in the requested organization'
      using errcode = '23503';
  end if;

  if specification_record.lifecycle_status = 'archived' then
    raise exception
      'archived Purchase Specification cannot be modified'
      using errcode = '23514';
  end if;

  if p_lifecycle_status not in ('active', 'inactive') then
    raise exception
      'Purchase Specification status must be active or inactive'
      using errcode = '23514';
  end if;

  if p_lifecycle_status = specification_record.lifecycle_status then
    raise exception
      'Purchase Specification is already in the requested status'
      using errcode = '23514';
  end if;

  update public.ingredient_purchase_specifications
  set lifecycle_status = p_lifecycle_status,
      updated_at = now()
  where id = p_purchase_specification_id
    and organization_id = p_organization_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.purchase_spec.status_change',
    'ingredient_purchase_specification',
    p_purchase_specification_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.set_purchase_specification_status',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', jsonb_build_object(
        'lifecycleStatus', specification_record.lifecycle_status
      ),
      'after', jsonb_build_object(
        'lifecycleStatus', p_lifecycle_status
      )
    )
  );
end;
$$;

revoke all
  on function public.m2_set_purchase_specification_status(
    uuid, uuid, text, uuid, uuid, text, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_set_purchase_specification_status(
    uuid, uuid, text, uuid, uuid, text, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Non-destructive archive
-- ---------------------------------------------------------------------------

create or replace function public.m2_archive_purchase_specification(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_purchase_specification_id uuid,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  specification_record public.ingredient_purchase_specifications%rowtype;
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
    'm2.purchase_spec.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage purchase specifications'
      using errcode = '42501';
  end if;

  -- Archival is a destructive lifecycle operation and requires AAL2
  -- independently of the role's baseline assurance requirement.
  if not private.aal_satisfies(p_aal, 'aal2') then
    raise exception
      'purchase specification archive requires aal2'
      using errcode = '42501';
  end if;

  select specification.*
    into specification_record
  from public.ingredient_purchase_specifications as specification
  where specification.id = p_purchase_specification_id
    and specification.organization_id = p_organization_id;

  if not found then
    raise exception
      'Purchase Specification does not exist in the requested organization'
      using errcode = '23503';
  end if;

  if specification_record.lifecycle_status = 'archived' then
    raise exception
      'Purchase Specification is already archived'
      using errcode = '23514';
  end if;

  update public.ingredient_purchase_specifications
  set lifecycle_status = 'archived',
      archived_at = now(),
      updated_at = now()
  where id = p_purchase_specification_id
    and organization_id = p_organization_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.purchase_spec.archive',
    'ingredient_purchase_specification',
    p_purchase_specification_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.archive_purchase_specification',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', jsonb_build_object(
        'lifecycleStatus', specification_record.lifecycle_status,
        'archivedAt', specification_record.archived_at
      ),
      'after', jsonb_build_object(
        'lifecycleStatus', 'archived',
        'archivedAt', now()
      )
    )
  );
end;
$$;

revoke all
  on function public.m2_archive_purchase_specification(
    uuid, uuid, text, uuid, uuid, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_archive_purchase_specification(
    uuid, uuid, text, uuid, uuid, uuid
  )
  to service_role;
