# Role Assurance Contract

This document specifies the role-derived authentication assurance policy introduced in F-11.

Key points:

- FB-003 requires `aal2` for the `owner` and `admin` role classes.
- `manager`, `staff`, and `read_only` have a baseline role-derived `aal1` requirement.
- `aal1` does NOT mean every operation may execute at `aal1` — some actions may still require `aal2`.
- Security-sensitive privileged operations may independently require `aal2` later; F-11 does not implement those operation-specific rules.
- F-11 does not implement Supabase Auth, MFA, session/JWT inspection, or any enforcement mechanism.
- F-11 does not define permissions or privileged-operation identifiers; enforcement is deferred.
