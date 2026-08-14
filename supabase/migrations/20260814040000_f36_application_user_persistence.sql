-- F-36 application-user identity persistence and authenticated resolution.
create schema if not exists private;

create table private.application_users (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_principal_id uuid not null unique references auth.users(id)
);

create or replace function private.create_application_user_mapping()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  insert into private.application_users (auth_principal_id)
  values (new.id);
  return new;
end;
$$;

revoke all on function private.create_application_user_mapping() from public;

create trigger auth_user_application_user_mapping
after insert on auth.users
for each row execute function private.create_application_user_mapping();

insert into private.application_users (auth_principal_id)
select users.id
from auth.users as users
where not exists (
  select 1
  from private.application_users as application_users
  where application_users.auth_principal_id = users.id
);

create or replace function public.current_application_user_id()
returns uuid
language sql
security definer
stable
set search_path = pg_catalog
as $$
  select application_users.id
  from private.application_users as application_users
  where application_users.auth_principal_id = auth.uid();
$$;

revoke all on function public.current_application_user_id() from public;
grant execute on function public.current_application_user_id() to authenticated;