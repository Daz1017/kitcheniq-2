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
* Foundation idempotency governance policy metadata for authoritative operation/scope/idempotency-key/request-hash/result-reference binding, material-difference rejection, and a 90-day minimum replay protection floor with permanent external-source uniqueness protection where available.
* Foundation event identity primitives for immutable UUIDv4-based asynchronous event identity.
* Foundation event type primitives for open, opaque asynchronous event type values.
* Foundation event producer primitives for open, opaque asynchronous event producer values without a registry or naming grammar.
* Foundation event schema-version primitives for open, opaque asynchronous event schema version values without a registry or enforced naming grammar.
* Foundation event delivery governance policy metadata for a transactional outbox or equivalent and an `at_least_once` delivery guarantee.
* Foundation currency-code primitives for open, opaque currency denomination identifiers that remain distinct from identity and classification primitives.
* Foundation money value-object primitives for monetary amounts paired with a validated currency code.
* Foundation monetary precision profiles for the frozen `monetary_total` (`19`, `4`) and `unit_cost` (`20`, `8`) precision/scale pairs.
* Foundation audit retention profiles for `financial_security` (`7` years) and `protected_operational` (`2` years).
* Foundation recovery objective primitives for `rpo` (`1` hour maximum) and `rto` (`4` hours maximum).
* Foundation backup and restore policy metadata for managed encrypted backups, PITR or equivalent recovery, `30` rolling retention days, pre-high-risk migration recovery points, and `quarterly` restore exercises.
* Foundation operational log retention metadata for `30` searchable retention days.
* Foundation operational health signal classification for `error`, `import_failure`, `integration_failure`, `event_backlog`, `job_failure`, and `backup_failure`.
* Foundation migration governance policy metadata for source-controlled ordered history, forward-only evolution, governed repair, restartable/idempotent data migration where practical, and controlled high-risk/destructive promotion.
* Foundation deployment governance policy metadata for reproducible revision-bound artifacts, required verification, compatibility sequencing, staging, explicit approval, and production protections.
* Foundation runtime environment loader primitives for fail-closed `KITCHENIQ_ENVIRONMENT` resolution and automated-test runtime safety enforcement.
* Foundation F-37 authorization and scope infrastructure: explicit permission mappings, exact organization/location assignments, database-authoritative default-deny RLS, owner/admin AAL2 enforcement, and a server-only Create Location write boundary. Direct authenticated writes remain denied. F-37 does not build MFA enrollment UI or complete privileged-operation auditing; F-39 owns audit/provenance, and Module permission catalogs remain deferred.
* Foundation F-38 database integrity contracts in the internal, non-exposed `foundation` schema: exact PostgreSQL `NUMERIC` persistence domains, open currency-code validation, canonical `g`/`mL`/`ea` units, explicit value-state pairing, UUIDv4 enforcement for KitchenIQ-owned IDs, and namespaced external-identifier uniqueness. F-38 does not add module tables, currency catalogs, target entity-type vocabularies, or unit conversions.
* Foundation F-39 append-oriented audit and provenance persistence: internal immutable audit records with database-generated time, authenticated ApplicationUserId actor, explicit BusinessScope, CorrelationId propagation, source/process/rule version, structured secret-free change context, and F-26 retention classification. Audited Create Location is atomic with its audit append; audit remains separate from F-40 events/outbox and future module provenance.
* Foundation F-40 idempotency, event, and outbox infrastructure: exact operation/scope/key/hash binding, same-request replay, mismatch rejection, concurrent duplicate suppression, immutable Foundation location-created events, atomic audit/event/outbox/result persistence, and service-only at-least-once leased delivery. F-40 does not add brokers, exactly-once semantics, module event catalogs, or universal consumer deduplication.

Foundation owns the shared primitives and contracts in `src/foundation` and exposes them for other modules to consume.
