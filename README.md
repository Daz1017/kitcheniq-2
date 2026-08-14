# kitcheniq-2

## Foundation local database workflow

This repository uses a project-pinned Supabase CLI to run local PostgreSQL infrastructure for Foundation migration execution.

Use the local workflow commands:

- `npm run db:start`
- `npm run db:status`
- `npm run db:reset`
- `npm run db:stop`

Migrations are source-controlled and ordered under `supabase/migrations`.

F-35 authorizes local execution only. Remote project linking and deployment commands are intentionally out of scope.

## Runtime environment selection

`KITCHENIQ_ENVIRONMENT` is required at runtime and must be exactly one of:

- `development`
- `automated_test`
- `staging`
- `production`

Missing or invalid values fail closed.

The default test command enforces `KITCHENIQ_ENVIRONMENT=automated_test` and includes a runtime guard so automated tests cannot execute as `production`.