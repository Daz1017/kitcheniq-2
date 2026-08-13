# Migration Governance Policy Contract

F-31 defines immutable Foundation metadata for the FB-024 database-migration governance rules. It is policy metadata only; it does not create migrations or implement migration execution infrastructure.

## Required Governance

- Migration history is source-controlled.
- Migrations are ordered.
- A migration is immutable once it has been applied to a shared environment. F-31 does not determine whether a migration has actually been applied.
- Normal schema evolution is exactly `forward_only`.
- Corrections use exactly `corrective_migration` or `controlled_restore`; editing an already-applied migration is not a repair strategy.
- Data migrations are expected to be restartable and idempotent where practical. The qualifier remains intentionally non-absolute.
- High-risk or destructive production migration promotion requires validated backup/recovery, compatibility planning, and controlled promotion.
- KitchenIQ 1 production is a protected migration source and must not be destructively transformed in place.

The policy is exposed as `MIGRATION_GOVERNANCE_POLICY`, is read-only and frozen at runtime, and contains no migration execution state.

## Scope

F-31 does not create SQL or database migrations, migration filename or version conventions, migration runners, filesystem scanners, SQL execution, ordering engines, migration validation, rollback scripts, migration lifecycle models, risk classifiers, deployment pipelines, CI/CD or staging promotion, Supabase CLI configuration, database objects, RLS, provider access, production-data access, or Module 1-11 migration behavior.

It does not implement the required backup/recovery, compatibility-planning, or controlled-promotion controls; it records the governance requirements only. It does not implement KitchenIQ 1 extraction, staging, transformation, reconciliation, or migration execution.

Future migration and deployment architecture must evolve through controlled Foundation contracts. F-31 is not permission for modules to invent incompatible migration governance or lifecycle rules.