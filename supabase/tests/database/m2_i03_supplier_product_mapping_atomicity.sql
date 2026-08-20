begin;
select plan(18);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at
)
values (
  '550e8400-e29b-41d4-a716-446655443001',
  'authenticated',
  'authenticated',
  'm2-i03-atomicity@example.test',
  '',
  now()
);

insert into public.organizations (id)
values (
  '550e8400-e29b-41d4-a716-446655443002'
);

insert into public.ingredients (
  id,
  organization_id,
  display_name,
  base_canonical_unit,
  lifecycle_status
)
values (
  '550e8400-e29b-41d4-a716-446655443003',
  '550e8400-e29b-41d4-a716-446655443002',
  'M2-I03 Atomic Ingredient',
  'g',
  'active'
);

insert into public.ingredient_purchase_specifications (
  id,
  organization_id,
  ingredient_id,
  lifecycle_status
)
values
  (
    '550e8400-e29b-41d4-a716-446655443004',
    '550e8400-e29b-41d4-a716-446655443002',
    '550e8400-e29b-41d4-a716-446655443003',
    'active'
  ),
  (
    '550e8400-e29b-41d4-a716-446655443005',
    '550e8400-e29b-41d4-a716-446655443002',
    '550e8400-e29b-41d4-a716-446655443003',
    'active'
  );

insert into private.role_permissions (
  role_class,
  permission_id
)
values (
  'manager',
  'm2.vendor_mapping.manage'
)
on conflict do nothing;

insert into private.role_assignments (
  application_user_id,
  role_class,
  scope_kind,
  organization_id
)
values (
  (
    select id
    from private.application_users
    where auth_principal_id =
      '550e8400-e29b-41d4-a716-446655443001'
  ),
  'manager',
  'organization',
  '550e8400-e29b-41d4-a716-446655443002'
);

select lives_ok(
  $$
    select public.m2_create_supplier_product_mapping(
      '550e8400-e29b-41d4-a716-446655443001',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655443001'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655443002',
      'atomic_vendor',
      '000123',
      '550e8400-e29b-41d4-a716-446655443004',
      '2026-08-19T12:00:00Z',
      '550e8400-e29b-41d4-a716-446655443006'
    )
  $$,
  'M2-I03 creation succeeds before forced audit failure'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_supplier_products
    where source_namespace = 'atomic_vendor'
      and external_id = '000123'
  ),
  1,
  'Supplier Product persists'
);

select is(
  (
    select count(*)::integer
    from private.external_identifier_mappings
    where source_namespace = 'atomic_vendor'
      and external_id = '000123'
  ),
  1,
  'Foundation external identifier registration persists'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_supplier_product_purchase_specification_mappings
  ),
  1,
  'initial mapping persists'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655443006'
  ),
  1,
  'create audit persists'
);

create temporary table f39_force_audit_failure (
  marker boolean
);

select throws_ok(
  $$
    select public.m2_create_supplier_product_mapping(
      '550e8400-e29b-41d4-a716-446655443001',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655443001'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655443002',
      'forced_create',
      '000999',
      '550e8400-e29b-41d4-a716-446655443004',
      '2026-08-19T13:00:00Z',
      '550e8400-e29b-41d4-a716-446655443007'
    )
  $$,
  'P0001',
  null,
  'forced audit failure rejects Supplier Product create'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_supplier_products
    where source_namespace = 'forced_create'
  ),
  0,
  'forced create rolls back Supplier Product'
);

select is(
  (
    select count(*)::integer
    from private.external_identifier_mappings
    where source_namespace = 'forced_create'
  ),
  0,
  'forced create rolls back Foundation registration'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_supplier_product_purchase_specification_mappings
    where supplier_product_id in (
      select id
      from public.ingredient_supplier_products
      where source_namespace = 'forced_create'
    )
  ),
  0,
  'forced create leaves no mapping'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655443007'
  ),
  0,
  'forced create leaves no audit'
);

drop table f39_force_audit_failure;

create temporary table f39_force_audit_failure (
  marker boolean
);

select throws_ok(
  $$
    select public.m2_add_supplier_product_mapping_version(
      '550e8400-e29b-41d4-a716-446655443001',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655443001'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655443002',
      (
        select id
        from public.ingredient_supplier_products
        where source_namespace = 'atomic_vendor'
          and external_id = '000123'
      ),
      '550e8400-e29b-41d4-a716-446655443005',
      '2026-08-20T12:00:00Z',
      '550e8400-e29b-41d4-a716-446655443008'
    )
  $$,
  'P0001',
  null,
  'forced audit failure rejects mapping version'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_supplier_product_purchase_specification_mappings
  ),
  1,
  'forced version creation leaves mapping count unchanged'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655443008'
  ),
  0,
  'forced version creation leaves no audit'
);

drop table f39_force_audit_failure;

create temporary table f39_force_audit_failure (
  marker boolean
);

select throws_ok(
  $$
    select public.m2_archive_supplier_product(
      '550e8400-e29b-41d4-a716-446655443001',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655443001'
      ),
      'aal2',
      '550e8400-e29b-41d4-a716-446655443002',
      (
        select id
        from public.ingredient_supplier_products
        where source_namespace = 'atomic_vendor'
          and external_id = '000123'
      ),
      '550e8400-e29b-41d4-a716-446655443009'
    )
  $$,
  'P0001',
  null,
  'forced audit failure rejects archive'
);

select is(
  (
    select lifecycle_status
    from public.ingredient_supplier_products
    where source_namespace = 'atomic_vendor'
      and external_id = '000123'
  ),
  'active',
  'forced archive rolls lifecycle back to active'
);

select is(
  (
    select count(*)::integer
    from private.external_identifier_mappings
    where source_namespace = 'atomic_vendor'
      and external_id = '000123'
  ),
  1,
  'forced archive does not remove historical external identity'
);

drop table f39_force_audit_failure;

select throws_ok(
  $$
    update public.ingredient_supplier_product_purchase_specification_mappings
    set effective_from =
      '2027-01-01T00:00:00Z'
  $$,
  '42501',
  null,
  'mapping history cannot be updated'
);

select throws_ok(
  $$
    delete
    from public.ingredient_supplier_product_purchase_specification_mappings
  $$,
  '42501',
  null,
  'mapping history cannot be deleted'
);

select * from finish();
rollback;
