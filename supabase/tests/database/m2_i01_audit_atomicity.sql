begin;
select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('550e8400-e29b-41d4-a716-446655440010', 'authenticated', 'authenticated', 'm2-i01-atomicity@example.test', '', now());
insert into public.organizations (id)
values ('550e8400-e29b-41d4-a716-446655440011');
insert into private.role_permissions (role_class, permission_id)
values
  ('manager', 'm2.ingredient.create'),
  ('manager', 'm2.ingredient.update');
insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
values (
  (select id from private.application_users where auth_principal_id = '550e8400-e29b-41d4-a716-446655440010'),
  'manager', 'organization', '550e8400-e29b-41d4-a716-446655440011'
);

select lives_ok($$select public.m2_create_ingredient(
  '550e8400-e29b-41d4-a716-446655440010',
  (select id from private.application_users where auth_principal_id = '550e8400-e29b-41d4-a716-446655440010'),
  'aal1', '550e8400-e29b-41d4-a716-446655440011', 'Atomic Create', null, 'g',
  '550e8400-e29b-41d4-a716-446655440012'
)$$, 'M2 create succeeds before forced failure');
select is((select count(*)::integer from public.ingredients where display_name = 'Atomic Create'), 1, 'create mutation persisted');
select is((select count(*)::integer from private.audit_records where correlation_id = '550e8400-e29b-41d4-a716-446655440012'), 1, 'create audit persisted');

create temporary table f39_force_audit_failure (marker boolean);
select throws_ok($$select public.m2_create_ingredient(
  '550e8400-e29b-41d4-a716-446655440010',
  (select id from private.application_users where auth_principal_id = '550e8400-e29b-41d4-a716-446655440010'),
  'aal1', '550e8400-e29b-41d4-a716-446655440011', 'Forced Create Rollback', null, 'g',
  '550e8400-e29b-41d4-a716-446655440013'
)$$, 'P0001', NULL, 'forced audit failure rejects M2 create');
select is((select count(*)::integer from public.ingredients where display_name = 'Forced Create Rollback'), 0, 'forced M2 create rolled back');
select is((select count(*)::integer from private.audit_records where correlation_id = '550e8400-e29b-41d4-a716-446655440013'), 0, 'forced M2 create produced no audit');

drop table f39_force_audit_failure;
select lives_ok($$select public.m2_update_ingredient(
  '550e8400-e29b-41d4-a716-446655440010',
  (select id from private.application_users where auth_principal_id = '550e8400-e29b-41d4-a716-446655440010'),
  'aal1', '550e8400-e29b-41d4-a716-446655440011',
  (select id from public.ingredients where display_name = 'Atomic Create'),
  'Atomic Create Updated', null, 'active', '550e8400-e29b-41d4-a716-446655440014'
)$$, 'M2 update succeeds before forced failure');
select is((select display_name from public.ingredients where id = (select id from public.ingredients where display_name = 'Atomic Create Updated')), 'Atomic Create Updated', 'update mutation persisted');

create temporary table f39_force_audit_failure (marker boolean);
select throws_ok($$select public.m2_update_ingredient(
  '550e8400-e29b-41d4-a716-446655440010',
  (select id from private.application_users where auth_principal_id = '550e8400-e29b-41d4-a716-446655440010'),
  'aal1', '550e8400-e29b-41d4-a716-446655440011',
  (select id from public.ingredients where display_name = 'Atomic Create Updated'),
  'Forced Update Rollback', null, 'active', '550e8400-e29b-41d4-a716-446655440015'
)$$, 'P0001', NULL, 'forced audit failure rejects M2 update');
select is((select display_name from public.ingredients where display_name = 'Atomic Create Updated'), 'Atomic Create Updated', 'forced M2 update rolled back');

select * from finish();
rollback;
