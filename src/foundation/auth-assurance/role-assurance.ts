import { RoleClass } from '../rbac/role-class';

// Canonical, readonly assurance vocabulary — single source of truth.
export const AUTH_ASSURANCE_LEVELS = ['aal1', 'aal2'] as const;

export type AuthenticationAssuranceLevel = (typeof AUTH_ASSURANCE_LEVELS)[number];

// Authoritative mapping from RoleClass -> AuthenticationAssuranceLevel
// Exhaustive by design so adding a new RoleClass requires explicit policy review.
export function requiredAssuranceForRole(role: RoleClass): AuthenticationAssuranceLevel {
  switch (role) {
    case 'owner':
      return 'aal2';
    case 'admin':
      return 'aal2';
    case 'manager':
      return 'aal1';
    case 'staff':
      return 'aal1';
    case 'read_only':
      return 'aal1';
  }
}

export function roleRequiresAal2(role: RoleClass): boolean {
  return requiredAssuranceForRole(role) === 'aal2';
}

export default {
  requiredAssuranceForRole,
  roleRequiresAal2,
  AUTH_ASSURANCE_LEVELS
};
