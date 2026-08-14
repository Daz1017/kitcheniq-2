F-35 Environment + Database Migration Execution Foundation

Status:

- Implemented locally only.
- No remote Supabase linking or deployment is authorized in this checkpoint.

Scope

F-35 operationalizes local infrastructure for:

- runtime environment selection with fail-closed behavior;
- local Supabase/PostgreSQL stack execution;
- source-controlled ordered migration execution;
- reproducible local reset-based migration verification.

Project-pinned Supabase CLI

- The repository pins Supabase CLI as an exact dev dependency.
- Local workflow scripts call the project-pinned binary through npm scripts.
- Global-only CLI usage is not the authoritative project workflow.

Runtime environment boundary

- Runtime loading is implemented outside the frozen F-13 primitive.
- Loader reads `KITCHENIQ_ENVIRONMENT` and validates through the frozen `isEnvironmentClass` validator.
- Accepted values are exact and frozen:
  - `development`
  - `automated_test`
  - `staging`
  - `production`
- Missing values fail closed.
- Invalid values fail closed.
- No normalization is applied (for example, case changes or trimming are not accepted).

Automated test safety boundary

- The standard test command executes with `KITCHENIQ_ENVIRONMENT=automated_test`.
- Runtime safety assertion rejects any non-`automated_test` environment during automated-test execution.
- This prevents automated-test configuration from resolving to `production`.

Local migration execution model

- Supabase migration files are source-controlled under `supabase/migrations`.
- Migrations execute in ordered timestamp sequence.
- Reproducibility is validated through repeated `supabase db reset` execution against local infrastructure.
- Shared applied migrations remain immutable under the frozen migration governance contract.

Authorization boundaries

- Remote operations are not authorized in F-35.
- Commands such as `supabase login`, `supabase link`, `supabase db push`, and `supabase db pull` remain out of scope.
- Staging/production project creation and deployment workflows are deferred.
- F-35 does not add KitchenIQ application/domain schema.
- F-35 does not implement Auth/RBAC/RLS/audit/idempotency/outbox persistence schema.

Deferred ownership

- F-36 is expected to own authentication and application-user persistence decisions and schema introduction.
