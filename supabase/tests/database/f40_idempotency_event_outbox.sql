begin;
select plan(52);

select has_table('private', 'idempotency_records', 'idempotency table exists');
select has_table('private', 'event_records', 'event table exists');
select has_table('private', 'event_outbox', 'outbox table exists');
select has_column('private', 'idempotency_records', 'idempotency_key', 'idempotency key exists');
select has_column('private', 'idempotency_records', 'request_hash', 'request hash exists');
select has_column('private', 'idempotency_records', 'result_id', 'result reference exists');
select col_type_is('private', 'idempotency_records', 'created_at', 'timestamp with time zone', 'idempotency time is timestamptz');
select col_type_is('private', 'event_records', 'occurred_at', 'timestamp with time zone', 'event time is timestamptz');
select col_type_is('private', 'event_records', 'payload', 'jsonb', 'event payload is jsonb');
select ok(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'idempotency_records_organization_key_idx'), 'organization idempotency binding is unique');
select ok(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'idempotency_records_location_key_idx'), 'location idempotency binding is unique');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.idempotency_records'::regclass and conname like '%idempotency_records_id_check'), 'idempotency id has UUIDv4 check');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.event_records'::regclass and conname like '%event_records_id_check'), 'event id has UUIDv4 check');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.event_records'::regclass and conname like '%event_records_correlation_id_check'), 'event correlation has UUIDv4 check');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname in ('idempotency_records', 'event_records', 'event_outbox')), 'F-40 tables are not public');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = 'recipes'), 'no module recipe table exists');

select function_privs_are('public', 'create_location', ARRAY['uuid','uuid','text','uuid','uuid'], 'service_role', ARRAY[]::text[], 'old non-idempotent path is unavailable');
select function_privs_are('public', 'create_location_idempotent', ARRAY['uuid','uuid','text','uuid','text','text','uuid'], 'anon', ARRAY[]::text[], 'anon cannot execute idempotent command');
select function_privs_are('public', 'create_location_idempotent', ARRAY['uuid','uuid','text','uuid','text','text','uuid'], 'authenticated', ARRAY[]::text[], 'authenticated cannot execute idempotent command');
select function_privs_are('public', 'claim_event_outbox', ARRAY['integer','integer'], 'public', ARRAY[]::text[], 'public cannot claim outbox');
select function_privs_are('public', 'claim_event_outbox', ARRAY['integer','integer'], 'anon', ARRAY[]::text[], 'anon cannot claim outbox');
select function_privs_are('public', 'claim_event_outbox', ARRAY['integer','integer'], 'authenticated', ARRAY[]::text[], 'authenticated cannot claim outbox');
select function_privs_are('public', 'mark_event_delivered', ARRAY['uuid','uuid'], 'authenticated', ARRAY[]::text[], 'authenticated cannot acknowledge outbox');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('123e4567-e89b-42d3-a456-426614174060', 'authenticated', 'authenticated', 'f40-db-test@example.test', '', now());
insert into public.organizations (id) values ('123e4567-e89b-42d3-a456-426614174061');
insert into private.role_permissions (role_class, permission_id)
values ('manager', 'foundation.location.create');
insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
values ((select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174060'), 'manager', 'organization', '123e4567-e89b-42d3-a456-426614174061');

select lives_ok($$select public.create_location_idempotent(
  '123e4567-e89b-42d3-a456-426614174060',
  (select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174060'),
  'aal1',
  '123e4567-e89b-42d3-a456-426614174061',
  'f40-db-key',
  repeat('a', 64),
  '123e4567-e89b-42d3-a456-426614174062'
)$$, 'first idempotent command succeeds');
select is((select count(*)::integer from public.locations), 1, 'one location is created');
select is((select count(*)::integer from private.audit_records), 1, 'one audit is created');
select is((select count(*)::integer from private.idempotency_records), 1, 'one idempotency record is created');
select is((select count(*)::integer from private.event_records), 1, 'one event is created');
select is((select count(*)::integer from private.event_outbox), 1, 'one outbox record is created');
select is((select event_type from private.event_records), 'foundation.location.created', 'event type is exact');
select is((select schema_version from private.event_records), '1', 'event schema version is exact');
select is((select producer from private.event_records), 'foundation.create_location', 'event producer is exact');
select ok((select payload ? 'locationId' and payload ? 'organizationId' from private.event_records), 'event payload is authoritative object');
select is((select causation_id from private.event_records), (select id from private.idempotency_records), 'event causation references idempotency record');

select is((select (public.create_location_idempotent(
  '123e4567-e89b-42d3-a456-426614174060',
  (select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174060'),
  'aal1',
  '123e4567-e89b-42d3-a456-426614174061',
  'f40-db-key',
  repeat('a', 64),
  '123e4567-e89b-42d3-a456-426614174063'
))->>'replayed'), 'true', 'same request replays');
select is((select count(*)::integer from public.locations), 1, 'replay creates no location');
select is((select count(*)::integer from private.event_records), 1, 'replay creates no event');
select throws_ok($$select public.create_location_idempotent(
  '123e4567-e89b-42d3-a456-426614174060',
  (select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174060'),
  'aal1',
  '123e4567-e89b-42d3-a456-426614174061',
  'f40-db-key',
  repeat('b', 64),
  '123e4567-e89b-42d3-a456-426614174064'
)$$, '23505', NULL, 'different request hash is rejected');

create temporary table f40_force_outbox_failure (marker boolean);
select throws_ok($$select public.create_location_idempotent(
  '123e4567-e89b-42d3-a456-426614174060',
  (select id from private.application_users where auth_principal_id = '123e4567-e89b-42d3-a456-426614174060'),
  'aal1',
  '123e4567-e89b-42d3-a456-426614174061',
  'f40-failing-key',
  repeat('c', 64),
  '123e4567-e89b-42d3-a456-426614174065'
)$$, 'P0001', NULL, 'forced outbox failure rejects command');
select is((select count(*)::integer from public.locations), 1, 'outbox failure rolls back location');
select is((select count(*)::integer from private.audit_records), 1, 'outbox failure rolls back audit');
select is((select count(*)::integer from private.event_records), 1, 'outbox failure rolls back event');
select is((select count(*)::integer from private.idempotency_records), 1, 'outbox failure rolls back idempotency completion');

create temporary table f40_claim as select * from public.claim_event_outbox(1, 30);
select is((select count(*)::integer from f40_claim), 1, 'outbox claim returns one event');
select ok((select claim_token is not null from f40_claim), 'claim returns token');
select ok(not public.mark_event_delivered((select event_id from f40_claim), '123e4567-e89b-42d3-a456-426614174066'), 'wrong claim token is rejected');
update private.event_outbox set lease_until = now() - interval '1 second' where event_id = (select event_id from f40_claim);
create temporary table f40_reclaim as select * from public.claim_event_outbox(1, 30);
select is((select count(*)::integer from f40_reclaim), 1, 'expired lease is reclaimable');
select is((select event_id from f40_reclaim), (select event_id from f40_claim), 'reclaim returns same event');
select ok(public.mark_event_delivered((select event_id from f40_reclaim), (select claim_token from f40_reclaim)), 'active claim acknowledges delivery');
select is((select count(*)::integer from public.claim_event_outbox(1, 30)), 0, 'delivered event is no longer claimable');
select throws_ok($$update private.event_records set producer = 'changed'$$, '42501', NULL, 'event update is rejected');
select throws_ok($$delete from private.event_records$$, '42501', NULL, 'event delete is rejected');

select * from finish();
rollback;