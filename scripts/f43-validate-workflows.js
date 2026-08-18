'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertFullShaActions(contents, label) {
  const refs = [...contents.matchAll(/uses:\s*([^\s@]+)@([^\s]+)/g)];

  assert.ok(refs.length > 0, `${label} must use explicit external actions.`);

  for (const [, action, revision] of refs) {
    assert.match(
      revision,
      /^[0-9a-f]{40}$/,
      `${label}: ${action} must be pinned to a full commit SHA.`
    );
  }
}

const ci = read('.github/workflows/foundation-ci.yml');
const staging = read('.github/workflows/deploy-staging.yml');
const production = read('.github/workflows/deploy-production.yml');

assert.match(ci, /KITCHENIQ_ENVIRONMENT:\s*automated_test/);
assert.match(ci, /pull_request:/);
assert.match(ci, /push:/);
assert.match(ci, /workflow_dispatch:/);
assert.doesNotMatch(ci, /pull_request_target:/);
assert.doesNotMatch(ci, /\$\{\{\s*secrets\./);
assert.match(ci, /permissions:\s*\n\s*contents:\s*read/);
assert.match(ci, /npx supabase db reset/);
assert.match(ci, /npx supabase test db/);
assert.match(ci, /npm run recovery:exercise:local/);
assert.match(ci, /git diff --check/);
assert.match(ci, /git status --porcelain/);

assert.match(staging, /workflow_dispatch:/);
assert.doesNotMatch(staging, /pull_request:/);
assert.doesNotMatch(staging, /pull_request_target:/);
assert.match(staging, /environment:\s*staging/);
assert.match(staging, /KITCHENIQ_ENVIRONMENT:\s*staging/);
assert.match(staging, /TARGET_REVISION:\s*\$\{\{\s*inputs\.revision\s*\}\}/);
assert.match(staging, /head_sha=\$\{TARGET_REVISION\}/);
assert.match(staging, /group:\s*kitcheniq-deploy-staging/);
assert.match(staging, /cancel-in-progress:\s*false/);

assert.match(production, /workflow_dispatch:/);
assert.doesNotMatch(production, /pull_request:/);
assert.doesNotMatch(production, /pull_request_target:/);
assert.doesNotMatch(production, /^\s*push:/m);
assert.match(production, /environment:\s*production/);
assert.match(production, /KITCHENIQ_ENVIRONMENT:\s*production/);
assert.match(
  production,
  /KITCHENIQ_HOSTED_RECOVERY_VALIDATED:\s*\$\{\{\s*vars\.KITCHENIQ_HOSTED_RECOVERY_VALIDATED\s*\}\}/
);
assert.match(production, /!=\s*"true"/);
assert.match(production, /npm run recovery:preflight/);
assert.match(production, /environment=staging/);
assert.match(production, /TARGET_REVISION:\s*\$\{\{\s*inputs\.revision\s*\}\}/);
assert.match(production, /head_sha=\$\{TARGET_REVISION\}/);
assert.match(production, /group:\s*kitcheniq-deploy-production/);
assert.match(production, /cancel-in-progress:\s*false/);

for (const [label, contents] of [
  ['Foundation CI', ci],
  ['Staging deployment', staging],
  ['Production deployment', production]
]) {
  assertFullShaActions(contents, label);

  assert.doesNotMatch(contents, /uses:\s*[^\s]+@(main|master|latest)\b/);
  assert.doesNotMatch(contents, /contents:\s*write/);
  assert.doesNotMatch(contents, /packages:\s*write/);
  assert.doesNotMatch(contents, /pull-requests:\s*write/);
  assert.doesNotMatch(contents, /id-token:\s*write/);
}

assert.notEqual(
  staging.match(/group:\s*(\S+)/)?.[1],
  production.match(/group:\s*(\S+)/)?.[1],
  'Staging and production must use separate concurrency groups.'
);

console.log(JSON.stringify({
  workflowSafety: 'PASS',
  ciEnvironment: 'automated_test',
  prDeployment: 'DENIED',
  automaticProductionDeployment: 'DENIED',
  hostedRecoveryGate: 'REQUIRED',
  recoveryPreflight: 'REQUIRED',
  stagingRevisionMatch: 'REQUIRED',
  actionPinning: 'FULL_SHA',
  tokenPermissions: 'MINIMIZED',
  deploymentConcurrency: 'SEPARATED'
}, null, 2));
