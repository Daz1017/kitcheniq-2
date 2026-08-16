begin;
select plan(70);

select has_table('private', 'operational_logs', 'operational log table exists');
select has_column('private', 'operational_logs', 'id', 'id column exists');
select has_column('private', 'operational_logs', 'occurred_at', 'occurred_at column exists');
select has_column('private', 'operational_logs', 'severity', 'severity column exists');
select has_column('private', 'operational_logs', 'correlation_id', 'correlation_id column exists');
select has_column('private', 'operational_logs', 'environment', 'environment column exists');
select has_column('private', 'operational_logs', 'component', 'component column exists');
select has_column('private', 'operational_logs', 'message', 'message column exists');
select has_column('private', 'operational_logs', 'health_signal', 'health_signal column exists');
select has_column('private', 'operational_logs', 'error_code', 'error_code column exists');
select has_column('private', 'operational_logs', 'error_category', 'error_category column exists');
select has_column('private', 'operational_logs', 'retryable', 'retryable column exists');
select has_column('private', 'operational_logs', 'details', 'details column exists');
select col_type_is('private', 'operational_logs', 'id', 'uuid', 'id is uuid');
select col_type_is('private', 'operational_logs', 'occurred_at', 'timestamp with time zone', 'occurred_at is timestamptz');
select col_type_is('private', 'operational_logs', 'severity', 'foundation.operational_log_severity', 'severity uses exact domain');
select col_type_is('private', 'operational_logs', 'correlation_id', 'uuid', 'correlation_id is uuid');
select col_type_is('private', 'operational_logs', 'environment', 'foundation.operational_log_environment', 'environment uses exact domain');
select col_type_is('private', 'operational_logs', 'component', 'text', 'component is text');
select col_type_is('private', 'operational_logs', 'message', 'text', 'message is text');
select col_type_is('private', 'operational_logs', 'health_signal', 'foundation.operational_health_signal', 'health signal uses exact domain');
select col_type_is('private', 'operational_logs', 'details', 'jsonb', 'details is jsonb');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'id'), 'id is required');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'occurred_at'), 'occurred_at is required');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'severity'), 'severity is required');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'correlation_id'), 'correlation_id is required');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'environment'), 'environment is required');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'component'), 'component is required');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'message'), 'message is required');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'details'), 'details is required');
select ok((select column_default like '%gen_random_uuid%' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'id'), 'id is database generated');
select ok((select column_default like '%now()%' from information_schema.columns where table_schema = 'private' and table_name = 'operational_logs' and column_name = 'occurred_at'), 'occurred_at is database generated');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.operational_logs'::regclass and pg_get_constraintdef(oid) like '%is_uuid_v4(id)%'), 'id enforces UUIDv4');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.operational_logs'::regclass and pg_get_constraintdef(oid) like '%jsonb_typeof(details)%'), 'details requires an object');
select is((select pg_get_constraintdef(c.oid)
	from pg_constraint c
	join pg_type t on t.oid = c.contypid
	join pg_namespace n on n.oid = t.typnamespace
	where n.nspname = 'foundation' and t.typname = 'operational_log_severity'),
	'CHECK ((VALUE = ANY (ARRAY[''debug''::text, ''info''::text, ''warn''::text, ''error''::text])))',
	'severity vocabulary is exact');
select is((select pg_get_constraintdef(c.oid)
	from pg_constraint c
	join pg_type t on t.oid = c.contypid
	join pg_namespace n on n.oid = t.typnamespace
	where n.nspname = 'foundation' and t.typname = 'operational_log_environment'),
	'CHECK ((VALUE = ANY (ARRAY[''development''::text, ''automated_test''::text, ''staging''::text, ''production''::text])))',
	'environment vocabulary is exact');
select is((select pg_get_constraintdef(c.oid)
	from pg_constraint c
	join pg_type t on t.oid = c.contypid
	join pg_namespace n on n.oid = t.typnamespace
	where n.nspname = 'foundation' and t.typname = 'operational_health_signal'),
	'CHECK ((VALUE = ANY (ARRAY[''error''::text, ''import_failure''::text, ''integration_failure''::text, ''event_backlog''::text, ''job_failure''::text, ''backup_failure''::text])))',
	'health signal vocabulary is exact');
select ok(not has_table_privilege('anon', 'private.operational_logs', 'SELECT'), 'anon has no direct table access');
select ok(not has_table_privilege('authenticated', 'private.operational_logs', 'SELECT'), 'authenticated has no direct table access');
select ok(not has_table_privilege('public', 'private.operational_logs', 'INSERT'), 'public cannot append directly');
select ok(not has_table_privilege('service_role', 'private.operational_logs', 'UPDATE'), 'application roles cannot update');
select ok(not has_table_privilege('service_role', 'private.operational_logs', 'DELETE'), 'application roles cannot arbitrarily delete');
select ok(exists (select 1 from pg_proc where pronamespace = 'private'::regnamespace and proname = 'append_operational_log'), 'append function exists');
select ok(exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'search_operational_logs'), 'search function exists');
select ok(exists (select 1 from pg_proc where pronamespace = 'private'::regnamespace and proname = 'delete_expired_operational_logs'), 'retention function exists');
select function_privs_are('private', 'append_operational_log', ARRAY['foundation.operational_log_severity','uuid','foundation.operational_log_environment','text','text','foundation.operational_health_signal','text','text','boolean','jsonb'], 'public', ARRAY[]::text[], 'public cannot execute append');
select function_privs_are('private', 'append_operational_log', ARRAY['foundation.operational_log_severity','uuid','foundation.operational_log_environment','text','text','foundation.operational_health_signal','text','text','boolean','jsonb'], 'anon', ARRAY[]::text[], 'anon cannot execute append');
select function_privs_are('private', 'append_operational_log', ARRAY['foundation.operational_log_severity','uuid','foundation.operational_log_environment','text','text','foundation.operational_health_signal','text','text','boolean','jsonb'], 'authenticated', ARRAY[]::text[], 'authenticated cannot execute append');
select function_privs_are('private', 'append_operational_log', ARRAY['foundation.operational_log_severity','uuid','foundation.operational_log_environment','text','text','foundation.operational_health_signal','text','text','boolean','jsonb'], 'service_role', ARRAY['EXECUTE'], 'service role can append');
select function_privs_are('public', 'search_operational_logs', ARRAY['timestamp with time zone','timestamp with time zone','uuid','foundation.operational_log_severity','foundation.operational_health_signal','text','text'], 'public', ARRAY[]::text[], 'public cannot search');
select function_privs_are('public', 'search_operational_logs', ARRAY['timestamp with time zone','timestamp with time zone','uuid','foundation.operational_log_severity','foundation.operational_health_signal','text','text'], 'anon', ARRAY[]::text[], 'anon cannot search');
select function_privs_are('public', 'search_operational_logs', ARRAY['timestamp with time zone','timestamp with time zone','uuid','foundation.operational_log_severity','foundation.operational_health_signal','text','text'], 'authenticated', ARRAY[]::text[], 'authenticated cannot search');
select function_privs_are('public', 'search_operational_logs', ARRAY['timestamp with time zone','timestamp with time zone','uuid','foundation.operational_log_severity','foundation.operational_health_signal','text','text'], 'service_role', ARRAY['EXECUTE'], 'service role can search');
select ok(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'operational_logs_occurred_at_idx'), 'occurred_at index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'operational_logs_correlation_idx'), 'correlation index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'operational_logs_severity_idx'), 'severity index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'operational_logs_health_signal_idx'), 'health signal index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'operational_logs_component_idx'), 'component index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'operational_logs_error_code_idx'), 'error code index exists');

select lives_ok($$select private.append_operational_log('error', '123e4567-e89b-42d3-a456-426614174080', 'automated_test', 'f41.test', 'old', 'error', 'test.old', 'internal', false, '{}'::jsonb)$$, 'service append path accepts valid data');
select lives_ok($$insert into private.operational_logs (occurred_at, severity, correlation_id, environment, component, message, details) values (now() - interval '31 days', 'info', '123e4567-e89b-42d3-a456-426614174081', 'automated_test', 'f41.test', 'expired', '{}'::jsonb)$$, 'expired fixture inserts');
select lives_ok($$insert into private.operational_logs (occurred_at, severity, correlation_id, environment, component, message, details) values (now() - interval '30 days', 'info', '123e4567-e89b-42d3-a456-426614174082', 'automated_test', 'f41.test', 'boundary', '{}'::jsonb)$$, 'boundary fixture inserts');
select lives_ok($$insert into private.operational_logs (severity, correlation_id, environment, component, message, details) values ('info', '123e4567-e89b-42d3-a456-426614174083', 'automated_test', 'f41.test', 'new', '{}'::jsonb)$$, 'new fixture inserts');
select is(private.delete_expired_operational_logs(30), 1, 'retention deletes logs older than 30 days');
select is((select count(*)::integer from private.operational_logs where message in ('boundary', 'new')), 2, 'boundary and newer logs are retained');
select throws_ok($$insert into private.operational_logs (severity, correlation_id, environment, component, message, details) values ('info', '123e4567-e89b-42d3-a456-426614174084', 'automated_test', 'f41.test', 'array', '[]'::jsonb)$$, '23514', NULL, 'details rejects non-object JSON');
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('123e4567-e89b-42d3-a456-426614174085', 'authenticated', 'authenticated', 'f41-retention@example.test', '', now());
insert into public.organizations (id)
values ('123e4567-e89b-42d3-a456-426614174086');
insert into private.idempotency_records (
	operation,
	scope_kind,
	organization_id,
	location_id,
	idempotency_key,
	request_hash
) values (
	'f41.retention.fixture',
	'organization',
	'123e4567-e89b-42d3-a456-426614174086',
	null,
	'f41-retention-key',
	repeat('d', 64)
);
select lives_ok($$insert into private.audit_records (actor_application_user_id, action, target_kind, target_id, scope_kind, organization_id, location_id, correlation_id, source, process, rule_version, retention_profile, change_context) values ((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174085'), 'f41.test', 'test', '123e4567-e89b-42d3-a456-426614174087', 'organization', '123e4567-e89b-42d3-a456-426614174086', null, '123e4567-e89b-42d3-a456-426614174088', 'test', 'test', '1', 'protected_operational', '{}'::jsonb)$$, 'audit fixture is independent');
select lives_ok($$insert into private.event_records (event_type, schema_version, producer, scope_kind, organization_id, location_id, correlation_id, causation_id, payload) values ('f41.test', '1', 'f41.test', 'organization', '123e4567-e89b-42d3-a456-426614174086', null, '123e4567-e89b-42d3-a456-426614174089', (select id from private.idempotency_records where operation = 'f41.retention.fixture'), '{}'::jsonb)$$, 'event fixture is independent');
select ok(exists (select 1 from cron.job where jobname = 'kitcheniq_operational_log_retention'), 'daily retention cron job exists');
select is((select schedule from cron.job where jobname = 'kitcheniq_operational_log_retention'), '0 0 * * *', 'retention cron schedule is daily');
select * from finish();
rollback;
