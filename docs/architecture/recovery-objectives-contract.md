# Recovery Objectives Contract

F-27 defines the two recovery objective kinds and their approved maximum-hour metadata.

## Objective Kinds

- `rpo` has a maximum of `1` hour.
- `rto` has a maximum of `4` hours.

The objective kinds are exposed through the readonly `RECOVERY_OBJECTIVE_KINDS` tuple. `recoveryObjectiveFor` returns immutable metadata containing only `maximumHours`. The maximum semantics are `RPO <= 1` hour and `RTO <= 4` hours.

## Validation

`isRecoveryObjectiveKind` accepts only the two exact lowercase objective kind strings. It rejects uppercase forms, aliases, normalization attempts, and all non-string values.

## Scope

This primitive only describes recovery objective metadata. It does not enforce recovery objectives, convert hours to minutes or seconds, define generic duration types, evaluate compliance, measure recovery, implement backups, PITR, restore behavior, runbooks, failover, observability, environment composition, vendor or Supabase capabilities, SQL, database work, migrations, RLS, production access, or Module 1-11 behavior.

Exactly these two objective kinds are defined:

- `rpo`
- `rto`