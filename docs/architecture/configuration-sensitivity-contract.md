Configuration sensitivity classification (F-14)

This document defines the two Foundation configuration sensitivity classifications.

Canonical sensitivities (exact, frozen, ordering preserved):

- public_client
- secret

Semantics:

- public_client: explicitly approved for client-side (browser) exposure; not authorization data, not credential, subject to authentication/authorization policy.
- secret: server/infrastructure-only controlled secret storage; cannot enter source control, client bundles, or logs.

Classification:

- Classification is explicit and declared by the developer or system design, not guessed from key names.
- Service-role, database, and integration credentials are always secret.

Credential exposure:

- Secret credential exposure requires rotation under FB-023.

Out of scope (deferred):

- Environment composition of configuration values.
- Configuration loading and initialization.
- Secret storage provider selection (e.g., GitHub Secrets, Netlify environment, Supabase Vault, AWS/Azure/GCP secret managers).
- Credential rotation implementation.
- Redaction and logging infrastructure.
