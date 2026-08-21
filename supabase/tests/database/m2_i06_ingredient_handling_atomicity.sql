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
  '550e8400-e29b-41d4-a716-446655449101',
  'authenticated',
  'authenticated',
  'm2-i06-atomicity@example.test',
  '',
  now()
);

insert into public.organizations (id)
values (
  '550e8400-e29b-41d4-a716-446655449102'
);

insert into public.ingredients (
  id,
  organization_id,
  display_name,
  base_canonical_unit,
  lifecycle_status
)
values (
  '550e8400-e29b-41d4-a716-446655449103',
  '550e8400-e29b-41d4-a716-446655449102',
  'M2-I06 Atomic Ingredient',
  'ea',
  'active'
);

insert into private.role_permissions (
  role_class,
  permission_id
)
values (
  'manager',
  'm2.handling.manage'
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
      '550e8400-e29b-41d4-a716-446655449101'
  ),
  'manager',
  'organization',
  '550e8400-e29b-41d4-a716-446655449102'
);

select lives_ok(
  $$
    select public.m2_create_ingredient_handling_definition(
      '550e8400-e29b-41d4-a716-446655449101',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655449101'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655449102',
      'storage_instruction',
      'Storage Instruction',
      'Organization-governed handling instruction',
      '550e8400-e29b-41d4-a716-446655449104'
    )
  $$,
  'M2-I06 Handling Definition creation succeeds'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_handling_definitions
  ),
  1,
  'Handling Definition persists'
);

select is(
  (
    select retention_profile::text
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655449104'
  ),
  'protected_operational',
  'Handling Definition audit uses protected_operational retention'
);

select lives_ok(
  $$
    select public.m2_record_ingredient_handling_instruction(
      '550e8400-e29b-41d4-a716-446655449101',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655449101'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655449102',
      '550e8400-e29b-41d4-a716-446655449103',
      (
        select id
        from public.ingredient_handling_definitions
        where code = 'storage_instruction'
      ),
      'known',
      '  Keep sealed after opening  ',
      '2026-08-20T12:00:00Z',
      '550e8400-e29b-41d4-a716-446655449105'
    )
  $$,
  'M2-I06 known handling instruction succeeds'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_handling_instructions
  ),
  1,
  'handling instruction persists'
);

select is(
  (
    select instruction_text
    from public.ingredient_handling_instructions
  ),
  'Keep sealed after opening',
  'known handling instruction is trimmed and preserved'
);

select is(
  (
    select retention_profile::text
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655449105'
  ),
  'protected_operational',
  'handling instruction audit uses protected_operational retention'
);

create temporary table f39_force_audit_failure (
  marker boolean
);

select throws_ok(
  $$
    select public.m2_record_ingredient_handling_instruction(
      '550e8400-e29b-41d4-a716-446655449101',
      (
        select id
        from private.application_users
        where auth_principal_id =
          '550e8400-e29b-41d4-a716-446655449101'
      ),
      'aal1',
      '550e8400-e29b-41d4-a716-446655449102',
      '550e8400-e29b-41d4-a716-446655449103',
      (
        select id
        from public.ingredient_handling_definitions
        where code = 'storage_instruction'
      ),
      'known',
      'Second instruction',
      '2026-08-21T12:00:00Z',
      '550e8400-e29b-41d4-a716-446655449106'
    )
  $$,
  'P0001',
  null,
  'forced audit failure rejects handling instruction'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_handling_instructions
  ),
  1,
  'forced audit failure rolls back handling instruction'
);

select is(
  (
    select count(*)::integer
    from private.audit_records
    where correlation_id =
      '550e8400-e29b-41d4-a716-446655449106'
  ),
  0,
  'forced handling failure leaves no audit'
);

drop table f39_force_audit_failure;

select throws_ok(
  $$
    update public.ingredient_handling_instructions
    set instruction_text = 'Changed'
  $$,
  '42501',
  null,
  'handling instruction history update is rejected'
);

select throws_ok(
  $$
    delete from public.ingredient_handling_instructions
  $$,
  '42501',
  null,
  'handling instruction history delete is rejected'
);

select * from finish();
rollback;
