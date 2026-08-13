import {
  AUDIT_RETENTION_PROFILES,
  isAuditRetentionProfile,
  retentionForAuditProfile,
  type AuditRetentionProfile
} from '../../../src/foundation/audit';

describe('Foundation audit retention profiles', () => {
  test('exposes exactly two unique profiles and their retention years', () => {
    expect(AUDIT_RETENTION_PROFILES).toEqual([
      'financial_security',
      'protected_operational'
    ]);
    expect(new Set(AUDIT_RETENTION_PROFILES).size).toBe(2);
    expect(retentionForAuditProfile('financial_security')).toEqual({ years: 7 });
    expect(retentionForAuditProfile('protected_operational')).toEqual({ years: 2 });
  });

  test('profile names remain restricted to the two defined profiles', () => {
    const profiles: AuditRetentionProfile[] = [
      'financial_security',
      'protected_operational'
    ];

    expect(profiles).toHaveLength(2);
  });

  test('rejects invalid aliases without normalization', () => {
    for (const profile of [
      'financial',
      'security',
      'financial-security',
      'protected',
      'operational',
      'audit'
    ]) {
      expect(isAuditRetentionProfile(profile)).toBe(false);
    }
  });

  test('rejects all non-string values', () => {
    for (const profile of [null, undefined, 0, false, {}, []]) {
      expect(isAuditRetentionProfile(profile)).toBe(false);
    }
  });

  test('round-trips both profile names through JSON', () => {
    for (const profile of AUDIT_RETENTION_PROFILES) {
      const parsed: unknown = JSON.parse(JSON.stringify(profile));

      expect(parsed).toBe(profile);
      expect(isAuditRetentionProfile(parsed)).toBe(true);
    }
  });

  test('returns immutable retention metadata without day conversion or expiry calculation', () => {
    const financialSecurity = retentionForAuditProfile('financial_security');
    const protectedOperational = retentionForAuditProfile('protected_operational');

    expect(Object.isFrozen(financialSecurity)).toBe(true);
    expect(Object.isFrozen(protectedOperational)).toBe(true);
    expect(financialSecurity).toEqual({ years: 7 });
    expect(protectedOperational).toEqual({ years: 2 });
    expect(Object.keys(financialSecurity)).toEqual(['years']);
    expect(() => {
      (financialSecurity as { years: number }).years = 1;
    }).toThrow();
    expect(retentionForAuditProfile('financial_security')).toEqual({ years: 7 });
  });
});
