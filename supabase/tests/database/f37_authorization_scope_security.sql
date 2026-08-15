begin;
select plan(35);

select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'locations', 'locations exists');
select ok((select relrowsecurity from pg_class where oid = 'public.organizations'::regclass), 'organizations RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.locations'::regclass), 'locations RLS enabled');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.locations'::regclass and contype = 'f'), 'location organization FK exists');
select has_schema('private', 'private authorization schema exists');
select has_table('private', 'permissions', 'permissions are private');
select has_table('private', 'role_permissions', 'role permissions are private');
select has_table('private', 'role_assignments', 'role assignments are private');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = 'permissions'), 'permissions are not exposed');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = 'role_assignments'), 'assignments are not exposed');
select function_privs_are('public', 'create_location', ARRAY['uuid','uuid','text','uuid'], 'anon', ARRAY[]::text[], 'anon cannot execute service write');
select function_privs_are('public', 'create_location', ARRAY['uuid','uuid','text','uuid'], 'authenticated', ARRAY[]::text[], 'authenticated cannot execute service write');
select ok(exists (select 1 from pg_proc where pronamespace = 'private'::regnamespace and proname = 'has_permission'), 'permission evaluator exists');
select ok(exists (select 1 from pg_proc where pronamespace = 'private'::regnamespace and proname = 'current_has_permission'), 'caller evaluator exists');
select ok(exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'create_location'), 'write command is a controlled public RPC');
select ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'locations' and grantee = 'authenticated' and privilege_type = 'INSERT'), 'authenticated insert is denied');
select ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'locations' and grantee = 'authenticated' and privilege_type = 'UPDATE'), 'authenticated update is denied');
select ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'locations' and grantee = 'authenticated' and privilege_type = 'DELETE'), 'authenticated delete is denied');

select throws_ok($$insert into private.permissions values ('recipe.edit')$$, '23514', NULL, 'unknown permission is rejected');
select throws_ok($$insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id) values ('123e4567-e89b-42d3-a456-426614174011', 'owner', 'organization', '123e4567-e89b-42d3-a456-426614174012')$$, '23503', NULL, 'assignment requires persisted application user');
select throws_ok($$insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id, location_id) values ('123e4567-e89b-42d3-a456-426614174011', 'owner', 'organization', '123e4567-e89b-42d3-a456-426614174012', '123e4567-e89b-42d3-a456-426614174013')$$, '23514', NULL, 'organization assignment cannot include location');

select ok((select count(*) = 2 from private.permissions), 'only Foundation permissions exist');
select ok(not exists (select 1 from private.permissions where id like 'recipe.%' or id like 'inventory.%' or id like 'invoice.%'), 'no module permission catalog exists');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('123e4567-e89b-42d3-a456-426614174030', 'authenticated', 'authenticated', 'f37-db-auth@example.test', '', now());
insert into public.organizations (id) values ('123e4567-e89b-42d3-a456-426614174031'), ('123e4567-e89b-42d3-a456-426614174032');
insert into public.locations (id, organization_id)
values ('123e4567-e89b-42d3-a456-426614174033', '123e4567-e89b-42d3-a456-426614174031');
insert into private.role_permissions (role_class, permission_id)
values
	('owner', 'foundation.scope.read'),
	('admin', 'foundation.scope.read'),
	('manager', 'foundation.scope.read'),
	('manager', 'foundation.location.create');

select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'organization', '123e4567-e89b-42d3-a456-426614174031', null, 'aal1') is false, 'permission without assignment denies');
insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
values ((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'owner', 'organization', '123e4567-e89b-42d3-a456-426614174031');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'organization', '123e4567-e89b-42d3-a456-426614174031', null, 'aal1') is false, 'owner at aal1 denies');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'organization', '123e4567-e89b-42d3-a456-426614174031', null, 'aal2'), 'owner at aal2 allows when explicitly mapped');
delete from private.role_assignments;
insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
values ((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'admin', 'organization', '123e4567-e89b-42d3-a456-426614174031');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'organization', '123e4567-e89b-42d3-a456-426614174031', null, 'aal1') is false, 'admin at aal1 denies');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'organization', '123e4567-e89b-42d3-a456-426614174031', null, 'aal2'), 'admin at aal2 allows when explicitly mapped');
delete from private.role_assignments;
insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
values ((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'manager', 'organization', '123e4567-e89b-42d3-a456-426614174031');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'organization', '123e4567-e89b-42d3-a456-426614174031', null, 'aal1'), 'manager at aal1 allows when explicitly mapped');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.location.create', 'organization', '123e4567-e89b-42d3-a456-426614174031', null, 'aal1'), 'manager create permission is explicit');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'organization', '123e4567-e89b-42d3-a456-426614174032', null, 'aal1') is false, 'exact organization scope is enforced');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'location', '123e4567-e89b-42d3-a456-426614174031', '123e4567-e89b-42d3-a456-426614174033', 'aal1') is false, 'organization assignment does not inherit to location');
delete from private.role_assignments;
insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id, location_id)
values ((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'read_only', 'location', '123e4567-e89b-42d3-a456-426614174031', '123e4567-e89b-42d3-a456-426614174033');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'foundation.scope.read', 'location', '123e4567-e89b-42d3-a456-426614174031', '123e4567-e89b-42d3-a456-426614174033', 'aal1') is false, 'read_only has no implicit permission');
select ok(private.has_permission((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174030'), 'unknown.permission', 'location', '123e4567-e89b-42d3-a456-426614174031', '123e4567-e89b-42d3-a456-426614174033', 'aal1') is false, 'unknown permission denies');
select * from finish();
rollback;