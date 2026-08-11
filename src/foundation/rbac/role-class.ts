/**
 * Foundation RBAC role-class primitive.
 *
 * Defines the canonical frozen baseline role-class vocabulary.
 * Roles are convenience bundles; permissions, not role names, are authoritative.
 *
 * F-10 implements role-class representation and validation only.
 * It does not implement permissions, role-to-permission bundles, membership,
 * authorization evaluation, business-scope assignment, MFA enforcement,
 * database persistence, or RLS.
 */

/**
 * Canonical frozen baseline role classes.
 *
 * Exactly five role classes:
 * - owner: Organization owner; requires MFA under FB-003
 * - admin: Administrative access; requires MFA under FB-003
 * - manager: Management access
 * - staff: Standard staff access
 * - read_only: Read-only access
 */
export const ROLE_CLASSES = [
  'owner',
  'admin',
  'manager',
  'staff',
  'read_only',
] as const;

/**
 * Union type of canonical role-class values.
 */
export type RoleClass = typeof ROLE_CLASSES[number];

/**
 * Runtime type guard for RoleClass.
 *
 * Accepts exactly the five canonical role-class strings.
 * Rejects arbitrary strings, non-string values, and alternate spellings.
 * Preserves TypeScript type narrowing.
 *
 * @param value - The value to validate
 * @returns True if value is a canonical RoleClass; false otherwise
 */
export function isRoleClass(value: unknown): value is RoleClass {
  return typeof value === 'string' && ROLE_CLASSES.includes(value as RoleClass);
}

/**
 * Validates a value is a canonical RoleClass.
 *
 * Throws if value is not a valid RoleClass.
 * Used for strict validation in application logic.
 *
 * @param value - The value to validate
 * @returns The validated RoleClass
 * @throws Error if value is not a canonical RoleClass
 */
export function validateRoleClass(value: unknown): RoleClass {
  if (!isRoleClass(value)) {
    throw new Error(
      `Invalid role class: ${JSON.stringify(value)}. Expected one of: ${ROLE_CLASSES.join(', ')}`
    );
  }
  return value;
}
