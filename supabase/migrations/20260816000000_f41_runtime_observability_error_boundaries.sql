-- F-41 runtime observability and error-boundary infrastructure.
create domain foundation.operational_log_severity as text
  check (value in ('debug', 'info', 'warn', 'error'));

create domain foundation.operational_log_environment as text
  check (value in ('development', 'automated_test', 'staging', 'production'));

create domain foundation.operational_health_signal as text
  check (value in ('error', 'import_failure', 'integration_failure', 'event_backlog', 'job_failure', 'backup_failure'));

create table private.operational_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  severity foundation.operational_log_severity not null,
  correlation_id uuid not null check (foundation.is_uuid_v4(correlation_id)),
  environment foundation.operational_log_environment not null,
  component text not null check (component <> '' and component = btrim(component)),
  message text not null check (message <> '' and message = btrim(message)),
  health_signal foundation.operational_health_signal,
  error_code text,
  error_category text,
  retryable boolean,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  check (foundation.is_uuid_v4(id)),
  check (error_code is null or (error_code <> '' and error_code = btrim(error_code))),
  check (error_category is null or error_category in ('validation', 'authentication', 'authorization', 'not_found', 'conflict', 'idempotency', 'integration_transient', 'internal'))
);

create index operational_logs_occurred_at_idx on private.operational_logs (occurred_at);
create index operational_logs_correlation_idx on private.operational_logs (correlation_id);
create index operational_logs_severity_idx on private.operational_logs (severity);
create index operational_logs_component_idx on private.operational_logs (component);
create index operational_logs_health_signal_idx on private.operational_logs (health_signal);
create index operational_logs_error_code_idx on private.operational_logs (error_code);
create index operational_logs_details_idx on private.operational_logs using gin (details jsonb_path_ops);

create or replace function private.append_operational_log(
  p_severity foundation.operational_log_severity,
  p_correlation_id uuid,
  p_environment foundation.operational_log_environment,
  p_component text,
  p_message text,
  p_health_signal foundation.operational_health_signal,
  p_error_code text,
  p_error_category text,
  p_retryable boolean,
  p_details jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  inserted_id uuid;
begin
  if p_correlation_id is null or not foundation.is_uuid_v4(p_correlation_id) then
    raise exception 'invalid correlation id' using errcode = '22023';
  end if;

  if p_details is null then
    p_details := '{}'::jsonb;
  end if;

  if jsonb_typeof(p_details) <> 'object' then
    raise exception 'operational log details must be a JSON object' using errcode = '22023';
  end if;

  insert into private.operational_logs (
    severity,
    correlation_id,
    environment,
    component,
    message,
    health_signal,
    error_code,
    error_category,
    retryable,
    details
  ) values (
    p_severity,
    p_correlation_id,
    p_environment,
    p_component,
    p_message,
    p_health_signal,
    p_error_code,
    p_error_category,
    p_retryable,
    p_details
  ) returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function private.delete_expired_operational_logs(p_retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  deleted_count integer;
begin
  if p_retention_days is null or p_retention_days < 0 then
    raise exception 'retention days must be a non-negative integer' using errcode = '22023';
  end if;

  with deleted as (
    delete from private.operational_logs
    where occurred_at < now() - make_interval(days => p_retention_days)
    returning 1
  )
  select count(*)::integer into deleted_count from deleted;

  return deleted_count;
end;
$$;

create or replace function public.search_operational_logs(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_correlation_id uuid default null,
  p_severity foundation.operational_log_severity default null,
  p_health_signal foundation.operational_health_signal default null,
  p_component text default null,
  p_error_code text default null
)
returns table (
  id uuid,
  occurred_at timestamptz,
  severity foundation.operational_log_severity,
  correlation_id uuid,
  environment foundation.operational_log_environment,
  component text,
  message text,
  health_signal foundation.operational_health_signal,
  error_code text,
  error_category text,
  retryable boolean,
  details jsonb
)
language sql
security definer
set search_path = pg_catalog
as $$
  select
    log.id,
    log.occurred_at,
    log.severity,
    log.correlation_id,
    log.environment,
    log.component,
    log.message,
    log.health_signal,
    log.error_code,
    log.error_category,
    log.retryable,
    log.details
  from private.operational_logs as log
  where (p_from is null or log.occurred_at >= p_from)
    and (p_to is null or log.occurred_at <= p_to)
    and (p_correlation_id is null or log.correlation_id = p_correlation_id)
    and (p_severity is null or log.severity = p_severity)
    and (p_health_signal is null or log.health_signal = p_health_signal)
    and (p_component is null or log.component = p_component)
    and (p_error_code is null or log.error_code = p_error_code)
  order by log.occurred_at desc, log.id desc;
$$;

revoke all on table private.operational_logs from public, anon, authenticated, service_role;
revoke all on function private.append_operational_log(foundation.operational_log_severity, uuid, foundation.operational_log_environment, text, text, foundation.operational_health_signal, text, text, boolean, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.delete_expired_operational_logs(integer) from public, anon, authenticated, service_role;
revoke all on function public.search_operational_logs(timestamptz, timestamptz, uuid, foundation.operational_log_severity, foundation.operational_health_signal, text, text) from public, anon, authenticated;
grant execute on function private.append_operational_log(foundation.operational_log_severity, uuid, foundation.operational_log_environment, text, text, foundation.operational_health_signal, text, text, boolean, jsonb) to service_role;
grant execute on function private.delete_expired_operational_logs(integer) to service_role;
grant execute on function public.search_operational_logs(timestamptz, timestamptz, uuid, foundation.operational_log_severity, foundation.operational_health_signal, text, text) to service_role;

create extension if not exists pg_cron;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'kitcheniq_operational_log_retention'
  ) then
    perform cron.unschedule('kitcheniq_operational_log_retention');
  end if;
end;
$$;

select cron.schedule('kitcheniq_operational_log_retention', '0 0 * * *', $$select private.delete_expired_operational_logs(30);$$);
