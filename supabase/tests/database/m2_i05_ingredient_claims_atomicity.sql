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
  '550e8400-e29b-41d4-a716-446655446101',
  'authenticated',
  'authenticated',
  'm2-i05-atomicity@example.test',
  '',
  now()
);

insert into public.organizations (id)
values (
  '550e8400-e29b-41d4-a716-446655446102'
);

insert into public.ingredients (
  id,
  organization_id,
  display_name,
  base_canonical_unit,
  lifecycle_status
)
values (
  '550e8400-e29b-41d4-a716-446655446103',
  '550e8400-e29b-41d4-a716-446655446102',
  'M2-I05 Atomic Ingredient',
  'ea',
  'active'
);

insert into private.role_permissions (
  role_class,
  permission_id
)
values (
  'manager',
  'm2.claim.manage'
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
      '550e8400-e29b-41d4-a716-446655446101'
  ),
  'manager',
  'organization',
  '550e8400-e29b-41d4-a716-446655446102'
);

select lives_ok(
  $$
    select public.m2_create_ingredient_claim_definition(
      '550e8400-e29b-41d4-a716-446655446101',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655446101'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655446102',
      'contains_shellfish',
      'Contains Shellfish',
      'Organization-governed shellfish claim',
      '550e8400-e29b-41d4-a716-446655446104'
    )
  $$,
  'M2-I05 claim definition creation succeeds'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_claim_definitions
  ),
  1,
  'claim definition persists'
);

select is(
  (
    select retention_profile::text
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655446104'
  ),
  'protected_operational',
  'claim definition audit uses protected_operational retention'
);

select lives_ok(
  $$
    select public.m2_record_ingredient_claim_assertion(
      '550e8400-e29b-41d4-a716-446655446101',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655446101'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655446102',
      '550e8400-e29b-41d4-a716-446655446103',
      (
        select id
        from public.ingredient_claim_definitions
        where code = 'contains_shellfish'
      ),
      'known',
      false,
      '2026-08-20T12:00:00Z',
      '550e8400-e29b-41d4-a716-446655446105'
    )
  $$,
  'M2-I05 known-false assertion succeeds'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_claim_assertions
  ),
  1,
  'claim assertion persists'
);

select is(
  (
    select boolean_value
    from public.ingredient_claim_assertions
  ),
  false,
  'known false is preserved as boolean false'
);

select is(
  (
    select retention_profile::text
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655446105'
  ),
  'protected_operational',
  'claim assertion audit uses protected_operational retention'
);

create temporary table f39_force_audit_failure (
  marker boolean
);

select throws_ok(
  $$
    select public.m2_record_ingredient_claim_assertion(
      '550e8400-e29b-41d4-a716-446655446101',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655446101'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655446102',
      '550e8400-e29b-41d4-a716-446655446103',
      (
        select id
        from public.ingredient_claim_definitions
        where code = 'contains_shellfish'
      ),
      'known',
      true,
      '2026-08-21T12:00:00Z',
      '550e8400-e29b-41d4-a716-446655446106'
    )
  $$,
  'P0001',
  null,
  'forced audit failure rejects claim assertion'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_claim_assertions
  ),
  1,
  'forced audit failure rolls back claim assertion'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655446106'
  ),
  0,
  'forced claim assertion failure leaves no audit'
);

drop table f39_force_audit_failure;

select throws_ok(
  $$
    update public.ingredient_claim_assertions
    set boolean_value = true
  $$,
  '42501',
  null,
  'claim assertion history update is rejected'
);

select throws_ok(
  $$
    delete from public.ingredient_claim_assertions
  $$,
  '42501',
  null,
  'claim assertion history delete is rejected'
);

select * from finish();
rollback;
