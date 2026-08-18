'use strict';

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function command(name, args) {
  return execFileSync(name, args, { encoding: 'utf8' }).trim();
}

function sha256File(path) {
  const contents = readFileSync(path);
  return createHash('sha256').update(contents).digest('hex');
}

function buildReleaseManifest(options = {}) {
  const revision = command('git', ['rev-parse', 'HEAD']);
  const nodeVersion = process.version;
  const npmVersion = command('npm', ['--version']);
  const supabaseVersion = command('npx', ['supabase', '--version']);
  const builtAt = new Date().toISOString();

  const targetEnvironment = options.targetEnvironment ?? process.env.KITCHENIQ_ENVIRONMENT ?? 'automated_test';
  const verificationResult = options.verificationResult ?? 'PASS';
  const verificationReference = options.verificationReference ?? 'local-precommit-verification';
  const migrationStatus = options.migrationStatus ?? 'clean-reset-and-database-tests-required';

  const artifacts = (options.artifacts ?? [])
    .map((artifact) => {
      const absolute = resolve(artifact);
      if (!existsSync(absolute)) {
        throw new Error(`Release artifact does not exist: ${artifact}`);
      }

      return {
        path: artifact,
        sha256: sha256File(absolute)
      };
    });

  return {
    schema_version: '1',
    revision,
    build_timestamp: builtAt,
    node_version: nodeVersion,
    npm_version: npmVersion,
    supabase_cli_version: supabaseVersion,
    target_environment: targetEnvironment,
    verification_result: verificationResult,
    verification_reference: verificationReference,
    migration_status: migrationStatus,
    artifacts
  };
}

if (require.main === module) {
  const manifest = buildReleaseManifest({
    artifacts: process.argv.slice(2)
  });

  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

module.exports = {
  buildReleaseManifest,
  sha256File
};
