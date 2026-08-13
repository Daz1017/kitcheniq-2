# Backup and Restore Policy Contract

F-28 defines immutable backup and restore policy metadata. The policy is exposed as `BACKUP_RECOVERY_POLICY` and contains exactly five fields.

## Required Policy

- `managedEncryptedBackupRequired` is exactly `true`; managed encrypted backup is required.
- `pointInTimeRecoveryOrEquivalentRequired` is exactly `true`; PITR or an equivalent recovery capability is required.
- `rollingRetentionDays` is exactly `30`; the retention value remains expressed in days.
- `preHighRiskMigrationRecoveryPointRequired` is exactly `true`; a recovery point is required before high-risk or destructive production migrations.
- `restoreExerciseCadence` is exactly `'quarterly'`.

The policy object is frozen at runtime and typed as read-only metadata. JSON serialization preserves the exact five-field shape and values.

## Scope

This primitive describes required backup and restore policy metadata only. It does not convert `30` days to months, hours, or seconds, convert `quarterly` to a fixed number of days, execute backups, implement PITR, execute restores, select or configure a provider, assume Supabase capabilities, implement encryption, classify migration risk, calculate compliance, add backup schedules, compose environments, read configuration or secrets, implement CI/CD or deployment gates, access production data, or implement Module 1-11 behavior.

Provider configuration, backup and restore execution, migration-risk classification, and compliance evidence or monitoring are explicitly deferred.

No provider, schedule, encryption configuration, restore procedure, migration-risk classification, compliance evidence, or monitoring fields are part of this policy.