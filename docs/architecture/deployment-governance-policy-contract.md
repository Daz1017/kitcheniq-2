# Deployment Governance Policy Contract

F-32 defines immutable Foundation metadata for release and deployment governance. It is policy metadata only; it does not implement CI/CD, deployment scripts, provider configuration, environment configuration, production releases, artifact publishing, migration execution, rollback automation, or release infrastructure.

## Required Governance

- Production releases require reproducible artifacts tied to a specific source revision.
- Typecheck, tests, build, and migration validation are required release verification gates. F-32 does not run these checks.
- Deployment changes must use backward-compatible sequencing; no specific deployment technique is mandated.
- Staging is mandatory before production releases affecting architecture or database behavior.
- Production release requires explicit approval.
- Ad hoc developer-driven production deployment is prohibited.
- Direct production database editing is prohibited.

The policy is exposed as `DEPLOYMENT_GOVERNANCE_POLICY`, is read-only and frozen at runtime, and contains no provider-specific fields or release lifecycle state.

## Scope

F-32 does not create a pipeline executor, select a CI/CD or deployment provider, create artifacts, container images, package publishing, checksums, artifact registries, provenance signing, environment promotion, staging infrastructure, approval workflows, approver identities, release requests, release status, signatures, GitHub protection configuration, deployment credentials, secret stores, migration execution, migration validation tooling, SQL, database objects, RLS, Supabase access, production access, or Module 1-11 behavior.

It does not define a release or deployment lifecycle, status values, rollback mechanism, rollback window, or automatic rollback. FB-024 and F-31 remain the governing contracts for corrective migration and controlled restore behavior. It does not prescribe `expand_contract`, `blue_green`, `canary`, `rolling`, or `feature_flag` as mandatory deployment strategies.

Provider implementation, CI/CD implementation, approval workflow implementation, release lifecycle architecture, deployment credentials and secrets, and environment configuration are deferred.