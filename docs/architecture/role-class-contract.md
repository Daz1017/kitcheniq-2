# Foundation RBAC Role-Class Contract

**Checkpoint:** F-10

**Authority:** Foundation Gate

**Status:** APPROVED / CLOSED / FROZEN

---

## Overview

F-10 establishes the frozen baseline role-class vocabulary for KitchenIQ 2.0.

Scoped RBAC is the controlling architecture. Roles are convenience permission bundles. Permissions, not role names, are authoritative. Membership and permission authority ultimately reside in controlled database records.

---

## Canonical Role Classes

Exactly five role classes are frozen in this checkpoint:

- **owner** — Organization owner. Requires MFA/AAL2 under FB-003.
- **admin** — Administrative access. Requires MFA/AAL2 under FB-003.
- **manager** — Management access.
- **staff** — Standard staff access.
- **read_only** — Read-only access.

---

## What F-10 Implements

- Canonical role-class vocabulary (five frozen values)
- TypeScript type union (`RoleClass`)
- Runtime validation function (`isRoleClass`)
- Strict validation with error detail (`validateRoleClass`)
- Case-sensitive, exact-match acceptance
- Rejection of alternate spellings and non-string values
- Serialization as ordinary JSON strings
- Closed set enforcement (no additional roles)

---

## What F-10 Does Not Implement

The following are explicitly deferred:

- **Permissions** — Permission vocabulary, codes, or identifiers
- **Role-to-Permission Bundles** — Mappings from roles to permission sets
- **Membership** — User-role assignment or membership tables
- **Authorization Evaluation** — Permission checks or access control logic
- **Business-Scope Composition** — Scoping roles by organization or location
- **MFA Enforcement** — Authentication-assurance validation or step-up
- **Database Persistence** — Role tables, enums, or lookup data
- **Row-Level Security (RLS)** — Database policies or Supabase RLS
- **Role Hierarchy** — Implied permission inheritance or role rank
- **User-Role Composition** — Attaching roles to identity primitives

---

## Role-Class Contract

### Serialization

Role classes are ordinary JSON strings:

```json
{
  "role": "manager"
}
```

No wrapper class, custom serialization, or metadata is required.

### Case and Spelling

Role classes are exact serialized values:

**Accept:**

```typescript
'owner'
'admin'
'manager'
'staff'
'read_only'
```

**Reject:**

```typescript
'Owner'       // uppercase mismatch
'ADMIN'       // all caps
'Manager'     // uppercase mismatch
'Staff'       // uppercase mismatch
'read-only'   // hyphen instead of underscore
'readonly'    // no underscore
'READ_ONLY'   // all caps
'read only'   // space instead of underscore
```

Do not silently normalize alternate spellings.

### Type Guard

```typescript
import { isRoleClass, RoleClass } from './foundation/rbac';

const value: unknown = getUserRole();

if (isRoleClass(value)) {
  // TypeScript narrows to RoleClass
  const role: RoleClass = value;  // safe
}
```

### Validation

```typescript
import { validateRoleClass } from './foundation/rbac';

try {
  const role = validateRoleClass(userInput);
  // role is RoleClass, safe to use
} catch (e) {
  // Handle invalid role
}
```

---

## Default Authorization

The frozen architecture uses **default-deny authorization**:

- Access is denied unless explicitly granted.
- Possession of a role string is not itself authoritative permission.
- Permission checks—not role names—determine access.
- Database records hold the authoritative membership and permission data.
- UI state is never authorization.

---

## Future Checkpoints

The following are enabled after F-10:

- **F-11 and beyond** — Permission vocabulary, role-to-permission bundles, membership persistence, authorization logic, RLS, and business-scope composition.

---

## References

- **FB-004** — Authorization: Scoped RBAC with explicit permissions
- **FB-003** — MFA: Owner/Admin-class accounts require MFA/AAL2
- **FB-005** — Business Scope: RBAC scoped by Organization → Location
- **FB-007** — RLS: Future RLS consumes authoritative membership/scope

---

## Implementation Status

- ✅ Role-class vocabulary frozen
- ✅ Type guard and validation
- ✅ Serialization contract
- ✅ Closed set enforcement
- ✅ Case and spelling enforcement
- ✅ Comprehensive tests
- ⏳ Permissions, membership, authorization (deferred)
- ⏳ Business-scope composition (deferred)
- ⏳ RLS (deferred)
