import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateRecoveryPreflight,
  verifyRecoveryManifest,
  type RecoveryManifest
} from '../../../../src/foundation/recovery';

const temporaryDirectory = join(process.cwd(), '.recovery-test');

describe('F-42 recovery evidence tooling', () => {
  beforeEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    mkdirSync(temporaryDirectory, { recursive: true });
    writeFileSync(join(temporaryDirectory, 'schema.sql'), 'select 1;\n');
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  test('rejects a missing recovery artifact', () => {
    const manifest = {
      backup_set_id: '123e4567-e89b-42d3-a456-426614174080',
      created_at: '2026-08-17T00:00:00.000Z',
      source_environment: 'automated_test',
      source_revision: 'eac26d21db1515a51f969492aaf7135db81266f3',
      backup_tool_version: 'pg_dump 17.6',
      database_version: 'PostgreSQL 17.6',
      artifacts: [{ name: 'missing.sql', sizeBytes: 1, sha256: 'bad', required: true }],
      backup_method: 'logical_postgresql_dump'
    } satisfies RecoveryManifest;

    expect(() => verifyRecoveryManifest(manifest, temporaryDirectory)).toThrow('missing');
  });

  test('rejects a tampered recovery artifact', () => {
    const manifest = {
      backup_set_id: '123e4567-e89b-42d3-a456-426614174080',
      created_at: '2026-08-17T00:00:00.000Z',
      source_environment: 'automated_test',
      source_revision: 'eac26d21db1515a51f969492aaf7135db81266f3',
      backup_tool_version: 'pg_dump 17.6',
      database_version: 'PostgreSQL 17.6',
      artifacts: [{ name: 'schema.sql', sizeBytes: 10, sha256: 'bad', required: true }],
      backup_method: 'logical_postgresql_dump'
    } satisfies RecoveryManifest;

    expect(() => verifyRecoveryManifest(manifest, temporaryDirectory)).toThrow('mismatch');
  });

  test('accepts active PITR evidence without inventing a provider retention value', () => {
    expect(() => validateRecoveryPreflight({
      recovery_point_type: 'pitr_or_equivalent',
      pitr_or_equivalent_active: true,
      source_environment: 'production',
      evidence_reference: 'hosted-evidence-required'
    })).not.toThrow();
  });

  test('rejects stale discrete recovery evidence beyond one hour', () => {
    expect(() => validateRecoveryPreflight({
      recovery_point_type: 'discrete_backup',
      recovery_point_at: '2026-08-16T22:00:00.000Z',
      source_environment: 'production',
      backup_set_id: '123e4567-e89b-42d3-a456-426614174080',
      evidence_reference: 'synthetic-stale-evidence'
    }, new Date('2026-08-17T00:00:00.000Z'))).toThrow('one-hour');
  });
});