# Foundation

This package provides shared Foundation infrastructure used across KitchenIQ 2.0 modules.

It includes:

* `CorrelationId` as a UUIDv4-based identifier primitive for request tracing and diagnostics.
* `FoundationErrorContract` as the stable error contract that includes `code`, `category`, `userMessage`, `correlationId`, and `retryable`.
* Foundation RBAC primitives for canonical role classification (`RoleClass`, `ROLE_CLASSES`, `isRoleClass`).
* Foundation auth-assurance primitives for role-derived authentication assurance policy (`requiredAssuranceForRole`, `roleRequiresAal2`, `AUTH_ASSURANCE_LEVELS`).
* Foundation privileged-operation classification primitives for canonical privileged operation metadata (`PRIVILEGED_OPERATION_CLASSES`, `PrivilegedOperationClass`, `isPrivilegedOperationClass`).
* Foundation environment classification primitives for execution and data environment distinction (`ENVIRONMENT_CLASSES`, `EnvironmentClass`, `isEnvironmentClass`, `isProductionEnvironment`, `isLowerEnvironment`).
* Foundation configuration sensitivity classification primitives for explicit secret/public configuration distinction (`CONFIGURATION_SENSITIVITIES`, `ConfigurationSensitivity`, `isConfigurationSensitivity`, `isPublicClientConfiguration`, `isSecretConfiguration`).
* Foundation decimal primitives for authoritative decimal parsing, exact arithmetic, and explicit half-up rounding.
* Foundation value-state primitives for representing `known`, `unknown`, and `not_applicable` without fallback behavior.
* Foundation dimension and canonical base-unit primitives for the frozen unit substrate (`mass`, `volume`, `count`; `g`, `mL`, `ea`).
* Foundation quantity primitives for canonical decimal quantities over the frozen unit substrate.
* Foundation business-scope primitives for immutable organization and location scope representation.
* Foundation identity primitives for immutable application-user identity and Supabase-auth principal references.
* Foundation external identifier primitives for opaque, source-namespaced identifiers that are kept separate from KitchenIQ entity identifiers.
* Foundation external identifier mapping references for explicitly connecting an external reference to a KitchenIQ UUIDv4 entity identifier without persistence or lookup.
* Foundation idempotency key primitives for caller-supplied opaque keys without operation, scope, or persistence binding.
* Foundation event identity primitives for immutable UUIDv4-based asynchronous event identity.

Foundation owns the shared primitives and contracts in `src/foundation` and exposes them for other modules to consume.
