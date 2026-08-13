# Audit Retention Profile Contract

F-26 defines the two audit retention profile names and their approved retention metadata.

## Profiles

- `financial_security` uses a retention period of `7` years.
- `protected_operational` uses a retention period of `2` years.

The profile names are exposed through the readonly `AUDIT_RETENTION_PROFILES` tuple. `retentionForAuditProfile` returns immutable metadata containing only `years`.

## Validation

`isAuditRetentionProfile` accepts only the two exact profile strings. It rejects aliases, normalization attempts, and all non-string values.

## Scope

This primitive only describes retention-period metadata. It does not convert years to days, calculate expiry, define AuditRecord/AuditEvent/AuditEntry shapes, classify actors/actions/entities, handle timestamps, run purge or archival jobs, implement legal holds or logging, or access a database, SQL, RLS, Supabase, or Module 1-11 logic.

Exactly these two profile names are defined:

- `financial_security`
- `protected_operational`
