-- F-40 durable idempotency, immutable event envelopes, and transactional outbox delivery.
create table private.idempotency_records (
  id uuid primary key default extensions.gen_random_uuid(),
  operation text not null check (operation <> '' and operation = btrim(operation)),
  scope_kind text not null check (scope_kind in ('organization', 'location')),
  organization_id uuid not null references public.organizations(id),
  location_id uuid,
  idempotency_key text not null check (idempotency_key <> '' and idempotency_key = btrim(idempotency_key)),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result_kind text check (result_kind is null or (result_kind <> '' and result_kind = btrim(result_kind))),
  result_id uuid,
  created_at timestamptz not null default now(),
  check (foundation.is_uuid_v4(id)),
  check (foundation.is_uuid_v4(result_id)),
  check ((result_kind is null and result_id is null) or (result_kind is not null and result_id is not null)),
  check ((scope_kind = 'organization' and location_id is null)
      or (scope_kind = 'location' and location_id is not null)),
  foreign key (location_id, organization_id) references public.locations(id, organization_id),
  unique (id)
);

create unique index idempotency_records_organization_key_idx
  on private.idempotency_records (operation, organization_id, idempotency_key)
  where scope_kind = 'organization';
create unique index idempotency_records_location_key_idx
  on private.idempotency_records (operation, organization_id, location_id, idempotency_key)
  where scope_kind = 'location';
create index idempotency_records_result_idx on private.idempotency_records (result_kind, result_id);

create table private.event_records (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type text not null check (event_type <> '' and event_type = btrim(event_type)),
  schema_version text not null check (schema_version <> '' and schema_version = btrim(schema_version)),
  producer text not null check (producer <> '' and producer = btrim(producer)),
  scope_kind text not null check (scope_kind in ('organization', 'location')),
  organization_id uuid not null references public.organizations(id),
  location_id uuid,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null check (foundation.is_uuid_v4(correlation_id)),
  causation_id uuid not null references private.idempotency_records(id),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  check (foundation.is_uuid_v4(id)),
  check ((scope_kind = 'organization' and location_id is null)
      or (scope_kind = 'location' and location_id is not null)),
  foreign key (location_id, organization_id) references public.locations(id, organization_id)
);

create index event_records_correlation_idx on private.event_records (correlation_id);
create index event_records_causation_idx on private.event_records (causation_id);

create table private.event_outbox (
  event_id uuid primary key references private.event_records(id),
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_until timestamptz,
  claim_token uuid,
  delivered_at timestamptz,
  last_error text,
  check (foundation.is_uuid_v4(claim_token)),
  check ((delivered_at is null) or (lease_until is null and claim_token is null))
);

create index event_outbox_available_idx on private.event_outbox (available_at, delivered_at, lease_until);

create or replace function private.reject_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'event records are append-only' using errcode = '42501';
end;
$$;

create trigger event_records_immutable
before update or delete on private.event_records
for each row execute function private.reject_event_mutation();

revoke all on table private.idempotency_records, private.event_records, private.event_outbox from public, anon, authenticated, service_role;
revoke all on function private.reject_event_mutation() from public, anon, authenticated, service_role;

create or replace function public.create_location_idempotent(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  idempotency_record private.idempotency_records%rowtype;
  new_location_id uuid;
  new_event_id uuid;
begin
  if p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'request hash is invalid' using errcode = '22023';
  end if;

  insert into private.idempotency_records (
    operation,
    scope_kind,
    organization_id,
    idempotency_key,
    request_hash
  ) values (
    'foundation.location.create',
    'organization',
    p_organization_id,
    p_idempotency_key,
    p_request_hash
  ) on conflict (operation, organization_id, idempotency_key) where scope_kind = 'organization' do nothing;

  select * into idempotency_record
  from private.idempotency_records
  where operation = 'foundation.location.create'
    and scope_kind = 'organization'
    and organization_id = p_organization_id
    and location_id is null
    and idempotency_key = p_idempotency_key
  for update;

  if idempotency_record.request_hash <> p_request_hash then
    raise exception 'idempotency key was reused for a different request' using errcode = '23505';
  end if;

  if idempotency_record.result_id is not null then
    return jsonb_build_object('locationId', idempotency_record.result_id, 'replayed', true);
  end if;

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
      'after', jsonb_build_object('locationId', new_location_id, 'organizationId', p_organization_id)
    )
  );

  insert into private.event_records (
    event_type,
    schema_version,
    producer,
    scope_kind,
    organization_id,
    correlation_id,
    causation_id,
    payload
  ) values (
    'foundation.location.created',
    '1',
    'foundation.create_location',
    'organization',
    p_organization_id,
    p_correlation_id,
    idempotency_record.id,
    jsonb_build_object('locationId', new_location_id, 'organizationId', p_organization_id)
  ) returning id into new_event_id;

  if to_regclass('pg_temp.f40_force_outbox_failure') is not null then
    raise exception 'forced F-40 outbox failure' using errcode = 'P0001';
  end if;

  insert into private.event_outbox (event_id)
  values (new_event_id);

  update private.idempotency_records
  set result_kind = 'location', result_id = new_location_id
  where id = idempotency_record.id;

  return jsonb_build_object('locationId', new_location_id, 'replayed', false);
end;
$$;

revoke all on function public.create_location_idempotent(uuid, uuid, text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_location_idempotent(uuid, uuid, text, uuid, text, text, uuid) to service_role;

revoke all on function public.create_location(uuid, uuid, text, uuid, uuid) from service_role;

create or replace function public.claim_event_outbox(p_limit integer, p_lease_seconds integer)
returns table (
  event_id uuid,
  claim_token uuid,
  event_type text,
  schema_version text,
  producer text,
  correlation_id uuid,
  causation_id uuid,
  payload jsonb
)
language sql
security definer
set search_path = pg_catalog
as $$
  with candidates as (
    select outbox.event_id
    from private.event_outbox as outbox
    where outbox.delivered_at is null
      and outbox.available_at <= now()
      and (outbox.lease_until is null or outbox.lease_until <= now())
    order by outbox.available_at, outbox.event_id
    limit greatest(least(p_limit, 100), 0)
    for update of outbox skip locked
  ), claimed as (
    update private.event_outbox as outbox
    set attempt_count = outbox.attempt_count + 1,
        lease_until = now() + make_interval(secs => greatest(least(p_lease_seconds, 3600), 1)),
        claim_token = extensions.gen_random_uuid()
    from candidates
    where outbox.event_id = candidates.event_id
    returning outbox.event_id, outbox.claim_token
  )
  select claimed.event_id,
         claimed.claim_token,
         event.event_type,
         event.schema_version,
         event.producer,
         event.correlation_id,
         event.causation_id,
         event.payload
  from claimed
  join private.event_records as event on event.id = claimed.event_id;
$$;

create or replace function public.mark_event_delivered(p_event_id uuid, p_claim_token uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update private.event_outbox
  set delivered_at = now(), lease_until = null, claim_token = null
  where event_id = p_event_id
    and claim_token = p_claim_token
    and delivered_at is null
    and lease_until > now();
  return found;
end;
$$;

create or replace function public.release_event_claim(p_event_id uuid, p_claim_token uuid, p_last_error text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update private.event_outbox
  set available_at = now(), lease_until = null, claim_token = null, last_error = left(p_last_error, 1000)
  where event_id = p_event_id
    and claim_token = p_claim_token
    and delivered_at is null;
  return found;
end;
$$;

revoke all on function public.claim_event_outbox(integer, integer), public.mark_event_delivered(uuid, uuid), public.release_event_claim(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_event_outbox(integer, integer), public.mark_event_delivered(uuid, uuid), public.release_event_claim(uuid, uuid, text) to service_role;