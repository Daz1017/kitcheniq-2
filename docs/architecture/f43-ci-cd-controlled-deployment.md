# F-43 CI/CD and Controlled Deployment

F-43 establishes GitHub Actions as the KitchenIQ Foundation CI/CD control plane.

## CI

Foundation CI runs for:

- pull requests targeting `main`;
- pushes to `main`;
- manual `workflow_dispatch`.

CI executes explicitly with:

KITCHENIQ_ENVIRONMENT=automated_test

It requires no hosted Supabase deployment credentials. It uses the repository-pinned Supabase CLI and the local Supabase stack to validate the complete migration chain and Foundation regression surface.

The CI control includes:

- npm ci;
- local Supabase startup;
- clean database reset;
- database contract tests;
- F-36 authentication regression;
- F-37 security regression;
- F-40 reliability regression;
- F-41 observability regression;
- F-42 local recovery exercise;
- typecheck;
- Jest tests;
- build;
- verify;
- git diff --check;
- clean-worktree verification.

Externally sourced GitHub Actions are pinned to full immutable commit SHAs.

Workflow token permissions are explicitly minimized.

## Runtime version

The repository declares Node 24.14.0 through .nvmrc.

The Supabase CLI remains repository-pinned through package.json.

No new npm dependency is introduced by F-43.

## Staging deployment

The staging workflow is manual-only.

It requires:

- an immutable 40-character commit SHA;
- the requested revision to exist on main;
- successful Foundation CI for that exact revision;
- explicit staging activation;
- staging-scoped GitHub environment credentials.

Staging deployment credentials are exposed only to the steps that validate or perform the deployment.

The staging workflow uses its own concurrency group and does not cancel an already-running deployment.

No staging project is created or selected by F-43 repository work.

Remote staging activation remains a separate controlled action.

## Production deployment

The production workflow is manual-only and fail-closed.

A push to main cannot deploy production.

Production requires all of:

- an immutable 40-character revision;
- successful Foundation CI for the exact revision;
- successful staging deployment evidence for the exact revision;
- exact hosted recovery validation state: KITCHENIQ_HOSTED_RECOVERY_VALIDATED=true;
- explicit production activation;
- successful execution of the frozen F-42 recovery:preflight;
- production environment credentials;
- protected production environment authorization when available.

Missing, false, or malformed recovery validation denies production.

F-43 does not set hosted recovery validation to true.

The mandatory F-42 hosted recovery hold remains in force.

## F-42 hosted recovery hold

Production remains blocked until independent evidence proves:

- hosted PITR or equivalent recovery capability;
- actual RPO no greater than one hour;
- independent encrypted off-primary backup storage;
- at least 30 rolling days of retention;
- isolated hosted recovery exercise;
- measured hosted RTO no greater than four hours.

These requirements are deferred under the approved development hold. They are not waived.

## Deployment credentials

Staging and production use separate GitHub environments:

staging
production

Expected environment-scoped secrets are:

SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_DB_PASSWORD

Expected environment variables are:

Staging:
KITCHENIQ_STAGING_DEPLOYMENT_ENABLED

Production:
KITCHENIQ_HOSTED_RECOVERY_VALIDATED
KITCHENIQ_PRODUCTION_DEPLOYMENT_ENABLED

Actual credential values must never be committed, documented, printed, or stored in release evidence.

## Migration authority

Source-controlled migrations are authoritative.

Normal deployment must not use:

- Dashboard SQL schema changes;
- developer-local production migration push;
- supabase db pull as deployment authority;
- edits to historical shared migrations;
- destructive automatic rollback SQL.

Corrections remain forward migrations.

## Release evidence

scripts/f43-release-manifest.js produces safe revision-bound metadata containing:

- Git revision;
- build timestamp;
- Node version;
- npm version;
- Supabase CLI version;
- target environment;
- verification status/reference;
- migration status;
- SHA-256 checksums for supplied build artifacts.

The manifest contains no credentials.

## GitHub repository controls

The repository is public.

The intended controlled main state is:

- Foundation CI required before merge/release;
- normal review for workflow changes;
- no routine bypass of required checks;
- separate staging and production GitHub environments;
- environment-scoped credentials;
- deployment branch restrictions;
- manual approval and prevent-self-review where supported by the repository's current GitHub plan.

F-43 repository implementation does not change remote repository settings.

Those settings are activated separately after Gate review.

## Production activation state

F-43 can establish an operational CI/CD control plane while production remains held.

Expected post-F-43 state:

CI/CD CONTROL PLANE:
operational

STAGING DEPLOYMENT:
inert until environment/project activation

PRODUCTION DEPLOYMENT:
hard-blocked

REASON:
mandatory hosted F-42 recovery validation outstanding
