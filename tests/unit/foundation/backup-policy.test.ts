import {
  BACKUP_RECOVERY_POLICY
} from '../../../src/foundation/recovery';
import {
  RECOVERY_OBJECTIVE_KINDS,
  recoveryObjectiveFor
} from '../../../src/foundation/recovery';

describe('Foundation backup and restore policy', () => {
  test('exposes exactly the five approved policy fields', () => {
    expect(Object.keys(BACKUP_RECOVERY_POLICY)).toEqual([
      'managedEncryptedBackupRequired',
      'pointInTimeRecoveryOrEquivalentRequired',
      'rollingRetentionDays',
      'preHighRiskMigrationRecoveryPointRequired',
      'restoreExerciseCadence'
    ]);
    expect(Object.keys(BACKUP_RECOVERY_POLICY)).toHaveLength(5);
  });

  test('preserves every required policy value', () => {
    expect(BACKUP_RECOVERY_POLICY).toEqual({
      managedEncryptedBackupRequired: true,
      pointInTimeRecoveryOrEquivalentRequired: true,
      rollingRetentionDays: 30,
      preHighRiskMigrationRecoveryPointRequired: true,
      restoreExerciseCadence: 'quarterly'
    });
  });

  test('does not expose provider or operational fields', () => {
    const policyKeys = Object.keys(BACKUP_RECOVERY_POLICY);
    const deferredFields = [
      'provider',
      'providerConfiguration',
      'backupSchedule',
      'restoreProcedure',
      'encryptionConfiguration',
      'migrationRiskClassification',
      'complianceEvidence',
      'monitoring'
    ];

    for (const field of deferredFields) {
      expect(policyKeys).not.toContain(field);
    }
  });

  test('returns runtime-immutable read-only metadata', () => {
    expect(Object.isFrozen(BACKUP_RECOVERY_POLICY)).toBe(true);
    expect(() => {
      (BACKUP_RECOVERY_POLICY as unknown as {
        rollingRetentionDays: number;
      }).rollingRetentionDays = 31;
    }).toThrow();
    expect(BACKUP_RECOVERY_POLICY.rollingRetentionDays).toBe(30);
  });

  test('preserves exact metadata through JSON serialization', () => {
    const parsed: unknown = JSON.parse(JSON.stringify(BACKUP_RECOVERY_POLICY));

    expect(parsed).toEqual(BACKUP_RECOVERY_POLICY);
    expect(Object.keys(parsed as object)).toEqual(Object.keys(BACKUP_RECOVERY_POLICY));
  });

  test('keeps retention in days and cadence as the quarterly literal', () => {
    expect(BACKUP_RECOVERY_POLICY.rollingRetentionDays).toBe(30);
    expect(typeof BACKUP_RECOVERY_POLICY.rollingRetentionDays).toBe('number');
    expect(BACKUP_RECOVERY_POLICY.restoreExerciseCadence).toBe('quarterly');
    expect(typeof BACKUP_RECOVERY_POLICY.restoreExerciseCadence).toBe('string');
    expect(BACKUP_RECOVERY_POLICY.restoreExerciseCadence).not.toBe('90 days');
    expect(BACKUP_RECOVERY_POLICY.restoreExerciseCadence).not.toBe('91 days');
  });

  test('preserves the F-27 recovery objective contract', () => {
    expect(RECOVERY_OBJECTIVE_KINDS).toEqual(['rpo', 'rto']);
    expect(recoveryObjectiveFor('rpo')).toEqual({ maximumHours: 1 });
    expect(recoveryObjectiveFor('rto')).toEqual({ maximumHours: 4 });
  });
});