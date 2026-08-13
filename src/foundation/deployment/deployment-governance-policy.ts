export type DeploymentGovernancePolicy = Readonly<{
  reproducibleArtifactsRequired: true;
  artifactRevisionBindingRequired: true;
  typecheckRequired: true;
  testsRequired: true;
  buildRequired: true;
  migrationValidationRequired: true;
  backwardCompatibleSequencingRequired: true;
  stagingBeforeArchitectureOrDatabaseAffectingProductionReleaseRequired: true;
  explicitReleaseApprovalRequired: true;
  adHocDeveloperProductionDeployProhibited: true;
  directProductionDatabaseEditingProhibited: true;
}>;

export const DEPLOYMENT_GOVERNANCE_POLICY: DeploymentGovernancePolicy =
  Object.freeze({
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