export type MigrationGovernancePolicy = Readonly<{
  sourceControlledRequired: true;
  orderedRequired: true;
  appliedToSharedEnvironmentImmutable: true;
  normalEvolutionStrategy: 'forward_only';
  repairStrategies: readonly [
    'corrective_migration',
    'controlled_restore'
  ];
  dataMigrationRestartableIdempotentWherePractical: true;
  highRiskDestructiveRequiresValidatedBackupRecovery: true;
  highRiskDestructiveRequiresCompatibilityPlanning: true;
  highRiskDestructiveRequiresControlledPromotion: true;
  legacyProductionDestructiveInPlaceTransformationProhibited: true;
}>;

const REPAIR_STRATEGIES: readonly [
  'corrective_migration',
  'controlled_restore'
] = Object.freeze([
  'corrective_migration',
  'controlled_restore'
]);

export const MIGRATION_GOVERNANCE_POLICY: MigrationGovernancePolicy =
  Object.freeze({
    sourceControlledRequired: true,
    orderedRequired: true,
    appliedToSharedEnvironmentImmutable: true,
    normalEvolutionStrategy: 'forward_only',
    repairStrategies: REPAIR_STRATEGIES,
    dataMigrationRestartableIdempotentWherePractical: true,
    highRiskDestructiveRequiresValidatedBackupRecovery: true,
    highRiskDestructiveRequiresCompatibilityPlanning: true,
    highRiskDestructiveRequiresControlledPromotion: true,
    legacyProductionDestructiveInPlaceTransformationProhibited: true
  });