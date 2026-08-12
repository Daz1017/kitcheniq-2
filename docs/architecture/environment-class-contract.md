Environment classes (F-13)

This document defines the four Foundation execution and data environments.

Canonical environments (exact, frozen, ordering preserved):

- development
- automated_test
- staging
- production

Semantics:

- These are distinct execution and data environments.
- Production infrastructure and data are segregated from lower environments.
- Automated tests must never target production.
- Production business data cannot be copied to lower environments without explicit authorization and sanitization.
- Staging is required before production release of architecture and database-affecting changes.

Out of scope (deferred):

- F-13 does not load configuration.
- F-13 does not manage secrets.
- F-13 does not deploy infrastructure.
- External environment labels such as NODE_ENV=test are not Foundation environment values unless explicitly mapped by a later authorized checkpoint.
