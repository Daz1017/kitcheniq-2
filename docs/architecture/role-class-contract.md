# Role Class Contract

This document defines the canonical role classes used by Foundation RBAC primitives.

Canonical role classes:

- `owner`
- `admin`
- `manager`
- `staff`
- `read_only`

The `RoleClass` primitive is a lightweight closed string-literal union derived from the canonical `ROLE_CLASSES` collection and is intended only for role classification (no permissions or hierarchy are defined here).

Scope and constraints
---------------------

- Scoped RBAC is the controlling architecture: role classification is scoped to application business contexts and is not itself authoritative for permissions.
- Exactly five role classes exist: `owner`, `admin`, `manager`, `staff`, `read_only`.
- Roles are convenience permission bundles; permissions (not role names) are authoritative.
- F-10 establishes no role hierarchy, ranking, or implicit inheritance.
- Default authorization is deny; explicit permission grants are required for privileged actions.
- Role-to-permission bundles are deferred and not defined by F-10.
- Membership and business-scope composition (how roles apply across organizations/locations) are deferred.
- MFA enforcement, if required, is deferred.
- Database representation and Row-Level Security (RLS) are deferred.
- UI-held role state is not authoritative for authorization decisions.
