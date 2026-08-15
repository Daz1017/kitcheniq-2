-- F-38 reusable Foundation database contracts for numeric, identity, unit, and state integrity.
create schema if not exists foundation;

revoke all on schema foundation from public, anon, authenticated;

create domain foundation.monetary_total_amount as numeric(19, 4);
create domain foundation.unit_cost_amount as numeric(20, 8);
create domain foundation.physical_quantity as numeric(20, 8);
create domain foundation.ratio_rate_percent as numeric(18, 8);

create domain foundation.currency_code as text
  check (value <> '' and value = btrim(value));

create domain foundation.canonical_unit_code as text
  check (value in ('g', 'mL', 'ea'));

create domain foundation.value_state as text
  check (value in ('known', 'unknown', 'not_applicable'));

create or replace function foundation.is_uuid_v4(value uuid)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select value::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

create or replace function foundation.is_valid_value_state_pair(
  state foundation.value_state,
  value_present boolean
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select (state = 'known' and value_present)
      or (state in ('unknown', 'not_applicable') and not value_present);
$$;

create or replace function foundation.is_valid_quantity_pair(
  value foundation.physical_quantity,
  unit foundation.canonical_unit_code
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select value is not null and unit is not null;
$$;

alter table private.application_users
  add constraint application_users_id_uuid_v4
  check (foundation.is_uuid_v4(id));

alter table public.organizations
  add constraint organizations_id_uuid_v4
  check (foundation.is_uuid_v4(id));

alter table public.locations
  add constraint locations_id_uuid_v4
  check (foundation.is_uuid_v4(id));

create table private.external_identifier_mappings (
  source_namespace text not null,
  external_id text not null,
  kitchen_iq_id uuid not null,
  primary key (source_namespace, external_id),
  check (source_namespace <> '' and source_namespace = btrim(source_namespace)),
  check (external_id <> '' and external_id = btrim(external_id)),
  check (foundation.is_uuid_v4(kitchen_iq_id))
);