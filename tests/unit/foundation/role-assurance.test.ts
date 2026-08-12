import { AUTH_ASSURANCE_LEVELS, requiredAssuranceForRole, roleRequiresAal2 } from '../../../src/foundation/auth-assurance/role-assurance';
import { ROLE_CLASSES } from '../../../src/foundation/rbac/role-class';

describe('Role assurance policy (F-11)', () => {
  test('AUTH_ASSURANCE_LEVELS exactly equals ["aal1","aal2"] with no duplicates', () => {
    expect(AUTH_ASSURANCE_LEVELS).toEqual(['aal1', 'aal2']);
    expect(AUTH_ASSURANCE_LEVELS.length).toBe(2);
    const unique = new Set(AUTH_ASSURANCE_LEVELS as readonly string[]);
    expect(unique.size).toBe(2);
  });

  test('requiredAssuranceForRole maps roles as specified', () => {
    expect(requiredAssuranceForRole('owner')).toBe('aal2');
    expect(requiredAssuranceForRole('admin')).toBe('aal2');
    expect(requiredAssuranceForRole('manager')).toBe('aal1');
    expect(requiredAssuranceForRole('staff')).toBe('aal1');
    expect(requiredAssuranceForRole('read_only')).toBe('aal1');
  });

  test('roleRequiresAal2 derives from authoritative mapping', () => {
    expect(roleRequiresAal2('owner')).toBe(true);
    expect(roleRequiresAal2('admin')).toBe(true);
    expect(roleRequiresAal2('manager')).toBe(false);
    expect(roleRequiresAal2('staff')).toBe(false);
    expect(roleRequiresAal2('read_only')).toBe(false);
  });

  test('all ROLE_CLASSES are covered (no cast) and assurance values serialize/deserialize', () => {
    for (const r of ROLE_CLASSES) {
      // Call requiredAssuranceForRole without cast to preserve compile-time connection
      const lvl = requiredAssuranceForRole(r);
      expect(['aal1', 'aal2']).toContain(lvl);
    }

    // Assurance serialization round-trip
    for (const a of AUTH_ASSURANCE_LEVELS) {
      const json = JSON.stringify({ assurance: a });
      const parsed = JSON.parse(json);
      expect(typeof parsed.assurance).toBe('string');
      expect(parsed.assurance).toBe(a);
    }
  });
});
