Privileged operation classes (F-12)

This document defines the canonical privileged operation classification used for metadata and analysis only.

Canonical classes (exact, frozen, ordering preserved):

- permission_change
- destructive_operation
- bulk_correction
- protected_import
- sensitive_financial_mutation
- security_administration
- privileged_override
- equivalent_high_impact

Notes:

- Classification is metadata only; it does not grant, deny, or evaluate authorization.
- F-12 defines no concrete operation identifiers, no permissions, and no role mappings.
- F-12 defines no operation-to-AAL mapping or enforcement; step-up MFA applicability is noted when FB-003 requires it, but enforcement is out of scope.
- Server and database execution for privileged operations are intentionally deferred and must be designed with authentication, authorization, validation, and audit.
- Audit persistence, database migrations, RLS, and production-data access are deferred and out of scope for F-12.
