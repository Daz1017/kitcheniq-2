# kitcheniq-2

## Foundation local database workflow

This repository uses a project-pinned Supabase CLI to run local PostgreSQL infrastructure for Foundation migration execution.

Use the local workflow commands:

- `npm run db:start`
- `npm run db:status`
- `npm run db:reset`
- `npm run db:stop`

Migrations are source-controlled and ordered under `supabase/migrations`.

## F-36 local authentication

Supabase Auth is the authoritative authentication system. F-36 creates an independently generated, stable `ApplicationUserId` and exactly one internal mapping to `auth.users(id)` in `private.application_users`; the Supabase principal and KitchenIQ identity remain distinct. No profile fields are stored or invented.

Use `npm run test:db` for local pgTAP database tests and `npm run test:auth:local` for the local public-key signup, access-token verification, and identity-resolution integration test. Set `KITCHENIQ_SUPABASE_URL` and the non-secret `KITCHENIQ_SUPABASE_PUBLIC_KEY` before running the Auth test. Secret/service-role keys, remote projects, RBAC, RLS, MFA, authorization, and privileged writes are outside F-36.

F-35 authorizes local execution only. Remote project linking and deployment commands are intentionally out of scope.

## Runtime environment selection

`KITCHENIQ_ENVIRONMENT` is required at runtime and must be exactly one of:

- `development`
- `automated_test`
- `staging`
- `production`

Missing or invalid values fail closed.

The default test command enforces `KITCHENIQ_ENVIRONMENT=automated_test` and includes a runtime guard so automated tests cannot execute as `production`.