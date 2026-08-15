-- F-37 authorization, exact business scope, RLS, and server-mediated location writes.
create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid()
);

create table public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  unique (id, organization_id)
);

create table private.permissions (
  id text primary key check (id in ('foundation.scope.read', 'foundation.location.create'))
);

create table private.role_permissions (
  role_class text not null check (role_class in ('owner', 'admin', 'manager', 'staff', 'read_only')),
  permission_id text not null references private.permissions(id),
  primary key (role_class, permission_id)
);

create table private.role_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  application_user_id uuid not null references private.application_users(id),
  role_class text not null check (role_class in ('owner', 'admin', 'manager', 'staff', 'read_only')),
  scope_kind text not null check (scope_kind in ('organization', 'location')),
  organization_id uuid not null references public.organizations(id),
  location_id uuid,
  foreign key (location_id, organization_id) references public.locations(id, organization_id),
  check ((scope_kind = 'organization' and location_id is null)
      or (scope_kind = 'location' and location_id is not null))
);

insert into private.permissions (id)
values ('foundation.scope.read'), ('foundation.location.create');

alter table public.organizations enable row level security;
alter table public.locations enable row level security;

create or replace function private.required_aal_for_role(p_role_class text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case when p_role_class in ('owner', 'admin') then 'aal2' else 'aal1' end;
$$;

create or replace function private.aal_satisfies(p_current_aal text, p_required_aal text)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select p_current_aal = 'aal2' or (p_current_aal = 'aal1' and p_required_aal = 'aal1');
$$;

create or replace function private.has_permission(
  p_application_user_id uuid,
  p_permission text,
  p_scope_kind text,
  p_organization_id uuid,
  p_location_id uuid,
  p_aal text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from private.role_assignments as assignment
    join private.role_permissions as role_permission
      on role_permission.role_class = assignment.role_class
    join private.permissions as permission
      on permission.id = role_permission.permission_id
    where assignment.application_user_id = p_application_user_id
      and permission.id = p_permission
      and assignment.scope_kind = p_scope_kind
      and assignment.organization_id = p_organization_id
      and assignment.location_id is not distinct from p_location_id
      and private.aal_satisfies(p_aal, private.required_aal_for_role(assignment.role_class))
  );
$$;

create or replace function private.current_has_permission(
  p_permission text,
  p_scope_kind text,
  p_organization_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.has_permission(
    public.current_application_user_id(),
    p_permission,
    p_scope_kind,
    p_organization_id,
    p_location_id,
    coalesce((select (auth.jwt() ->> 'aal')), '')
  );
$$;

create policy organizations_read on public.organizations
  for select to authenticated
  using (private.current_has_permission('foundation.scope.read', 'organization', id, null));

create policy locations_read on public.locations
  for select to authenticated
  using (private.current_has_permission('foundation.scope.read', 'location', organization_id, id));

grant select on public.organizations, public.locations to authenticated;
revoke insert, update, delete on public.organizations, public.locations from anon, authenticated;

create or replace function public.create_location(
  p_auth_principal_id uuid,
  p_application_user_id uuid,
  p_aal text,
  p_organization_id uuid
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
  return new_location_id;
end;
$$;

revoke all on function public.create_location(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_location(uuid, uuid, text, uuid) to service_role;