const {
  evaluateProductionGate,
  isFullSha
} = require('../../../../scripts/f43-production-gate');

const REVISION = '1234567890abcdef1234567890abcdef12345678';

function validGate(overrides = {}) {
  return {
    hostedRecoveryValidated: 'true',
    productionDeploymentEnabled: 'true',
    requestedRevision: REVISION,
    ciRevision: REVISION,
    stagingRevision: REVISION,
    recoveryPreflightPassed: true,
    ...overrides
  };
}

describe('F-43 production deployment gate', () => {
  test('accepts only a full immutable git SHA', () => {
    expect(isFullSha(REVISION)).toBe(true);
    expect(isFullSha('main')).toBe(false);
    expect(isFullSha('1234')).toBe(false);
    expect(isFullSha('')).toBe(false);
  });

  test('missing hosted recovery validation denies production', () => {
    expect(
      evaluateProductionGate(validGate({ hostedRecoveryValidated: undefined }))
    ).toEqual({
      allowed: false,
      reason: 'hosted_recovery_not_validated'
    });
  });

  test('false hosted recovery validation denies production', () => {
    expect(
      evaluateProductionGate(validGate({ hostedRecoveryValidated: 'false' }))
    ).toEqual({
      allowed: false,
      reason: 'hosted_recovery_not_validated'
    });
  });

  test('malformed hosted recovery validation denies production', () => {
    expect(
      evaluateProductionGate(validGate({ hostedRecoveryValidated: 'TRUE' }))
    ).toEqual({
      allowed: false,
      reason: 'hosted_recovery_not_validated'
    });
  });

  test('production deployment must be explicitly enabled', () => {
    expect(
      evaluateProductionGate(validGate({ productionDeploymentEnabled: undefined }))
    ).toEqual({
      allowed: false,
      reason: 'production_not_enabled'
    });

    expect(
      evaluateProductionGate(validGate({ productionDeploymentEnabled: 'false' }))
    ).toEqual({
      allowed: false,
      reason: 'production_not_enabled'
    });
  });

  test('invalid requested revision denies production', () => {
    expect(
      evaluateProductionGate(validGate({ requestedRevision: 'main' }))
    ).toEqual({
      allowed: false,
      reason: 'invalid_requested_revision'
    });
  });

  test('missing CI evidence denies production', () => {
    expect(
      evaluateProductionGate(validGate({ ciRevision: undefined }))
    ).toEqual({
      allowed: false,
      reason: 'ci_revision_mismatch'
    });
  });

  test('mismatched CI revision denies production', () => {
    expect(
      evaluateProductionGate(validGate({
        ciRevision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      }))
    ).toEqual({
      allowed: false,
      reason: 'ci_revision_mismatch'
    });
  });

  test('missing staging evidence denies production', () => {
    expect(
      evaluateProductionGate(validGate({ stagingRevision: undefined }))
    ).toEqual({
      allowed: false,
      reason: 'staging_revision_mismatch'
    });
  });

  test('mismatched staging revision denies production', () => {
    expect(
      evaluateProductionGate(validGate({
        stagingRevision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      }))
    ).toEqual({
      allowed: false,
      reason: 'staging_revision_mismatch'
    });
  });

  test('failed recovery preflight denies production', () => {
    expect(
      evaluateProductionGate(validGate({ recoveryPreflightPassed: false }))
    ).toEqual({
      allowed: false,
      reason: 'recovery_preflight_failed'
    });
  });

  test('missing recovery preflight result denies production', () => {
    expect(
      evaluateProductionGate(validGate({ recoveryPreflightPassed: undefined }))
    ).toEqual({
      allowed: false,
      reason: 'recovery_preflight_failed'
    });
  });

  test('valid recovery state advances only when all remaining gates pass', () => {
    expect(evaluateProductionGate(validGate())).toEqual({
      allowed: true,
      reason: 'production_gates_satisfied'
    });
  });

  test('invalid gate input fails closed', () => {
    expect(evaluateProductionGate(null)).toEqual({
      allowed: false,
      reason: 'invalid_gate_input'
    });
  });
});
