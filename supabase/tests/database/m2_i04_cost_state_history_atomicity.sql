begin;
select plan(10);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at
)
values (
  '550e8400-e29b-41d4-a716-446655445001',
  'authenticated',
  'authenticated',
  'm2-i04-atomicity@example.test',
  '',
  now()
);

insert into public.organizations (id)
values (
  '550e8400-e29b-41d4-a716-446655445002'
);

insert into public.ingredients (
  id,
  organization_id,
  display_name,
  base_canonical_unit,
  lifecycle_status
)
values (
  '550e8400-e29b-41d4-a716-446655445003',
  '550e8400-e29b-41d4-a716-446655445002',
  'M2-I04 Atomic Ingredient',
  'g',
  'active'
);

insert into public.ingredient_purchase_specifications (
  id,
  organization_id,
  ingredient_id,
  lifecycle_status
)
values (
  '550e8400-e29b-41d4-a716-446655445004',
  '550e8400-e29b-41d4-a716-446655445002',
  '550e8400-e29b-41d4-a716-446655445003',
  'active'
);

insert into private.role_permissions (
  role_class,
  permission_id
)
values (
  'manager',
  'm2.cost.manage'
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
      '550e8400-e29b-41d4-a716-446655445001'
  ),
  'manager',
  'organization',
  '550e8400-e29b-41d4-a716-446655445002'
);

select lives_ok(
  $$
    select public.m2_record_purchase_specification_cost(
      '550e8400-e29b-41d4-a716-446655445001',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655445001'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655445002',
      '550e8400-e29b-41d4-a716-446655445004',
      'known',
      '12.345678895',
      'USD',
      'manual',
      null,
      '2026-08-20T12:00:00Z',
      '550e8400-e29b-41d4-a716-446655445005'
    )
  $$,
  'M2-I04 cost recording succeeds before forced audit failure'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_purchase_specification_cost_observations
  ),
  1,
  'cost observation persists'
);

select is(
  (
    select unit_cost::text
    from public.ingredient_purchase_specification_cost_observations
  ),
  '12.34567890',
  'unit cost persists at Foundation scale 8 with half-up rounding'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655445005'
  ),
  1,
  'cost audit persists'
);

select is(
  (
    select retention_profile::text
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655445005'
  ),
  'financial_security',
  'cost audit uses financial_security retention'
);

create temporary table f39_force_audit_failure (
  marker boolean
);

select throws_ok(
  $$
    select public.m2_record_purchase_specification_cost(
      '550e8400-e29b-41d4-a716-446655445001',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655445001'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655445002',
      '550e8400-e29b-41d4-a716-446655445004',
      'known',
      '99',
      'USD',
      'manual',
      null,
      '2026-08-21T12:00:00Z',
      '550e8400-e29b-41d4-a716-446655445006'
    )
  $$,
  'P0001',
  null,
  'forced audit failure rejects cost observation'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_purchase_specification_cost_observations
  ),
  1,
  'forced audit failure rolls back cost observation'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655445006'
  ),
  0,
  'forced cost failure leaves no audit'
);

drop table f39_force_audit_failure;

select throws_ok(
  $$
    update public.ingredient_purchase_specification_cost_observations
    set unit_cost = '77'
  $$,
  '42501',
  null,
  'cost history update is rejected'
);

select throws_ok(
  $$
    delete from public.ingredient_purchase_specification_cost_observations
  $$,
  '42501',
  null,
  'cost history delete is rejected'
);

select * from finish();
rollback;
