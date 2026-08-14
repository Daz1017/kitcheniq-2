# User Identity Contract

## Stable application identity

- ApplicationUserId is a stable KitchenIQ identity that uses the frozen UUIDv4 identifier primitive.
- Authentication principal references are explicitly namespaced as `supabase_auth` and remain external/opaque.

## Scope and profile separation

- Application user identity does not embed organization or location scope.
- Mutable profile fields such as email or display name are not part of the Foundation identity primitive.

## Constraints

- The primitive is representation-only and does not implement authentication, sessions, MFA, membership, RBAC, RLS, or database persistence.
- Supabase Auth is the authoritative authentication system. `auth.users(id)` is the referenced principal key.
- F-36 persists exactly one internal mapping per Supabase principal in `private.application_users`.
- ApplicationUserId is independently generated, stable Foundation identity and remains distinct from the Supabase principal.
- The mapping is internal and is resolved only from the authenticated `auth.uid()` boundary; callers cannot supply another principal.
- Access tokens are cryptographically verified with the supported Supabase Auth SDK method before identity resolution. Session state is not trusted as identity proof.
- Identity data remains separate from mutable profile data. F-36 invents no profile fields.
- The public Supabase API key is public client configuration. Secret/service-role credentials are outside F-36.
- RBAC, authorization, RLS, MFA, privileged writes, and remote Supabase configuration remain deferred to F-37 or later.
