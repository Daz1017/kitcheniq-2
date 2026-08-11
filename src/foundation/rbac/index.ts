/**
 * Foundation RBAC primitives.
 *
 * Exports the frozen baseline role-class vocabulary and validation.
 * Scoped RBAC is the controlling architecture.
 * Roles are convenience permission bundles.
 * Permissions, not role names, are authoritative.
 */

export { ROLE_CLASSES, isRoleClass, validateRoleClass } from './role-class';
export type { RoleClass } from './role-class';
