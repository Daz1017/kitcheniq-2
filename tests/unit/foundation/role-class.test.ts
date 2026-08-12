import { ROLE_CLASSES, isRoleClass, RoleClass } from '../../../src/foundation/rbac/role-class';

describe('RoleClass primitive', () => {
  test('ROLE_CLASSES has exactly five canonical entries and no duplicates', () => {
    expect(ROLE_CLASSES.length).toBe(5);
    const unique = new Set(ROLE_CLASSES);
    expect(unique.size).toBe(5);
    expect(ROLE_CLASSES).toEqual([
      'owner',
      'admin',
      'manager',
      'staff',
      'read_only'
    ]);
  });

  test('isRoleClass accepts every canonical role', () => {
    for (const r of ROLE_CLASSES) {
      expect(isRoleClass(r)).toBe(true);
    }
  });

  test('isRoleClass rejects common non-canonical or malformed values', () => {
    const rejects = [
      '',
      'Owner',
      'ADMIN',
      'administrator',
      'super_admin',
      'chef',
      'viewer',
      'read-only',
      'readonly',
      'READ_ONLY',
      'read only'
    ];
    for (const v of rejects) {
      expect(isRoleClass(v)).toBe(false);
    }
  });

  test('isRoleClass rejects non-string values', () => {
    expect(isRoleClass(null)).toBe(false);
    expect(isRoleClass(undefined)).toBe(false);
    expect(isRoleClass(0)).toBe(false);
    expect(isRoleClass(false)).toBe(false);
    expect(isRoleClass({})).toBe(false);
    expect(isRoleClass([])).toBe(false);
  });

  test('TypeScript narrowing works via isRoleClass', () => {
    const value: unknown = 'manager';
    if (isRoleClass(value)) {
      const narrowed: RoleClass = value;
      expect(narrowed).toBe('manager');
    } else {
      // ensure the test fails if narrowing did not occur
      throw new Error('Narrowing failed for canonical role');
    }
  });

  test('every canonical role survives JSON stringify/parse as an ordinary string', () => {
    for (const r of ROLE_CLASSES) {
      const json = JSON.stringify({ role: r });
      const parsed = JSON.parse(json);
      expect(typeof parsed.role).toBe('string');
      expect(isRoleClass(parsed.role)).toBe(true);
      expect(parsed.role).toBe(r);
    }
  });
});
