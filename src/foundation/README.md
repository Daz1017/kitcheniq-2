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
* Foundation non-monetary precision profiles for the frozen `physical_quantity` (`20`, `8`) and `ratio_rate_percent` (`18`, `8`) precision/scale pairs.
* Foundation value-state primitives for representing `known`, `unknown`, and `not_applicable` without fallback behavior.
* Foundation dimension and canonical base-unit primitives for the frozen unit substrate (`mass`, `volume`, `count`; `g`, `mL`, `ea`).
* Foundation quantity primitives for canonical decimal quantities over the frozen unit substrate.
* Foundation business-scope primitives for immutable organization and location scope representation.
* Foundation identity primitives for immutable application-user identity and Supabase-auth principal references.
* Foundation external identifier primitives for opaque, source-namespaced identifiers that are kept separate from KitchenIQ entity identifiers.
* Foundation external identifier mapping references for explicitly connecting an external reference to a KitchenIQ UUIDv4 entity identifier without persistence or lookup.
* Foundation idempotency key primitives for caller-supplied opaque keys without operation, scope, or persistence binding.
* Foundation event identity primitives for immutable UUIDv4-based asynchronous event identity.
* Foundation event type primitives for open, opaque asynchronous event type values.
* Foundation event producer primitives for open, opaque asynchronous event producer values without a registry or naming grammar.
* Foundation event schema-version primitives for open, opaque asynchronous event schema version values without a registry or enforced naming grammar.
* Foundation currency-code primitives for open, opaque currency denomination identifiers that remain distinct from identity and classification primitives.
* Foundation money value-object primitives for monetary amounts paired with a validated currency code.
* Foundation monetary precision profiles for the frozen `monetary_total` (`19`, `4`) and `unit_cost` (`20`, `8`) precision/scale pairs.
* Foundation audit retention profiles for `financial_security` (`7` years) and `protected_operational` (`2` years).
* Foundation recovery objective primitives for `rpo` (`1` hour maximum) and `rto` (`4` hours maximum).
* Foundation backup and restore policy metadata for managed encrypted backups, PITR or equivalent recovery, `30` rolling retention days, pre-high-risk migration recovery points, and `quarterly` restore exercises.
* Foundation operational log retention metadata for `30` searchable retention days.
* Foundation operational health signal classification for `error`, `import_failure`, `integration_failure`, `event_backlog`, `job_failure`, and `backup_failure`.
* Foundation migration governance policy metadata for source-controlled ordered history, forward-only evolution, governed repair, restartable/idempotent data migration where practical, and controlled high-risk/destructive promotion.

Foundation owns the shared primitives and contracts in `src/foundation` and exposes them for other modules to consume.
