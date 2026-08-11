# User Identity Contract

## Stable application identity

- ApplicationUserId is a stable KitchenIQ identity that uses the frozen UUIDv4 identifier primitive.
- Authentication principal references are explicitly namespaced as `supabase_auth` and remain external/opaque.

## Scope and profile separation

- Application user identity does not embed organization or location scope.
- Mutable profile fields such as email or display name are not part of the Foundation identity primitive.

## Constraints

- The primitive is representation-only and does not implement authentication, sessions, MFA, membership, RBAC, RLS, or database persistence.
- Global uniqueness enforcement for the one-user-to-one-principal mapping is deferred to later persistence checkpoints.
