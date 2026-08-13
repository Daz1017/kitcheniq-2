# Operational Log Retention Contract

F-29 defines immutable operational log retention metadata. The policy is exposed as `OPERATIONAL_LOG_RETENTION_POLICY` and contains exactly one field:

- `searchableRetentionDays` is exactly `30`.

The retention value remains expressed in days. It is not converted to months, hours, minutes, or seconds. The policy is frozen at runtime and typed as read-only metadata. JSON serialization preserves the exact field and value.

## Scope

This primitive only describes the searchable retention metadata for operational logs. It does not execute retention or purge behavior, configure a provider, read configuration or secrets, define log schemas, implement observability pipelines, calculate compliance, produce compliance evidence, or implement Module 1-11 behavior.

Provider configuration, retention execution, purge scheduling, monitoring, and compliance evidence are deferred. No provider, schedule, purge, monitoring, or compliance fields are part of this policy.

## Separation and Deferred Observability Concerns

Operational logs and audit records are separate Foundation concerns. F-29 does not combine operational-log retention with the F-26 audit-retention profiles.

The structured operational-log record schema is deferred. Severity vocabulary is deferred. Correlation identity will eventually be included in structured operational logs as required by the broader observability architecture, but correlation composition and propagation are not implemented by F-29.

Secrets and unnecessary sensitive data must not be written to operational logs. Log-redaction and sanitization implementation are deferred.

Alerting, health monitoring, metrics, tracing, error monitoring, and observability pipeline implementation are deferred.

Operational-log storage and provider selection are also deferred.