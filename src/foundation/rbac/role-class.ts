export const ROLE_CLASSES = ['owner', 'admin', 'manager', 'staff', 'read_only'] as const;

export type RoleClass = typeof ROLE_CLASSES[number];

export function isRoleClass(value: unknown): value is RoleClass {
  return typeof value === 'string' && (ROLE_CLASSES as readonly string[]).includes(value);
}

export default {
  ROLE_CLASSES,
  isRoleClass
};
