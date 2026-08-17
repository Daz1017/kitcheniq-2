# F-42 Backup and Recovery Validation

F-42 operationalizes the frozen F-28/F-27 recovery requirements without changing their values:

- managed encrypted backup capability is required;
- PITR or an equivalent rapid-recovery capability is required;
- supplemental rolling retention is at least 30 days;
- a recovery point is required before a high-risk or destructive production migration;
- restore exercises are quarterly;
- RPO is at most 1 hour;
- RTO is at most 4 hours for the agreed core production operation.

## Recovery Layers

Layer 1 is hosted Supabase PITR or an architecture-equivalent rapid recovery capability. It is the evidence source for the one-hour RPO. Layer 2 is a provider-neutral supplemental logical backup set containing cluster roles plus Foundation-scoped schema and data artifacts. The local implementation writes temporary artifacts under `.recovery/` with restrictive permissions and never commits their contents.

The supplemental set includes `roles.sql`, `schema.sql`, `data.sql`, and `manifest.json`. The schema and data artifacts include `public`, `private`, `foundation`, `auth`, `supabase_migrations`, and `extensions`; provider-managed `vault`, realtime, and cron catalogs are not treated as KitchenIQ application recovery data. The source cron schedule remains part of the F-41 database contract and must be evidenced separately. The manifest contains only safe metadata: backup-set UUIDv4, timestamps, source revision, tool/database versions, artifact names, sizes, SHA-256 checksums, and method. It contains no credentials or connection strings.

## Commands

- `npm run recovery:fixture` creates synthetic Foundation state using existing F-36 through F-41 capabilities.
- `npm run recovery:backup:local` captures roles, schema, data, and a safe manifest.
- `npm run recovery:verify` fails closed on missing, empty, size-mismatched, or checksum-mismatched artifacts.
- `npm run recovery:restore:test` restores into a newly created isolated local PostgreSQL database, validates representative state and security objects, records timing, and drops the target afterward.
- `npm run recovery:preflight <evidence.json>` accepts active PITR/equivalent evidence or a discrete recovery point no older than one hour.
- `npm run recovery:exercise:local` runs backup and isolated restore.

A local restore proves repository tooling mechanics only. Its elapsed time is explicitly labeled `local_tooling_validation`; it is not production RTO evidence.

## Restore Runbook

1. Declare the incident and obtain the authority appropriate to the environment.
2. Preserve current database, application, audit, and operational evidence before any destructive action.
3. Identify the target environment and recovery point. Prefer hosted PITR/equivalent for rapid operational recovery; use a verified supplemental logical set when the retention window or recovery path requires it.
4. Verify the selected manifest and every SHA-256 checksum. Reject missing, empty, altered, or incomplete artifacts.
5. Restore into staging or an approved isolated recovery project first. Never overwrite the only source copy during validation.
6. Restore roles only under a controlled administrative procedure. Restore schema and data with credentials supplied by the target environment, never from repository files or manifests.
7. Validate migration history, Foundation schemas, identity mappings, organization/location data, RBAC/RLS structures, F-38 domains and constraints, F-39 audit immutability, F-40 idempotency/event/outbox state, and F-41 operational-log protection.
8. Validate application health, authentication, authorization, audit correlation, event redelivery, and operational search before returning service.
9. If validation fails, preserve the failed target and evidence, stop promotion, and escalate for rollback or an alternate recovery point.
10. Rotate or reissue credentials as required by the incident. Never restore password material, access tokens, or service keys from repository documentation.

## Pre-High-Risk Migration Control

`recovery:preflight` is the recovery evidence primitive for future deployment governance. Discrete evidence must identify a backup set and a timestamp no older than one hour. Active PITR/equivalent evidence may satisfy the rapid-recovery requirement when its actual provider capability supports the frozen RPO. This is not a production deployment gate; F-43 owns CI/CD integration.

## Quarterly Exercise Record

Each exercise produces `restore-exercise.json` with `exercise_id`, `performed_at`, source backup set or recovery point, isolated restore target, start/completion timestamps, elapsed time, validation result, validated requirements, operator/evidence reference, and an explicit local evidence level. The cadence remains the literal `quarterly`; it is not converted to a fixed day count.

## Hosted Evidence Checklist

Before F-42 can be closed, Project Control must provide evidence for:

- project and environment identity;
- PITR/equivalent enabled;
- earliest and current recovery-point visibility;
- recovery-point granularity compatible with RPO at most 1 hour;
- actual retention setting and any gap to 30 days;
- supplemental backup copy age of at least 30 rolling days;
- storage outside the primary database failure boundary;
- encryption at rest and secure transport for the selected managed store;
- retrieval of a selected backup for restore;
- a representative isolated hosted restore with measured RTO at most 4 hours.

Provider documentation alone is capability evidence, not configured-environment evidence. No paid PITR activation, storage purchase, provider selection, production access, production restore, or recurring cost is authorized by F-42 repository implementation. Those actions require explicit Project Control approval.

## Scope and Safety

No new application schema or npm dependency is introduced. No custom cryptography is used. Plaintext logical dumps are sensitive temporary artifacts and are ignored, permission-restricted, and disposable. F-42 does not weaken F-27 through F-41 and does not begin F-43.
