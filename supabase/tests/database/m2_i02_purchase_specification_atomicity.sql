begin;
select plan(12);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at
)
values (
  '550e8400-e29b-41d4-a716-446655440301',
  'authenticated',
  'authenticated',
  'm2-i02-atomicity@example.test',
  '',
  now()
);

insert into public.organizations (id)
values ('550e8400-e29b-41d4-a716-446655440302');

insert into public.ingredients (
  id,
  organization_id,
  display_name,
  base_canonical_unit,
  lifecycle_status
)
values (
  '550e8400-e29b-41d4-a716-446655440303',
  '550e8400-e29b-41d4-a716-446655440302',
  'Atomic Ingredient',
  'g',
  'active'
);

insert into private.role_permissions (
  role_class,
  permission_id
)
values
  ('manager', 'm2.purchase_spec.manage')
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
      '550e8400-e29b-41d4-a716-446655440301'
  ),
  'manager',
  'organization',
  '550e8400-e29b-41d4-a716-446655440302'
);

select lives_ok(
  $$
    select public.m2_create_purchase_specification(
      '550e8400-e29b-41d4-a716-446655440301',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655440301'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655440302',
      '550e8400-e29b-41d4-a716-446655440303',
      'Atomic Version One',
      '2026-08-19T12:00:00Z',
      array['case']::text[],
      array[null::numeric]::numeric[],
      '100'::foundation.physical_quantity,
      'g'::foundation.canonical_unit_code,
      '550e8400-e29b-41d4-a716-446655440304'
    )
  $$,
  'M2-I02 create succeeds before forced audit failure'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_purchase_specification_versions
    where specification_label = 'Atomic Version One'
  ),
  1,
  'initial Purchase Specification version persisted'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655440304'
  ),
  1,
  'initial Purchase Specification audit persisted'
);

create temporary table f39_force_audit_failure (
  marker boolean
);

select throws_ok(
  $$
    select public.m2_create_purchase_specification(
      '550e8400-e29b-41d4-a716-446655440301',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655440301'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655440302',
      '550e8400-e29b-41d4-a716-446655440303',
      'Forced Create Rollback',
      '2026-08-19T13:00:00Z',
      array['case']::text[],
      array[null::numeric]::numeric[],
      '200'::foundation.physical_quantity,
      'g'::foundation.canonical_unit_code,
      '550e8400-e29b-41d4-a716-446655440305'
    )
  $$,
  'P0001',
  null,
  'forced audit failure rejects M2-I02 create'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_purchase_specification_versions
    where specification_label = 'Forced Create Rollback'
  ),
  0,
  'forced create leaves no version'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655440305'
  ),
  0,
  'forced create leaves no audit record'
);

drop table f39_force_audit_failure;

create temporary table f39_force_audit_failure (
  marker boolean
);

select throws_ok(
  $$
    select public.m2_add_purchase_specification_version(
      '550e8400-e29b-41d4-a716-446655440301',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655440301'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655440302',
      (
        select purchase_specification_id
        from public.ingredient_purchase_specification_versions
        where specification_label = 'Atomic Version One'
      ),
      'Forced Version Rollback',
      '2026-08-20T12:00:00Z',
      array['case']::text[],
      array[null::numeric]::numeric[],
      '150'::foundation.physical_quantity,
      'g'::foundation.canonical_unit_code,
      '550e8400-e29b-41d4-a716-446655440306'
    )
  $$,
  'P0001',
  null,
  'forced audit failure rejects new immutable version'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_purchase_specification_versions
    where purchase_specification_id = (
      select purchase_specification_id
      from public.ingredient_purchase_specification_versions
      where specification_label = 'Atomic Version One'
    )
  ),
  1,
  'forced version creation leaves historical version count unchanged'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_purchase_specification_versions
    where specification_label = 'Forced Version Rollback'
  ),
  0,
  'forced new version leaves no version row'
);

drop table f39_force_audit_failure;

select throws_ok(
  $$
    update public.ingredient_purchase_specification_versions
    set specification_label = 'Illegal Rewrite'
    where specification_label = 'Atomic Version One'
  $$,
  '42501',
  null,
  'historical specification version cannot be updated'
);

select throws_ok(
  $$
    delete from public.ingredient_purchase_specification_package_levels
    where purchase_specification_version_id = (
      select id
      from public.ingredient_purchase_specification_versions
      where specification_label = 'Atomic Version One'
    )
  $$,
  '42501',
  null,
  'historical package structure cannot be deleted'
);

select is(
  (
    select specification_label
    from public.ingredient_purchase_specification_versions
    where version_number = 1
      and specification_label = 'Atomic Version One'
  ),
  'Atomic Version One',
  'historical version remains unchanged'
);

select * from finish();
rollback;
