export const PRIVILEGED_OPERATION_CLASSES = [
  'permission_change',
  'destructive_operation',
  'bulk_correction',
  'protected_import',
  'sensitive_financial_mutation',
  'security_administration',
  'privileged_override',
  'equivalent_high_impact',
] as const;

export type PrivilegedOperationClass = (typeof PRIVILEGED_OPERATION_CLASSES)[number];

export function isPrivilegedOperationClass(value: unknown): value is PrivilegedOperationClass {
  return typeof value === 'string' && (PRIVILEGED_OPERATION_CLASSES as readonly string[]).includes(value);
}

export default PRIVILEGED_OPERATION_CLASSES;
