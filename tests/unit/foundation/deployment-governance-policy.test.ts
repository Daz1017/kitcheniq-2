import {
  DEPLOYMENT_GOVERNANCE_POLICY,
  type DeploymentGovernancePolicy
} from '../../../src/foundation/deployment';
import { ENVIRONMENT_CLASSES } from '../../../src/foundation/environment';
import { MIGRATION_GOVERNANCE_POLICY } from '../../../src/foundation/migrations';

describe('Foundation deployment governance policy', () => {
  test('exposes exactly the required governance fields', () => {
    expect(Object.keys(DEPLOYMENT_GOVERNANCE_POLICY)).toEqual([
      'reproducibleArtifactsRequired',
      'artifactRevisionBindingRequired',
      'typecheckRequired',
      'testsRequired',
      'buildRequired',
      'migrationValidationRequired',
      'backwardCompatibleSequencingRequired',
      'stagingBeforeArchitectureOrDatabaseAffectingProductionReleaseRequired',
      'explicitReleaseApprovalRequired',
      'adHocDeveloperProductionDeployProhibited',
      'directProductionDatabaseEditingProhibited'
    ]);
    expect(Object.keys(DEPLOYMENT_GOVERNANCE_POLICY)).toHaveLength(11);
  });

  test('preserves every required deployment governance rule', () => {
    expect(DEPLOYMENT_GOVERNANCE_POLICY).toEqual({
      reproducibleArtifactsRequired: true,
      artifactRevisionBindingRequired: true,
      typecheckRequired: true,
      testsRequired: true,
      buildRequired: true,
      migrationValidationRequired: true,
      backwardCompatibleSequencingRequired: true,
      stagingBeforeArchitectureOrDatabaseAffectingProductionReleaseRequired: true,
      explicitReleaseApprovalRequired: true,
      adHocDeveloperProductionDeployProhibited: true,
      directProductionDatabaseEditingProhibited: true
    });
  });

  test('returns immutable read-only metadata', () => {
    expect(Object.isFrozen(DEPLOYMENT_GOVERNANCE_POLICY)).toBe(true);
    expect(() => {
      (DEPLOYMENT_GOVERNANCE_POLICY as unknown as {
        buildRequired: boolean;
      }).buildRequired = false;
    }).toThrow();
    expect(DEPLOYMENT_GOVERNANCE_POLICY.buildRequired).toBe(true);
  });

  test('round-trips ordinary JSON metadata exactly', () => {
    const parsed: unknown = JSON.parse(
      JSON.stringify(DEPLOYMENT_GOVERNANCE_POLICY)
    );

    expect(parsed).toEqual(DEPLOYMENT_GOVERNANCE_POLICY);
    expect(Object.keys(parsed as object)).toEqual(
      Object.keys(DEPLOYMENT_GOVERNANCE_POLICY)
    );
  });

  test('contains no provider, lifecycle, approval workflow, or rollback fields', () => {
    const policyKeys = Object.keys(DEPLOYMENT_GOVERNANCE_POLICY);
    const deferredFields = [
      'provider',
      'artifactFormat',
      'releaseVersion',
      'status',
      'approvalWorkflow',
      'approver',
      'rollback',
      'rollbackRequired',
      'rollbackWindow',
      'deployment'
    ];

    for (const field of deferredFields) {
      expect(policyKeys).not.toContain(field);
    }
  });

  test('does not alter the F-13 environment or F-31 migration contracts', () => {
    expect(ENVIRONMENT_CLASSES).toEqual([
      'development',
      'automated_test',
      'staging',
      'production'
    ]);
    expect(MIGRATION_GOVERNANCE_POLICY.normalEvolutionStrategy)
      .toBe('forward_only');
    expect(MIGRATION_GOVERNANCE_POLICY.repairStrategies).toEqual([
      'corrective_migration',
      'controlled_restore'
    ]);
  });

  test('supports TypeScript narrowing of the policy type', () => {
    const policy: DeploymentGovernancePolicy = DEPLOYMENT_GOVERNANCE_POLICY;

    expect(policy.reproducibleArtifactsRequired).toBe(true);
    expect(policy.explicitReleaseApprovalRequired).toBe(true);
  });
});