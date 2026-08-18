'use strict';

function isFullSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function evaluateProductionGate(input) {
  if (!input || typeof input !== 'object') {
    return { allowed: false, reason: 'invalid_gate_input' };
  }

  if (input.hostedRecoveryValidated !== 'true') {
    return { allowed: false, reason: 'hosted_recovery_not_validated' };
  }

  if (input.productionDeploymentEnabled !== 'true') {
    return { allowed: false, reason: 'production_not_enabled' };
  }

  if (!isFullSha(input.requestedRevision)) {
    return { allowed: false, reason: 'invalid_requested_revision' };
  }

  if (input.ciRevision !== input.requestedRevision) {
    return { allowed: false, reason: 'ci_revision_mismatch' };
  }

  if (input.stagingRevision !== input.requestedRevision) {
    return { allowed: false, reason: 'staging_revision_mismatch' };
  }

  if (input.recoveryPreflightPassed !== true) {
    return { allowed: false, reason: 'recovery_preflight_failed' };
  }

  return { allowed: true, reason: 'production_gates_satisfied' };
}

module.exports = {
  evaluateProductionGate,
  isFullSha
};
