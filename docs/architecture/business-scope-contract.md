# Business Scope Contract

## Authoritative hierarchy

- Organization → Location
- Business scope is a representation primitive for carrying organizational and location context.
- Organization and Location identifiers use the frozen UUIDv4 identifier primitive.

## Scope kinds

- `organization` scope contains an `organizationId`.
- `location` scope contains both `organizationId` and `locationId`.

## Constraints

- Scope representation is structural only; it does not grant authorization.
- Entity existence and relationship validation are deferred to later service or persistence checkpoints.
- Membership, RBAC, RLS, authentication, audit, and events are intentionally out of scope for this primitive.
- Mutable names and display attributes are not identity and are not part of the Foundation scope representation.
