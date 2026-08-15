begin;
select plan(37);

select has_schema('private', 'private audit schema exists');
select has_table('private', 'audit_records', 'audit table exists');
select has_column('private', 'audit_records', 'occurred_at', 'occurred_at exists');
select has_column('private', 'audit_records', 'change_context', 'change_context exists');
select col_type_is('private', 'audit_records', 'occurred_at', 'timestamp with time zone', 'occurred_at is timestamptz');
select col_type_is('private', 'audit_records', 'change_context', 'jsonb', 'change_context is jsonb');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = 'audit_records'), 'audit table is not public');
select ok(exists (select 1 from pg_index where indrelid = 'private.audit_records'::regclass and indisprimary), 'audit id is primary key');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.audit_records'::regclass and conname = 'audit_records_id_check'), 'audit id has UUIDv4 check');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.audit_records'::regclass and conname = 'audit_records_correlation_id_check'), 'correlation id has UUIDv4 check');
select ok(exists (select 1 from pg_type where typnamespace = 'foundation'::regnamespace and typname = 'audit_retention_profile'), 'audit retention domain exists');
select throws_ok($$select 'invalid'::foundation.audit_retention_profile$$, '23514', NULL, 'invalid retention profile rejected');

select function_privs_are('private', 'append_audit_record', ARRAY['uuid','text','text','uuid','text','uuid','uuid','uuid','text','text','text','foundation.audit_retention_profile','jsonb'], 'public', ARRAY[]::text[], 'public cannot append audit');
select function_privs_are('private', 'append_audit_record', ARRAY['uuid','text','text','uuid','text','uuid','uuid','uuid','text','text','text','foundation.audit_retention_profile','jsonb'], 'anon', ARRAY[]::text[], 'anon cannot append audit');
select function_privs_are('private', 'append_audit_record', ARRAY['uuid','text','text','uuid','text','uuid','uuid','uuid','text','text','text','foundation.audit_retention_profile','jsonb'], 'authenticated', ARRAY[]::text[], 'authenticated cannot append audit');
select function_privs_are('public', 'create_location', ARRAY['uuid','uuid','text','uuid','uuid'], 'anon', ARRAY[]::text[], 'anon cannot execute audited command');
select function_privs_are('public', 'create_location', ARRAY['uuid','uuid','text','uuid','uuid'], 'authenticated', ARRAY[]::text[], 'authenticated cannot execute audited command');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = 'audit_records'), 'audit is not exposed through public schema');
select ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'private' and table_name = 'audit_records' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')), 'client roles cannot mutate audit table');

select lives_ok($$insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
  values ('123e4567-e89b-42d3-a456-426614174050', 'authenticated', 'authenticated', 'f39-db-test@example.test', '', now())$$, 'audit test auth user created');
insert into public.organizations (id) values ('123e4567-e89b-42d3-a456-426614174051');
insert into private.role_permissions (role_class, permission_id)
values ('manager', 'foundation.location.create');
insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
values ((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174050'), 'manager', 'organization', '123e4567-e89b-42d3-a456-426614174051');

select ok(exists (select 1 from pg_proc where pronamespace = 'private'::regnamespace and proname = 'append_audit_record'), 'append boundary exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'private.audit_records'::regclass and tgname = 'audit_records_immutable'), 'audit immutability trigger exists');

select lives_ok($$select public.create_location(
  '123e4567-e89b-42d3-a456-426614174050',
  (select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174050'),
  'aal1',
  '123e4567-e89b-42d3-a456-426614174051',
  '123e4567-e89b-42d3-a456-426614174052'
)$$, 'authorized create location and audit append succeeds');
select is((select count(*)::integer from private.audit_records), 1, 'exactly one audit record is created');
select is((select action from private.audit_records), 'foundation.location.create', 'audit action is correct');
select is((select target_kind from private.audit_records), 'location', 'audit target kind is correct');
select is((select scope_kind from private.audit_records), 'organization', 'audit scope is organization');
select is((select retention_profile::text from private.audit_records), 'protected_operational', 'create location retention is protected operational');
select ok((select occurred_at is not null from private.audit_records), 'database supplies occurred_at');
select ok((select jsonb_typeof(change_context) = 'object' from private.audit_records), 'change context is an object');
select ok((select change_context ? 'after' and not change_context::text like '%token%' from private.audit_records), 'change context captures safe change details');

create temporary table f39_force_audit_failure (marker boolean);
select throws_ok($$select public.create_location(
  '123e4567-e89b-42d3-a456-426614174050',
  (select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174050'),
  'aal1',
  '123e4567-e89b-42d3-a456-426614174051',
  '123e4567-e89b-42d3-a456-426614174053'
)$$, 'P0001', NULL, 'forced audit failure rejects command');
select is((select count(*)::integer from public.locations), 1, 'forced audit failure rolls back location');
select is((select count(*)::integer from private.audit_records), 1, 'forced audit failure creates no audit record');

select throws_ok($$update private.audit_records set action = 'changed'$$, '42501', NULL, 'audit update is rejected');
select throws_ok($$delete from private.audit_records$$, '42501', NULL, 'audit delete is rejected');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = 'recipes'), 'no module recipe table exists');

select * from finish();
rollback;