import {
  MIGRATION_GOVERNANCE_POLICY,
  type MigrationGovernancePolicy
} from '../../../src/foundation/migrations';

describe('Foundation migration governance policy', () => {
  test('exposes exactly the frozen governance policy shape', () => {
    expect(Object.keys(MIGRATION_GOVERNANCE_POLICY)).toEqual([
      'sourceControlledRequired',
      'orderedRequired',
      'appliedToSharedEnvironmentImmutable',
      'normalEvolutionStrategy',
      'repairStrategies',
      'dataMigrationRestartableIdempotentWherePractical',
      'highRiskDestructiveRequiresValidatedBackupRecovery',
      'highRiskDestructiveRequiresCompatibilityPlanning',
      'highRiskDestructiveRequiresControlledPromotion',
      'legacyProductionDestructiveInPlaceTransformationProhibited'
    ]);
    expect(Object.keys(MIGRATION_GOVERNANCE_POLICY)).toHaveLength(10);
  });

  test('preserves every required governance rule', () => {
    expect(MIGRATION_GOVERNANCE_POLICY).toEqual({
      sourceControlledRequired: true,
      orderedRequired: true,
      appliedToSharedEnvironmentImmutable: true,
      normalEvolutionStrategy: 'forward_only',
      repairStrategies: [
        'corrective_migration',
        'controlled_restore'
      ],
      dataMigrationRestartableIdempotentWherePractical: true,
      highRiskDestructiveRequiresValidatedBackupRecovery: true,
      highRiskDestructiveRequiresCompatibilityPlanning: true,
      highRiskDestructiveRequiresControlledPromotion: true,
      legacyProductionDestructiveInPlaceTransformationProhibited: true
    });
  });

  test('keeps evolution and repair strategies exact', () => {
    expect(MIGRATION_GOVERNANCE_POLICY.normalEvolutionStrategy)
      .toBe('forward_only');
    expect(MIGRATION_GOVERNANCE_POLICY.repairStrategies).toEqual([
      'corrective_migration',
      'controlled_restore'
    ]);
    expect(MIGRATION_GOVERNANCE_POLICY.repairStrategies).toHaveLength(2);

    for (const strategy of [
      'rollback_first',
      'down_migration',
      'editable_history',
      'reset_and_reapply'
    ]) {
      expect(MIGRATION_GOVERNANCE_POLICY.repairStrategies).not.toContain(strategy);
    }
  });

  test('retains the where-practical restartability qualifier', () => {
    expect(
      MIGRATION_GOVERNANCE_POLICY.dataMigrationRestartableIdempotentWherePractical
    ).toBe(true);
    expect(Object.keys(MIGRATION_GOVERNANCE_POLICY)).toContain(
      'dataMigrationRestartableIdempotentWherePractical'
    );
  });

  test('requires all three high-risk destructive controls and legacy protection', () => {
    expect(MIGRATION_GOVERNANCE_POLICY.highRiskDestructiveRequiresValidatedBackupRecovery)
      .toBe(true);
    expect(MIGRATION_GOVERNANCE_POLICY.highRiskDestructiveRequiresCompatibilityPlanning)
      .toBe(true);
    expect(MIGRATION_GOVERNANCE_POLICY.highRiskDestructiveRequiresControlledPromotion)
      .toBe(true);
    expect(MIGRATION_GOVERNANCE_POLICY.legacyProductionDestructiveInPlaceTransformationProhibited)
      .toBe(true);
  });

  test('returns immutable read-only metadata', () => {
    expect(Object.isFrozen(MIGRATION_GOVERNANCE_POLICY)).toBe(true);
    expect(Object.isFrozen(MIGRATION_GOVERNANCE_POLICY.repairStrategies)).toBe(true);
    expect(() => {
      (MIGRATION_GOVERNANCE_POLICY as unknown as {
        normalEvolutionStrategy: string;
      }).normalEvolutionStrategy = 'down_migration';
    }).toThrow();
    expect(() => {
      (MIGRATION_GOVERNANCE_POLICY.repairStrategies as unknown as string[])[0]
        = 'rollback_first';
    }).toThrow();
    expect(MIGRATION_GOVERNANCE_POLICY.normalEvolutionStrategy)
      .toBe('forward_only');
  });

  test('round-trips ordinary JSON metadata without execution state', () => {
    const parsed: unknown = JSON.parse(
      JSON.stringify(MIGRATION_GOVERNANCE_POLICY)
    );

    expect(parsed).toEqual(MIGRATION_GOVERNANCE_POLICY);
    expect(Object.keys(parsed as object)).toEqual(
      Object.keys(MIGRATION_GOVERNANCE_POLICY)
    );
    for (const field of [
      'status',
      'appliedAt',
      'migrationId',
      'rollback',
      'sql'
    ]) {
      expect(Object.keys(parsed as object)).not.toContain(field);
    }
  });

  test('supports TypeScript narrowing of the immutable policy type', () => {
    const policy: MigrationGovernancePolicy = MIGRATION_GOVERNANCE_POLICY;

    expect(policy.sourceControlledRequired).toBe(true);
    expect(policy.repairStrategies[0]).toBe('corrective_migration');
  });
});