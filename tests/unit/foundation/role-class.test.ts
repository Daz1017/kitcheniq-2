/**
 * Foundation RBAC role-class validation tests.
 *
 * Verifies:
 * - Exact canonical role-class acceptance
 * - Closed role set enforcement
 * - Invalid role rejection
 * - Non-string value rejection
 * - Type guard behavior
 * - Serialization
 * - Absence of unauthorized hierarchy/permission logic
 */

import { ROLE_CLASSES, isRoleClass, validateRoleClass, RoleClass } from '../../../src/foundation/rbac';

describe('Foundation RBAC role-class primitive', () => {
  describe('canonical role classes', () => {
    test('exports exactly five role classes', () => {
      expect(ROLE_CLASSES).toHaveLength(5);
    });

    test('contains no duplicate role classes', () => {
      const unique = new Set(ROLE_CLASSES);
      expect(unique.size).toBe(ROLE_CLASSES.length);
    });

    test('canonical roles are owner, admin, manager, staff, read_only', () => {
      expect(ROLE_CLASSES).toEqual(['owner', 'admin', 'manager', 'staff', 'read_only']);
    });
  });

  describe('isRoleClass type guard', () => {
    test('accepts each canonical role', () => {
      ROLE_CLASSES.forEach(role => {
        expect(isRoleClass(role)).toBe(true);
      });
    });

    test('rejects invalid role strings', () => {
      const invalid = [
        '',
        'Owner',
        'ADMIN',
        'Administrator',
        'Super',
        'admin_role',
        'super_admin',
        'chef',
        'cook',
        'server',
        'bartender',
        'accountant',
        'viewer',
        'guest',
        'employee',
        'operator',
        'system',
        'service',
        'readonly',
        'read-only',
        'READ_ONLY',
        'read only',
      ];

      invalid.forEach(value => {
        expect(isRoleClass(value)).toBe(false);
      });
    });

    test('rejects non-string values', () => {
      expect(isRoleClass(null)).toBe(false);
      expect(isRoleClass(undefined)).toBe(false);
      expect(isRoleClass(0)).toBe(false);
      expect(isRoleClass(false)).toBe(false);
      expect(isRoleClass({})).toBe(false);
      expect(isRoleClass([])).toBe(false);
      expect(isRoleClass(() => {})).toBe(false);
    });

    test('preserves type narrowing', () => {
      const value: unknown = 'admin';
      if (isRoleClass(value)) {
        // TypeScript should narrow to RoleClass here
        const narrowed: RoleClass = value;
        expect(narrowed).toBe('admin');
      }
    });
  });

  describe('validateRoleClass', () => {
    test('accepts each canonical role', () => {
      ROLE_CLASSES.forEach(role => {
        expect(validateRoleClass(role)).toBe(role);
      });
    });

    test('throws on invalid role string', () => {
      expect(() => validateRoleClass('invalid')).toThrow();
      expect(() => validateRoleClass('Owner')).toThrow();
      expect(() => validateRoleClass('ADMIN')).toThrow();
      expect(() => validateRoleClass('super_admin')).toThrow();
    });

    test('throws on non-string values', () => {
      expect(() => validateRoleClass(null)).toThrow();
      expect(() => validateRoleClass(undefined)).toThrow();
      expect(() => validateRoleClass(0)).toThrow();
      expect(() => validateRoleClass(false)).toThrow();
      expect(() => validateRoleClass({})).toThrow();
      expect(() => validateRoleClass([])).toThrow();
    });

    test('error message includes invalid value and canonical options', () => {
      try {
        validateRoleClass('invalid_role');
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('invalid_role');
        expect(e.message).toContain('owner');
        expect(e.message).toContain('admin');
        expect(e.message).toContain('manager');
        expect(e.message).toContain('staff');
        expect(e.message).toContain('read_only');
      }
    });
  });

  describe('serialization', () => {
    test('role classes survive JSON round-trip as ordinary strings', () => {
      ROLE_CLASSES.forEach(role => {
        const serialized = JSON.stringify({ role });
        const deserialized = JSON.parse(serialized);
        expect(deserialized.role).toBe(role);
        expect(isRoleClass(deserialized.role)).toBe(true);
      });
    });

    test('role classes in arrays survive JSON round-trip', () => {
      const roles: RoleClass[] = ['owner', 'admin', 'staff'];
      const serialized = JSON.stringify(roles);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toEqual(roles);
      deserialized.forEach((role: unknown) => {
        expect(isRoleClass(role)).toBe(true);
      });
    });
  });

  describe('no unauthorized hierarchy or permission logic', () => {
    test('exports do not include rank, priority, or hierarchy functions', () => {
      const roleClassModule = require('../../../src/foundation/rbac');
      expect(roleClassModule.roleRank).toBeUndefined();
      expect(roleClassModule.isHigherRole).toBeUndefined();
      expect(roleClassModule.inheritsRole).toBeUndefined();
      expect(roleClassModule.getRolePermissions).toBeUndefined();
      expect(roleClassModule.hasPermission).toBeUndefined();
      expect(roleClassModule.canAccess).toBeUndefined();
      expect(roleClassModule.authorize).toBeUndefined();
    });

    test('ROLE_CLASSES does not contain priority or hierarchy metadata', () => {
      ROLE_CLASSES.forEach(role => {
        expect(typeof role).toBe('string');
        // Ensure no role is an object with hidden properties
        expect(Object.keys(role)).toEqual([]);
      });
    });
  });

  describe('closed set enforcement', () => {
    test('no extra roles beyond the five canonical classes', () => {
      const extraRoles = [
        'super_admin',
        'Chef',
        'cook',
        'server',
        'bartender',
        'accountant',
        'viewer',
        'guest',
        'employee',
        'operator',
        'system',
        'service',
      ];

      extraRoles.forEach(role => {
        expect(ROLE_CLASSES.includes(role as any)).toBe(false);
      });
    });
  });
});
