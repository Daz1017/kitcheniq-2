-- M2-I03 Supplier Product Mapping + External Identity Foundation.
--
-- Depends on:
-- - frozen Foundation F37 authorization
-- - frozen Foundation F38 external identifier mapping
-- - frozen Foundation F39 audit/provenance
-- - frozen M2-I01 Ingredient identity
-- - frozen M2-I02 Purchase Specification identity
--
-- This checkpoint intentionally does NOT implement Supplier master data,
-- supplier terms, costs, invoices, purchasing preferences, POs, legacy
-- migration, UI, or SMC-01 generic conversion.

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
    'm2.vendor_mapping.manage'
  ));

insert into private.permissions (id)
values
  ('m2.vendor_mapping.read'),
  ('m2.vendor_mapping.manage')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Stable Supplier Product identity
--
-- A Supplier Product is NOT a Supplier master record.
--
-- source_namespace + external_id is an opaque Foundation external reference.
-- Values are preserved exactly. They are never case-folded, parsed as
-- numbers, trimmed, or otherwise normalized.
-- ---------------------------------------------------------------------------

create table public.ingredient_supplier_products (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  source_namespace text not null,
  external_id text not null,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  unique (id, organization_id),
  unique (source_namespace, external_id),

  check (foundation.is_uuid_v4(id)),

  check (
    source_namespace <> ''
    and source_namespace = btrim(source_namespace)
  ),

  check (
    external_id <> ''
    and external_id = btrim(external_id)
  ),

  check (
    (lifecycle_status = 'archived' and archived_at is not null)
    or
    (lifecycle_status <> 'archived' and archived_at is null)
  ),

  foreign key (organization_id)
    references public.organizations(id)
);

create index ingredient_supplier_products_org_idx
  on public.ingredient_supplier_products
  (organization_id);

-- ---------------------------------------------------------------------------
-- Immutable Supplier Product → Purchase Specification mapping history.
--
-- A Supplier Product has one append-only mapping chain.
-- Mapping changes create a new version; historical interpretation is retained.
-- ---------------------------------------------------------------------------

create table public.ingredient_supplier_product_purchase_specification_mappings (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  supplier_product_id uuid not null,
  purchase_specification_id uuid not null,
  version_number integer not null
    check (version_number > 0),
  effective_from timestamptz not null,
  supersedes_mapping_id uuid,
  created_at timestamptz not null default now(),

  unique (id, organization_id),
  unique (id, supplier_product_id),
  unique (supplier_product_id, version_number),

  check (foundation.is_uuid_v4(id)),

  check (
    (
      version_number = 1
      and supersedes_mapping_id is null
    )
    or
    (
      version_number > 1
      and supersedes_mapping_id is not null
    )
  ),

  foreign key (supplier_product_id, organization_id)
    references public.ingredient_supplier_products
      (id, organization_id),

  foreign key (purchase_specification_id, organization_id)
    references public.ingredient_purchase_specifications
      (id, organization_id),

  foreign key (supersedes_mapping_id, supplier_product_id)
    references public.ingredient_supplier_product_purchase_specification_mappings
      (id, supplier_product_id)
);

create index ingredient_supplier_product_mapping_effective_idx
  on public.ingredient_supplier_product_purchase_specification_mappings
  (supplier_product_id, effective_from desc);

create index ingredient_supplier_product_mapping_spec_idx
  on public.ingredient_supplier_product_purchase_specification_mappings
  (organization_id, purchase_specification_id);

-- ---------------------------------------------------------------------------
-- Foundation external-identifier registration.
--
-- The generic Foundation registry remains authoritative for external identity
-- collision protection. Registration occurs in the same transaction as the
-- M2 Supplier Product insert.
--
-- The registry row is intentionally NOT removed when a Supplier Product is
-- archived. Historical external identity cannot be silently reassigned.
-- ---------------------------------------------------------------------------

create or replace function private.register_m2_supplier_product_external_identifier()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into private.external_identifier_mappings (
    source_namespace,
    external_id,
    kitchen_iq_id
  )
  values (
    new.source_namespace,
    new.external_id,
    new.id
  );

  return new;
end;
$$;

create trigger ingredient_supplier_products_external_identifier
after insert on public.ingredient_supplier_products
for each row
execute function private.register_m2_supplier_product_external_identifier();

revoke all
  on function private.register_m2_supplier_product_external_identifier()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Stable identity and history immutability.
-- ---------------------------------------------------------------------------

create or replace function private.guard_m2_supplier_product_identity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Supplier Product identity cannot be physically deleted'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.source_namespace is distinct from old.source_namespace
     or new.external_id is distinct from old.external_id
     or new.created_at is distinct from old.created_at then
    raise exception
      'Supplier Product stable identity is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger ingredient_supplier_products_identity_guard
before update or delete on public.ingredient_supplier_products
for each row
execute function private.guard_m2_supplier_product_identity();

create or replace function private.reject_m2_supplier_product_mapping_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception
    'Supplier Product mapping history is immutable'
    using errcode = '42501';
end;
$$;

create trigger ingredient_supplier_product_mapping_immutable
before update or delete
on public.ingredient_supplier_product_purchase_specification_mappings
for each row
execute function private.reject_m2_supplier_product_mapping_mutation();

revoke all
  on function private.guard_m2_supplier_product_identity()
  from public, anon, authenticated, service_role;

revoke all
  on function private.reject_m2_supplier_product_mapping_mutation()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS / direct mutation boundary.
-- ---------------------------------------------------------------------------

alter table public.ingredient_supplier_products
  enable row level security;

alter table public.ingredient_supplier_product_purchase_specification_mappings
  enable row level security;

create policy ingredient_supplier_products_read
on public.ingredient_supplier_products
for select
to authenticated
using (
  private.current_has_permission(
    'm2.vendor_mapping.read',
    'organization',
    organization_id,
    null
  )
);

create policy ingredient_supplier_product_mappings_read
on public.ingredient_supplier_product_purchase_specification_mappings
for select
to authenticated
using (
  private.current_has_permission(
    'm2.vendor_mapping.read',
    'organization',
    organization_id,
    null
  )
);

revoke all
  on table public.ingredient_supplier_products
  from public, anon, authenticated, service_role;

revoke all
  on table public.ingredient_supplier_product_purchase_specification_mappings
  from public, anon, authenticated, service_role;

grant select
  on table public.ingredient_supplier_products
  to authenticated, service_role;

grant select
  on table public.ingredient_supplier_product_purchase_specification_mappings
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Create Supplier Product + initial Purchase Specification mapping.
-- ---------------------------------------------------------------------------

create or replace function public.m2_create_supplier_product_mapping(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_source_namespace text,
  p_external_id text,
  p_purchase_specification_id uuid,
  p_effective_from timestamptz,
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
  new_supplier_product_id uuid;
  new_mapping_id uuid;
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
    'm2.vendor_mapping.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Supplier Product mappings'
      using errcode = '42501';
  end if;

  if p_source_namespace is null
     or p_source_namespace = ''
     or p_source_namespace <> btrim(p_source_namespace) then
    raise exception
      'source namespace must be a non-empty opaque string without surrounding whitespace'
      using errcode = '23514';
  end if;

  if p_external_id is null
     or p_external_id = ''
     or p_external_id <> btrim(p_external_id) then
    raise exception
      'external identifier must be a non-empty opaque string without surrounding whitespace'
      using errcode = '23514';
  end if;

  if p_effective_from is null then
    raise exception
      'effective_from is required'
      using errcode = '23502';
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
      'cannot map Supplier Product to archived Purchase Specification'
      using errcode = '23514';
  end if;

  select ingredient.*
    into ingredient_record
  from public.ingredients as ingredient
  where ingredient.id = specification_record.ingredient_id
    and ingredient.organization_id = p_organization_id;

  if not found then
    raise exception
      'Ingredient for Purchase Specification does not exist'
      using errcode = '23503';
  end if;

  if ingredient_record.lifecycle_status = 'archived' then
    raise exception
      'cannot map Supplier Product to Purchase Specification for archived Ingredient'
      using errcode = '23514';
  end if;

  insert into public.ingredient_supplier_products (
    organization_id,
    source_namespace,
    external_id,
    lifecycle_status
  )
  values (
    p_organization_id,
    p_source_namespace,
    p_external_id,
    'active'
  )
  returning id into new_supplier_product_id;

  insert into public.ingredient_supplier_product_purchase_specification_mappings (
    organization_id,
    supplier_product_id,
    purchase_specification_id,
    version_number,
    effective_from,
    supersedes_mapping_id
  )
  values (
    p_organization_id,
    new_supplier_product_id,
    p_purchase_specification_id,
    1,
    p_effective_from,
    null
  )
  returning id into new_mapping_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.vendor_mapping.create',
    'ingredient_supplier_product',
    new_supplier_product_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.create_supplier_product_mapping',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'supplierProductId', new_supplier_product_id,
        'externalRef', jsonb_build_object(
          'sourceNamespace', p_source_namespace,
          'externalId', p_external_id
        ),
        'lifecycleStatus', 'active',
        'mappingId', new_mapping_id,
        'mappingVersion', 1,
        'purchaseSpecificationId', p_purchase_specification_id,
        'effectiveFrom', p_effective_from
      )
    )
  );

  return new_supplier_product_id;
end;
$$;

revoke all
  on function public.m2_create_supplier_product_mapping(
    uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_create_supplier_product_mapping(
    uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Append a new immutable Supplier Product mapping version.
-- ---------------------------------------------------------------------------

create or replace function public.m2_add_supplier_product_mapping_version(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_supplier_product_id uuid,
  p_purchase_specification_id uuid,
  p_effective_from timestamptz,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  supplier_product_record public.ingredient_supplier_products%rowtype;
  specification_record public.ingredient_purchase_specifications%rowtype;
  ingredient_record public.ingredients%rowtype;
  current_mapping
    public.ingredient_supplier_product_purchase_specification_mappings%rowtype;
  new_mapping_id uuid;
  new_version_number integer;
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
    'm2.vendor_mapping.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Supplier Product mappings'
      using errcode = '42501';
  end if;

  select supplier_product.*
    into supplier_product_record
  from public.ingredient_supplier_products as supplier_product
  where supplier_product.id = p_supplier_product_id
    and supplier_product.organization_id = p_organization_id;

  if not found then
    raise exception
      'Supplier Product does not exist in the requested organization'
      using errcode = '23503';
  end if;

  if supplier_product_record.lifecycle_status = 'archived' then
    raise exception
      'cannot remap archived Supplier Product'
      using errcode = '23514';
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
      'cannot map Supplier Product to archived Purchase Specification'
      using errcode = '23514';
  end if;

  select ingredient.*
    into ingredient_record
  from public.ingredients as ingredient
  where ingredient.id = specification_record.ingredient_id
    and ingredient.organization_id = p_organization_id;

  if not found then
    raise exception
      'Ingredient for Purchase Specification does not exist'
      using errcode = '23503';
  end if;

  if ingredient_record.lifecycle_status = 'archived' then
    raise exception
      'cannot map Supplier Product to Purchase Specification for archived Ingredient'
      using errcode = '23514';
  end if;

  select mapping.*
    into current_mapping
  from public.ingredient_supplier_product_purchase_specification_mappings
    as mapping
  where mapping.supplier_product_id = p_supplier_product_id
    and mapping.organization_id = p_organization_id
  order by mapping.version_number desc
  limit 1;

  if not found then
    raise exception
      'Supplier Product has no current Purchase Specification mapping'
      using errcode = '23514';
  end if;

  if p_effective_from is null
     or p_effective_from <= current_mapping.effective_from then
    raise exception
      'new mapping effective_from must be later than current mapping'
      using errcode = '23514';
  end if;

  if current_mapping.purchase_specification_id
     = p_purchase_specification_id then
    raise exception
      'new mapping must change the Purchase Specification'
      using errcode = '23514';
  end if;

  new_version_number := current_mapping.version_number + 1;

  insert into public.ingredient_supplier_product_purchase_specification_mappings (
    organization_id,
    supplier_product_id,
    purchase_specification_id,
    version_number,
    effective_from,
    supersedes_mapping_id
  )
  values (
    p_organization_id,
    p_supplier_product_id,
    p_purchase_specification_id,
    new_version_number,
    p_effective_from,
    current_mapping.id
  )
  returning id into new_mapping_id;

  update public.ingredient_supplier_products
  set updated_at = now()
  where id = p_supplier_product_id
    and organization_id = p_organization_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.vendor_mapping.version_create',
    'ingredient_supplier_product',
    p_supplier_product_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.add_supplier_product_mapping_version',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', jsonb_build_object(
        'mappingId', current_mapping.id,
        'mappingVersion', current_mapping.version_number,
        'purchaseSpecificationId',
          current_mapping.purchase_specification_id,
        'effectiveFrom', current_mapping.effective_from
      ),
      'after', jsonb_build_object(
        'mappingId', new_mapping_id,
        'mappingVersion', new_version_number,
        'purchaseSpecificationId', p_purchase_specification_id,
        'effectiveFrom', p_effective_from,
        'supersedesMappingId', current_mapping.id
      )
    )
  );

  return new_mapping_id;
end;
$$;

revoke all
  on function public.m2_add_supplier_product_mapping_version(
    uuid, uuid, text, uuid, uuid, uuid, timestamptz, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_add_supplier_product_mapping_version(
    uuid, uuid, text, uuid, uuid, uuid, timestamptz, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Active / inactive lifecycle transition.
-- ---------------------------------------------------------------------------

create or replace function public.m2_set_supplier_product_status(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_supplier_product_id uuid,
  p_lifecycle_status text,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  supplier_product_record public.ingredient_supplier_products%rowtype;
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
    'm2.vendor_mapping.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Supplier Product mappings'
      using errcode = '42501';
  end if;

  select supplier_product.*
    into supplier_product_record
  from public.ingredient_supplier_products as supplier_product
  where supplier_product.id = p_supplier_product_id
    and supplier_product.organization_id = p_organization_id;

  if not found then
    raise exception
      'Supplier Product does not exist in the requested organization'
      using errcode = '23503';
  end if;

  if supplier_product_record.lifecycle_status = 'archived' then
    raise exception
      'archived Supplier Product lifecycle cannot be changed'
      using errcode = '23514';
  end if;

  if p_lifecycle_status not in ('active', 'inactive') then
    raise exception
      'Supplier Product lifecycle status must be active or inactive'
      using errcode = '23514';
  end if;

  if supplier_product_record.lifecycle_status = p_lifecycle_status then
    raise exception
      'Supplier Product is already in requested lifecycle status'
      using errcode = '23514';
  end if;

  update public.ingredient_supplier_products
  set lifecycle_status = p_lifecycle_status,
      updated_at = now()
  where id = p_supplier_product_id
    and organization_id = p_organization_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.vendor_mapping.status_change',
    'ingredient_supplier_product',
    p_supplier_product_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.set_supplier_product_status',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', jsonb_build_object(
        'lifecycleStatus',
          supplier_product_record.lifecycle_status
      ),
      'after', jsonb_build_object(
        'lifecycleStatus', p_lifecycle_status
      )
    )
  );
end;
$$;

revoke all
  on function public.m2_set_supplier_product_status(
    uuid, uuid, text, uuid, uuid, text, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_set_supplier_product_status(
    uuid, uuid, text, uuid, uuid, text, uuid
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Archive Supplier Product.
--
-- Archive is destructive lifecycle control and therefore explicitly requires
-- AAL2 independently of the caller role's baseline assurance.
-- ---------------------------------------------------------------------------

create or replace function public.m2_archive_supplier_product(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_supplier_product_id uuid,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  supplier_product_record public.ingredient_supplier_products%rowtype;
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
    'm2.vendor_mapping.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Supplier Product mappings'
      using errcode = '42501';
  end if;

  if not private.aal_satisfies(p_aal, 'aal2') then
    raise exception
      'Supplier Product archive requires aal2'
      using errcode = '42501';
  end if;

  select supplier_product.*
    into supplier_product_record
  from public.ingredient_supplier_products as supplier_product
  where supplier_product.id = p_supplier_product_id
    and supplier_product.organization_id = p_organization_id;

  if not found then
    raise exception
      'Supplier Product does not exist in the requested organization'
      using errcode = '23503';
  end if;

  if supplier_product_record.lifecycle_status = 'archived' then
    raise exception
      'Supplier Product is already archived'
      using errcode = '23514';
  end if;

  update public.ingredient_supplier_products
  set lifecycle_status = 'archived',
      archived_at = now(),
      updated_at = now()
  where id = p_supplier_product_id
    and organization_id = p_organization_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.vendor_mapping.archive',
    'ingredient_supplier_product',
    p_supplier_product_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.archive_supplier_product',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', jsonb_build_object(
        'lifecycleStatus',
          supplier_product_record.lifecycle_status,
        'archivedAt',
          supplier_product_record.archived_at
      ),
      'after', jsonb_build_object(
        'lifecycleStatus', 'archived',
        'archivedAt', now()
      ),
      'externalRef', jsonb_build_object(
        'sourceNamespace',
          supplier_product_record.source_namespace,
        'externalId',
          supplier_product_record.external_id
      )
    )
  );
end;
$$;

revoke all
  on function public.m2_archive_supplier_product(
    uuid, uuid, text, uuid, uuid, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_archive_supplier_product(
    uuid, uuid, text, uuid, uuid, uuid
  )
  to service_role;
