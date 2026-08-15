-- F-39 durable append-oriented audit and provenance persistence.
create domain foundation.audit_retention_profile as text
  check (value in ('financial_security', 'protected_operational'));

create table private.audit_records (
  id uuid primary key default extensions.gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_application_user_id uuid not null references private.application_users(id),
  action text not null check (action <> '' and action = btrim(action)),
  target_kind text not null check (target_kind <> '' and target_kind = btrim(target_kind)),
  target_id uuid not null,
  scope_kind text not null check (scope_kind in ('organization', 'location')),
  organization_id uuid not null references public.organizations(id),
  location_id uuid,
  correlation_id uuid not null check (foundation.is_uuid_v4(correlation_id)),
  source text not null check (source <> '' and source = btrim(source)),
  process text not null check (process <> '' and process = btrim(process)),
  rule_version text not null check (rule_version <> '' and rule_version = btrim(rule_version)),
  retention_profile foundation.audit_retention_profile not null,
  change_context jsonb not null,
  check (foundation.is_uuid_v4(id)),
  check (foundation.is_uuid_v4(target_id)),
  check (jsonb_typeof(change_context) = 'object'),
  check ((scope_kind = 'organization' and location_id is null)
      or (scope_kind = 'location' and location_id is not null)),
  foreign key (location_id, organization_id) references public.locations(id, organization_id)
);

create index audit_records_correlation_id_idx on private.audit_records (correlation_id);
create index audit_records_actor_idx on private.audit_records (actor_application_user_id);
create index audit_records_occurred_at_idx on private.audit_records (occurred_at);
create index audit_records_target_idx on private.audit_records (target_kind, target_id);
create index audit_records_scope_idx on private.audit_records (scope_kind, organization_id, location_id);

create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'audit records are append-only' using errcode = '42501';
end;
$$;

create trigger audit_records_immutable
before update or delete on private.audit_records
for each row execute function private.reject_audit_mutation();

revoke all on table private.audit_records from public, anon, authenticated, service_role;
revoke all on function private.reject_audit_mutation() from public, anon, authenticated, service_role;

create or replace function private.append_audit_record(
  p_actor_application_user_id uuid,
  p_action text,
  p_target_kind text,
  p_target_id uuid,
  p_scope_kind text,
  p_organization_id uuid,
  p_location_id uuid,
  p_correlation_id uuid,
  p_source text,
  p_process text,
  p_rule_version text,
  p_retention_profile foundation.audit_retention_profile,
  p_change_context jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  audit_id uuid;
begin
  if to_regclass('pg_temp.f39_force_audit_failure') is not null then
    raise exception 'forced F-39 audit failure' using errcode = 'P0001';
  end if;

  insert into private.audit_records (
    actor_application_user_id,
    action,
    target_kind,
    target_id,
    scope_kind,
    organization_id,
    location_id,
    correlation_id,
    source,
    process,
    rule_version,
    retention_profile,
    change_context
  ) values (
    p_actor_application_user_id,
    p_action,
    p_target_kind,
    p_target_id,
    p_scope_kind,
    p_organization_id,
    p_location_id,
    p_correlation_id,
    p_source,
    p_process,
    p_rule_version,
    p_retention_profile,
    p_change_context
  ) returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function private.append_audit_record(uuid, text, text, uuid, text, uuid, uuid, uuid, text, text, text, foundation.audit_retention_profile, jsonb) from public, anon, authenticated, service_role;

drop function public.create_location(uuid, uuid, text, uuid);

create or replace function public.create_location(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  new_location_id uuid;
begin
  if not exists (
    select 1
    from private.application_users as application_user
    where application_user.id = p_application_user_id
      and application_user.auth_principal_id = p_auth_principal_id
  ) then
    raise exception 'caller identity is not a valid application-user mapping' using errcode = '42501';
  end if;

  if not private.has_permission(
    p_application_user_id,
    'foundation.location.create',
    'organization',
    p_organization_id,
    null,
    p_aal
  ) then
    raise exception 'caller is not authorized to create a location' using errcode = '42501';
  end if;

  insert into public.locations (organization_id)
  values (p_organization_id)
  returning id into new_location_id;

  perform private.append_audit_record(
    p_application_user_id,
    'foundation.location.create',
    'location',
    new_location_id,
    'organization',
    p_organization_id,
    null,
    p_correlation_id,
    'server_command',
    'foundation.create_location',
    '1',
    'protected_operational',
    jsonb_build_object(
      'before', null,
      'after', jsonb_build_object(
        'locationId', new_location_id,
        'organizationId', p_organization_id
      )
    )
  );

  return new_location_id;
end;
$$;

revoke all on function public.create_location(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_location(uuid, uuid, text, uuid, uuid) to service_role;

create or replace function public.create_location(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid
)
returns uuid
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'create_location requires a correlation id' using errcode = '42501';
end;
$$;

revoke all on function public.create_location(uuid, uuid, text, uuid) from public, anon, authenticated, service_role;