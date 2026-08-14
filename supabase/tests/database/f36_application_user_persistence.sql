begin;
select plan(14);

select has_schema('private', 'private identity schema exists');
select has_table('private', 'application_users', 'application-user table exists');
select has_column('private', 'application_users', 'id', 'application-user id exists');
select has_column('private', 'application_users', 'auth_principal_id', 'auth principal id exists');
select col_not_null('private', 'application_users', 'auth_principal_id', 'auth principal id is required');
select col_is_pk('private', 'application_users', 'id', 'application-user id is primary key');
select col_is_unique('private', 'application_users', 'auth_principal_id', 'auth principal id is unique');
select ok(
	exists (
		select 1
		from pg_constraint as constraint_row
		join pg_class as table_row on table_row.oid = constraint_row.conrelid
		join pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
		join pg_class as referenced_table on referenced_table.oid = constraint_row.confrelid
		join pg_namespace as referenced_schema on referenced_schema.oid = referenced_table.relnamespace
		where constraint_row.contype = 'f'
			and schema_row.nspname = 'private'
			and table_row.relname = 'application_users'
			and referenced_schema.nspname = 'auth'
			and referenced_table.relname = 'users'
			and constraint_row.conkey = array[
				(select ordinal_position::smallint
				 from information_schema.columns
				 where table_schema = 'private'
					 and table_name = 'application_users'
					 and column_name = 'auth_principal_id')
			]
	),
	'auth principal references auth.users'
);
select has_function('public', 'current_application_user_id', ARRAY[]::text[], 'identity resolver exists');
select function_privs_are('public', 'current_application_user_id', ARRAY[]::text[], 'authenticated', ARRAY['EXECUTE'], 'authenticated can resolve identity');
select function_privs_are('public', 'current_application_user_id', ARRAY[]::text[], 'anon', ARRAY[]::text[], 'anonymous cannot resolve identity');

select lives_ok($$insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
	values ('123e4567-e89b-42d3-a456-426614174010', 'authenticated', 'authenticated', 'f36-db-test@example.test', '', now())$$,
	'auth user creation succeeds');
select is((select count(*)::integer from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174010'), 1,
	'auth user creation produces one mapping');
select throws_ok($$insert into private.application_users (auth_principal_id)
	values ('123e4567-e89b-42d3-a456-426614174010')$$, '23505', NULL,
	'duplicate auth principal mapping is rejected');

select * from finish();
rollback;