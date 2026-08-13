export type BackupRecoveryPolicy = Readonly<{
  managedEncryptedBackupRequired: true;
  pointInTimeRecoveryOrEquivalentRequired: true;
  rollingRetentionDays: 30;
  preHighRiskMigrationRecoveryPointRequired: true;
  restoreExerciseCadence: 'quarterly';
}>;

export const BACKUP_RECOVERY_POLICY: BackupRecoveryPolicy = Object.freeze({
  managedEncryptedBackupRequired: true,
  pointInTimeRecoveryOrEquivalentRequired: true,
  rollingRetentionDays: 30,
  preHighRiskMigrationRecoveryPointRequired: true,
  restoreExerciseCadence: 'quarterly'
});