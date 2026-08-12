import { PRIVILEGED_OPERATION_CLASSES, isPrivilegedOperationClass, PrivilegedOperationClass } from '../../../src/foundation/privileged-operations/privileged-operation-class';

describe('PrivilegedOperationClass primitive', () => {
  test('PRIVILEGED_OPERATION_CLASSES has exactly eight canonical entries and no duplicates', () => {
    expect(PRIVILEGED_OPERATION_CLASSES.length).toBe(8);
    const unique = new Set(PRIVILEGED_OPERATION_CLASSES);
    expect(unique.size).toBe(8);
    expect(PRIVILEGED_OPERATION_CLASSES).toEqual([
      'permission_change',
      'destructive_operation',
      'bulk_correction',
      'protected_import',
      'sensitive_financial_mutation',
      'security_administration',
      'privileged_override',
      'equivalent_high_impact',
    ]);
  });

  test('isPrivilegedOperationClass accepts every canonical value', () => {
    for (const v of PRIVILEGED_OPERATION_CLASSES) {
      expect(isPrivilegedOperationClass(v)).toBe(true);
    }
  });

  test('isPrivilegedOperationClass rejects common non-canonical or malformed values', () => {
    const rejects = [
      '',
      'permission-change',
      'permission_changes',
      'PermissionChange',
      'destructive',
      'bulk-correction',
      'protected-import',
      'financial_mutation',
      'security_admin',
      'override',
      'high_impact',
    ];
    for (const v of rejects) {
      expect(isPrivilegedOperationClass(v)).toBe(false);
    }
  });

  test('isPrivilegedOperationClass rejects non-string values', () => {
    expect(isPrivilegedOperationClass(null)).toBe(false);
    expect(isPrivilegedOperationClass(undefined)).toBe(false);
    expect(isPrivilegedOperationClass(0)).toBe(false);
    expect(isPrivilegedOperationClass(false)).toBe(false);
    expect(isPrivilegedOperationClass({})).toBe(false);
    expect(isPrivilegedOperationClass([])).toBe(false);
  });

  test('TypeScript narrowing works via isPrivilegedOperationClass', () => {
    const value: unknown = 'destructive_operation';
    if (isPrivilegedOperationClass(value)) {
      const narrowed: PrivilegedOperationClass = value;
      expect(narrowed).toBe('destructive_operation');
    } else {
      throw new Error('Narrowing failed for canonical privileged operation class');
    }
  });

  test('every canonical class survives JSON stringify/parse as an ordinary string', () => {
    for (const c of PRIVILEGED_OPERATION_CLASSES) {
      const json = JSON.stringify({ op: c });
      const parsed = JSON.parse(json);
      expect(typeof parsed.op).toBe('string');
      expect(isPrivilegedOperationClass(parsed.op)).toBe(true);
      expect(parsed.op).toBe(c);
    }
  });
});
