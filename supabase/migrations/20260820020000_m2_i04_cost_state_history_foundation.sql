-- M2-I04 Ingredient Cost State + Cost History Foundation.
--
-- Cost truth is owned at the Purchase Specification level.
-- This checkpoint does NOT establish an Ingredient preferred/current cost,
-- Supplier master data, invoice evidence, purchasing recommendations,
-- inventory valuation, recipe costing, plate costing, legacy migration,
-- UI, or SMC-01 conversions.

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
    'm2.cost.manage'
  ));

insert into private.permissions (id)
values
  ('m2.cost.read'),
  ('m2.cost.manage')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Immutable authoritative Purchase Specification cost observations.
-- ---------------------------------------------------------------------------

create table public.ingredient_purchase_specification_cost_observations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  purchase_specification_id uuid not null,

  value_state foundation.value_state not null
    check (value_state in ('known', 'unknown')),

  unit_cost foundation.unit_cost_amount,
  currency foundation.currency_code,

  source_kind text not null
    check (source_kind in ('manual', 'supplier_product')),

  supplier_product_id uuid,

  effective_from timestamptz not null,
  created_at timestamptz not null default now(),

  unique (id, organization_id),

  -- There is one authoritative state change for a Purchase Specification
  -- at an exact effective instant.
  unique (purchase_specification_id, effective_from),

  check (foundation.is_uuid_v4(id)),

  check (
    foundation.is_valid_value_state_pair(
      value_state,
      unit_cost is not null
    )
  ),

  check (
    (value_state = 'known' and currency is not null)
    or
    (value_state = 'unknown' and currency is null)
  ),

  check (
    unit_cost is null
    or unit_cost >= 0
  ),

  check (
    (
      source_kind = 'manual'
      and supplier_product_id is null
    )
    or
    (
      source_kind = 'supplier_product'
      and supplier_product_id is not null
    )
  ),

  foreign key (
    purchase_specification_id,
    organization_id
  )
    references public.ingredient_purchase_specifications
      (id, organization_id),

  foreign key (
    supplier_product_id,
    organization_id
  )
    references public.ingredient_supplier_products
      (id, organization_id)
);

create index ingredient_purchase_spec_cost_effective_idx
  on public.ingredient_purchase_specification_cost_observations
  (
    purchase_specification_id,
    effective_from desc
  );

create index ingredient_purchase_spec_cost_supplier_product_idx
  on public.ingredient_purchase_specification_cost_observations
  (
    organization_id,
    supplier_product_id
  )
  where supplier_product_id is not null;

-- ---------------------------------------------------------------------------
-- History immutability.
-- ---------------------------------------------------------------------------

create or replace function private.reject_m2_cost_history_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception
    'Purchase Specification cost history is immutable'
    using errcode = '42501';
end;
$$;

create trigger ingredient_purchase_specification_cost_history_immutable
before update or delete
on public.ingredient_purchase_specification_cost_observations
for each row
execute function private.reject_m2_cost_history_mutation();

revoke all
  on function private.reject_m2_cost_history_mutation()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Validate Supplier Product provenance against the effective I03 mapping.
-- ---------------------------------------------------------------------------

create or replace function private.m2_supplier_product_maps_to_purchase_spec_at(
  p_organization_id uuid,
  p_supplier_product_id uuid,
  p_purchase_specification_id uuid,
  p_effective_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(
    (
      select mapping.purchase_specification_id
      from public.ingredient_supplier_product_purchase_specification_mappings
        as mapping
      where mapping.organization_id = p_organization_id
        and mapping.supplier_product_id = p_supplier_product_id
        and mapping.effective_from <= p_effective_at
      order by
        mapping.effective_from desc,
        mapping.version_number desc
      limit 1
    ) = p_purchase_specification_id,
    false
  );
$$;

revoke all
  on function private.m2_supplier_product_maps_to_purchase_spec_at(
    uuid, uuid, uuid, timestamptz
  )
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS / direct mutation boundary.
-- ---------------------------------------------------------------------------

alter table public.ingredient_purchase_specification_cost_observations
  enable row level security;

create policy ingredient_purchase_specification_cost_observations_read
on public.ingredient_purchase_specification_cost_observations
for select
to authenticated
using (
  private.current_has_permission(
    'm2.cost.read',
    'organization',
    organization_id,
    null
  )
);

revoke all
  on table public.ingredient_purchase_specification_cost_observations
  from public, anon, authenticated, service_role;

grant select
  on table public.ingredient_purchase_specification_cost_observations
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record immutable authoritative cost state.
-- ---------------------------------------------------------------------------

create or replace function public.m2_record_purchase_specification_cost(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_purchase_specification_id uuid,
  p_value_state foundation.value_state,
  p_unit_cost foundation.unit_cost_amount,
  p_currency foundation.currency_code,
  p_source_kind text,
  p_supplier_product_id uuid,
  p_effective_from timestamptz,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  specification_record
    public.ingredient_purchase_specifications%rowtype;
  ingredient_record
    public.ingredients%rowtype;
  supplier_product_record
    public.ingredient_supplier_products%rowtype;
  new_observation_id uuid;
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
    'm2.cost.manage',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception
      'caller is not authorized to manage Purchase Specification cost'
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
      'cannot record cost for archived Purchase Specification'
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
      'cannot record cost for Purchase Specification of archived Ingredient'
      using errcode = '23514';
  end if;

  if p_effective_from is null then
    raise exception
      'cost effective_from is required'
      using errcode = '23502';
  end if;

  if p_value_state not in ('known', 'unknown') then
    raise exception
      'Purchase Specification cost state must be known or unknown'
      using errcode = '23514';
  end if;

  if p_value_state = 'known' then
    if p_unit_cost is null then
      raise exception
        'known cost state requires unit cost'
        using errcode = '23514';
    end if;

    if p_unit_cost < 0 then
      raise exception
        'unit cost cannot be negative'
        using errcode = '23514';
    end if;

    if p_currency is null then
      raise exception
        'known cost state requires currency'
        using errcode = '23514';
    end if;
  else
    if p_unit_cost is not null
       or p_currency is not null then
      raise exception
        'unknown cost state cannot contain unit cost or currency'
        using errcode = '23514';
    end if;
  end if;

  if p_source_kind not in (
    'manual',
    'supplier_product'
  ) then
    raise exception
      'unsupported M2-I04 cost source kind'
      using errcode = '23514';
  end if;

  if p_source_kind = 'manual' then
    if p_supplier_product_id is not null then
      raise exception
        'manual cost source cannot reference Supplier Product'
        using errcode = '23514';
    end if;
  else
    if p_supplier_product_id is null then
      raise exception
        'Supplier Product cost source requires Supplier Product identity'
        using errcode = '23514';
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
        'cannot record new cost from archived Supplier Product'
        using errcode = '23514';
    end if;

    if not private.m2_supplier_product_maps_to_purchase_spec_at(
      p_organization_id,
      p_supplier_product_id,
      p_purchase_specification_id,
      p_effective_from
    ) then
      raise exception
        'Supplier Product does not map to Purchase Specification at cost effective time'
        using errcode = '23514';
    end if;
  end if;

  insert into public.ingredient_purchase_specification_cost_observations (
    organization_id,
    purchase_specification_id,
    value_state,
    unit_cost,
    currency,
    source_kind,
    supplier_product_id,
    effective_from
  )
  values (
    p_organization_id,
    p_purchase_specification_id,
    p_value_state,
    p_unit_cost,
    p_currency,
    p_source_kind,
    p_supplier_product_id,
    p_effective_from
  )
  returning id into new_observation_id;

  perform private.append_audit_record(
    p_application_user_id,
    'm2.cost.record',
    'ingredient_purchase_specification_cost_observation',
    new_observation_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'm2.record_purchase_specification_cost',
    '1',
    'financial_security',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'costObservationId', new_observation_id,
        'purchaseSpecificationId',
          p_purchase_specification_id,
        'valueState', p_value_state,
        'unitCost', p_unit_cost,
        'currency', p_currency,
        'sourceKind', p_source_kind,
        'supplierProductId',
          p_supplier_product_id,
        'effectiveFrom',
          p_effective_from
      )
    )
  );

  return new_observation_id;
end;
$$;

revoke all
  on function public.m2_record_purchase_specification_cost(
    uuid, uuid, text, uuid, uuid,
    foundation.value_state,
    foundation.unit_cost_amount,
    foundation.currency_code,
    text, uuid, timestamptz, uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.m2_record_purchase_specification_cost(
    uuid, uuid, text, uuid, uuid,
    foundation.value_state,
    foundation.unit_cost_amount,
    foundation.currency_code,
    text, uuid, timestamptz, uuid
  )
  to service_role;
