import {
  RECOVERY_OBJECTIVE_KINDS,
  isRecoveryObjectiveKind,
  recoveryObjectiveFor,
  type RecoveryObjectiveKind
} from '../../../src/foundation/recovery';

describe('Foundation recovery objectives', () => {
  test('exposes exactly two unique objective kinds and their maximum hours', () => {
    expect(RECOVERY_OBJECTIVE_KINDS).toEqual(['rpo', 'rto']);
    expect(RECOVERY_OBJECTIVE_KINDS).toHaveLength(2);
    expect(new Set(RECOVERY_OBJECTIVE_KINDS).size).toBe(2);
    expect(recoveryObjectiveFor('rpo')).toEqual({ maximumHours: 1 });
    expect(recoveryObjectiveFor('rto')).toEqual({ maximumHours: 4 });
  });

  test('preserves the RPO and RTO maximum semantics', () => {
    expect(recoveryObjectiveFor('rpo').maximumHours).toBe(1);
    expect(recoveryObjectiveFor('rto').maximumHours).toBe(4);
  });

  test('accepts only exact lowercase objective kinds without normalization', () => {
    expect(isRecoveryObjectiveKind('rpo')).toBe(true);
    expect(isRecoveryObjectiveKind('rto')).toBe(true);

    for (const kind of [
      'RPO',
      'RTO',
      'recovery_point',
      'recovery_time',
      'backup',
      'restore'
    ]) {
      expect(isRecoveryObjectiveKind(kind)).toBe(false);
    }
  });

  test('rejects non-string values', () => {
    for (const kind of [null, undefined, 0, false, {}, []]) {
      expect(isRecoveryObjectiveKind(kind)).toBe(false);
    }
  });

  test('round-trips objective kinds and metadata through JSON', () => {
    for (const kind of RECOVERY_OBJECTIVE_KINDS) {
      const parsedKind: unknown = JSON.parse(JSON.stringify(kind));
      const parsedMetadata: unknown = JSON.parse(
        JSON.stringify(recoveryObjectiveFor(kind))
      );

      expect(parsedKind).toBe(kind);
      expect(isRecoveryObjectiveKind(parsedKind)).toBe(true);
      expect(parsedMetadata).toEqual(recoveryObjectiveFor(kind));
    }
  });

  test('returns immutable read-only metadata', () => {
    const rpo = recoveryObjectiveFor('rpo');
    const rto = recoveryObjectiveFor('rto');
    const kinds: RecoveryObjectiveKind[] = ['rpo', 'rto'];

    expect(Object.isFrozen(rpo)).toBe(true);
    expect(Object.isFrozen(rto)).toBe(true);
    expect(Object.keys(rpo)).toEqual(['maximumHours']);
    expect(Object.keys(rto)).toEqual(['maximumHours']);
    expect(kinds).toHaveLength(2);
    expect(() => {
      (rpo as { maximumHours: number }).maximumHours = 0;
    }).toThrow();
    expect(recoveryObjectiveFor('rpo')).toEqual({ maximumHours: 1 });
  });
});