begin;
select plan(60);

select has_schema('foundation', 'Foundation database contract schema exists');
select ok(exists (select 1 from pg_type where typnamespace = 'foundation'::regnamespace and typname = 'monetary_total_amount'), 'monetary total domain exists');
select ok(exists (select 1 from pg_type where typnamespace = 'foundation'::regnamespace and typname = 'unit_cost_amount'), 'unit cost domain exists');
select ok(exists (select 1 from pg_type where typnamespace = 'foundation'::regnamespace and typname = 'physical_quantity'), 'physical quantity domain exists');
select ok(exists (select 1 from pg_type where typnamespace = 'foundation'::regnamespace and typname = 'ratio_rate_percent'), 'ratio rate domain exists');
select is((select numeric_precision::integer from information_schema.domains where domain_schema = 'foundation' and domain_name = 'monetary_total_amount'), 19, 'monetary total precision is 19');
select is((select numeric_scale::integer from information_schema.domains where domain_schema = 'foundation' and domain_name = 'monetary_total_amount'), 4, 'monetary total scale is 4');
select is((select numeric_precision::integer from information_schema.domains where domain_schema = 'foundation' and domain_name = 'unit_cost_amount'), 20, 'unit cost precision is 20');
select is((select numeric_scale::integer from information_schema.domains where domain_schema = 'foundation' and domain_name = 'unit_cost_amount'), 8, 'unit cost scale is 8');
select is((select numeric_precision::integer from information_schema.domains where domain_schema = 'foundation' and domain_name = 'physical_quantity'), 20, 'physical quantity precision is 20');
select is((select numeric_scale::integer from information_schema.domains where domain_schema = 'foundation' and domain_name = 'physical_quantity'), 8, 'physical quantity scale is 8');
select is((select numeric_precision::integer from information_schema.domains where domain_schema = 'foundation' and domain_name = 'ratio_rate_percent'), 18, 'ratio rate precision is 18');
select is((select numeric_scale::integer from information_schema.domains where domain_schema = 'foundation' and domain_name = 'ratio_rate_percent'), 8, 'ratio rate scale is 8');

create temporary table numeric_fixture (
  monetary_total foundation.monetary_total_amount,
  unit_cost foundation.unit_cost_amount,
  physical foundation.physical_quantity,
  ratio foundation.ratio_rate_percent,
  currency foundation.currency_code,
  unit foundation.canonical_unit_code,
  state foundation.value_state,
  state_value text,
  quantity_value foundation.physical_quantity,
  quantity_unit foundation.canonical_unit_code,
  check (state is null or foundation.is_valid_value_state_pair(state, state_value is not null)),
  check ((quantity_value is null and quantity_unit is null) or foundation.is_valid_quantity_pair(quantity_value, quantity_unit))
) on commit drop;

insert into numeric_fixture (monetary_total, unit_cost, physical, ratio, currency, unit, state, state_value, quantity_value, quantity_unit)
values ('1.23495', '1.234567895', '1.234567895', '1.234567895', 'USD', 'g', 'known', 'present', '1.00000000', 'g');
select is((select monetary_total::text from numeric_fixture), '1.2350', 'monetary persistence rounds half-up at scale 4');
select is((select unit_cost::text from numeric_fixture), '1.23456790', 'unit cost persistence rounds half-up at scale 8');
select is((select physical::text from numeric_fixture), '1.23456790', 'physical quantity persistence rounds half-up at scale 8');
select is((select ratio::text from numeric_fixture), '1.23456790', 'ratio persistence rounds half-up at scale 8');
insert into numeric_fixture (monetary_total) values ('-1.23495');
select is((select monetary_total::text from numeric_fixture where monetary_total < 0), '-1.2350', 'negative monetary half-way value rounds away from zero');

select throws_ok($$insert into numeric_fixture (monetary_total) values ('1000000000000000')$$, NULL, NULL, 'monetary integer overflow is rejected');
select throws_ok($$insert into numeric_fixture (unit_cost) values ('1000000000000')$$, NULL, NULL, 'unit cost integer overflow is rejected');
select throws_ok($$insert into numeric_fixture (physical) values ('1000000000000')$$, NULL, NULL, 'physical quantity integer overflow is rejected');
select throws_ok($$insert into numeric_fixture (ratio) values ('10000000000')$$, NULL, NULL, 'ratio integer overflow is rejected');

insert into numeric_fixture (currency, unit, state, state_value, quantity_value, quantity_unit)
values ('USD', 'g', 'unknown', null, '1.00000000', 'g');
insert into numeric_fixture (currency, unit, state, state_value, quantity_value, quantity_unit)
values ('usd', 'mL', 'not_applicable', null, '1.00000000', 'mL');
insert into numeric_fixture (currency, unit, state, state_value, quantity_value, quantity_unit)
values ('840', 'ea', 'known', 'present', '1.00000000', 'ea');
insert into numeric_fixture (currency, unit, state, state_value, quantity_value, quantity_unit)
values ('X-CUSTOM', 'g', 'known', 'present', '1.00000000', 'g');
select is((select currency from numeric_fixture where currency = 'USD' limit 1), 'USD', 'currency casing is preserved');
select is((select currency from numeric_fixture where currency = 'usd' limit 1), 'usd', 'lowercase currency is distinct and preserved');
select is((select currency from numeric_fixture where currency = '840' limit 1), '840', 'numeric-looking currency is preserved');
select is((select currency from numeric_fixture where currency = 'X-CUSTOM' limit 1), 'X-CUSTOM', 'non-ISO currency vocabulary is accepted');
select throws_ok($$insert into numeric_fixture (currency) values ('')$$, '23514', NULL, 'empty currency is rejected');
select throws_ok($$insert into numeric_fixture (currency) values ('   ')$$, '23514', NULL, 'whitespace-only currency is rejected');
select throws_ok($$insert into numeric_fixture (currency) values (' USD')$$, '23514', NULL, 'leading currency whitespace is rejected');
select throws_ok($$insert into numeric_fixture (currency) values ('USD ')$$, '23514', NULL, 'trailing currency whitespace is rejected');

select throws_ok($$insert into numeric_fixture (unit) values ('kg')$$, '23514', NULL, 'kg is rejected');
select throws_ok($$insert into numeric_fixture (unit) values ('mg')$$, '23514', NULL, 'mg is rejected');
select throws_ok($$insert into numeric_fixture (unit) values ('L')$$, '23514', NULL, 'L is rejected');
select throws_ok($$insert into numeric_fixture (unit) values ('ml')$$, '23514', NULL, 'ml is rejected');
select throws_ok($$insert into numeric_fixture (unit) values ('each')$$, '23514', NULL, 'each is rejected');
select throws_ok($$insert into numeric_fixture (unit) values ('EA')$$, '23514', NULL, 'EA is rejected');
select throws_ok($$insert into numeric_fixture (state) values ('maybe')$$, '23514', NULL, 'invalid value state is rejected');
select ok(foundation.is_valid_value_state_pair('known'::foundation.value_state, true), 'known requires a value');
select ok(foundation.is_valid_value_state_pair('unknown'::foundation.value_state, false), 'unknown requires absence of a value');
select ok(foundation.is_valid_value_state_pair('not_applicable'::foundation.value_state, false), 'not applicable requires absence of a value');
select ok(not foundation.is_valid_value_state_pair('known'::foundation.value_state, false), 'known without a value is invalid');
select ok(not foundation.is_valid_value_state_pair('unknown'::foundation.value_state, true), 'unknown with a value is invalid');
select ok(not foundation.is_valid_value_state_pair('not_applicable'::foundation.value_state, true), 'not applicable with a value is invalid');

select ok(foundation.is_uuid_v4('123e4567-e89b-42d3-a456-426614174000'::uuid), 'valid UUIDv4 passes');
select ok(not foundation.is_uuid_v4('123e4567-e89b-12d3-a456-426614174000'::uuid), 'UUIDv1 fails UUIDv4 validator');
select ok(not foundation.is_uuid_v4('123e4567-e89b-52d3-a456-426614174000'::uuid), 'UUIDv5 fails UUIDv4 validator');
select ok(not foundation.is_uuid_v4('00000000-0000-0000-0000-000000000000'::uuid), 'nil UUID fails UUIDv4 validator');
select throws_ok($$insert into public.organizations (id) values ('123e4567-e89b-12d3-a456-426614174001')$$, '23514', NULL, 'organization UUIDv4 constraint rejects UUIDv1');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.application_users'::regclass and conname = 'application_users_id_uuid_v4'), 'application-user UUIDv4 constraint exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.organizations'::regclass and conname = 'organizations_id_uuid_v4'), 'organization UUIDv4 constraint exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.locations'::regclass and conname = 'locations_id_uuid_v4'), 'location UUIDv4 constraint exists');
select throws_ok($$insert into public.organizations (id) values ('not-a-uuid')$$, '22P02', NULL, 'malformed textual UUID cannot enter a UUID column');
select ok(not exists (select 1 from pg_constraint where conrelid = 'auth.users'::regclass and conname like '%uuid_v4%'), 'Supabase auth principal IDs are not redefined as KitchenIQ UUIDv4 IDs');

select has_table('private', 'external_identifier_mappings', 'external identifier mapping table exists');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = 'external_identifier_mappings'), 'external mappings are not exposed');
insert into private.external_identifier_mappings (source_namespace, external_id, kitchen_iq_id)
values ('pos', '00123', '123e4567-e89b-42d3-a456-426614174002');
select throws_ok($$insert into private.external_identifier_mappings values ('pos', '00123', '123e4567-e89b-42d3-a456-426614174003')$$, '23505', NULL, 'duplicate external mapping is rejected');
insert into private.external_identifier_mappings (source_namespace, external_id, kitchen_iq_id)
values ('other-pos', '00123', '123e4567-e89b-42d3-a456-426614174003');
select is((select external_id from private.external_identifier_mappings where source_namespace = 'pos'), '00123', 'external identifier spelling is preserved');
select throws_ok($$insert into private.external_identifier_mappings values (' pos', '002', '123e4567-e89b-42d3-a456-426614174004')$$, '23514', NULL, 'mapping namespace leading whitespace is rejected');
select throws_ok($$insert into private.external_identifier_mappings values ('pos', '002 ', '123e4567-e89b-42d3-a456-426614174004')$$, '23514', NULL, 'mapping external id trailing whitespace is rejected');
select throws_ok($$insert into private.external_identifier_mappings values ('pos', '003', '123e4567-e89b-12d3-a456-426614174004')$$, '23514', NULL, 'mapping target must be UUIDv4');

select * from finish();
rollback;