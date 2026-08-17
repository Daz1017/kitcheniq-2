const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const { join } = require('node:path');
const { validateRecoveryPreflight, verifyRecoveryManifest } = require('../dist/foundation/recovery');

const recoveryRoot = join(process.cwd(), '.recovery');
const container = 'supabase_db_kitcheniq-2';
const manifestPath = (setDirectory) => join(setDirectory, 'manifest.json');

function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, { encoding: 'utf8', stdio: options.capture === false ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
}

function docker(args, options = {}) {
  return command('docker', ['exec', ...(options.input ? ['-i'] : []), container, ...args], options);
}

function sql(text, database = 'postgres') {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'], { input: text, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function currentSetDirectory() {
  const entries = existsSync(recoveryRoot)
    ? require('node:fs')
        .readdirSync(recoveryRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

  assert.ok(entries.length > 0, 'No recovery set exists under .recovery/. Run recovery:backup:local first.');

  const validSets = entries.flatMap((entry) => {
    const directory = join(recoveryRoot, entry);
    const path = manifestPath(directory);

    if (!existsSync(path)) {
      return [];
    }

    try {
      const manifest = JSON.parse(readFileSync(path, 'utf8'));
      const createdAt = Date.parse(manifest.created_at);

      if (!Number.isFinite(createdAt)) {
        return [];
      }

      return [{ entry, createdAt }];
    } catch {
      return [];
    }
  });

  const latest = validSets
    .sort((left, right) => left.createdAt - right.createdAt)
    .at(-1);

  assert.ok(latest, 'No valid recovery manifest exists under .recovery/.');
  return join(recoveryRoot, latest.entry);
}

function safeWrite(path, content) {
  writeFileSync(path, content, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

function createFixture() {
  mkdirSync(recoveryRoot, { recursive: true, mode: 0o700 });
  const fixture = { authUserId: randomUUID(), organizationId: randomUUID(), correlationId: randomUUID(), idempotencyKey: `f42-${randomUUID()}` };
  const requestHash = createHash('sha256').update(`{"organizationId":"${fixture.organizationId}"}`, 'utf8').digest('hex');
  const sqlText = `
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('${fixture.authUserId}', 'authenticated', 'authenticated', 'f42-recovery-${fixture.authUserId}@example.test', '', now());
insert into public.organizations (id) values ('${fixture.organizationId}');
insert into private.role_permissions (role_class, permission_id) values ('manager', 'foundation.location.create') on conflict do nothing;
insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
values ((select id from private.application_users where auth_principal_id = '${fixture.authUserId}'), 'manager', 'organization', '${fixture.organizationId}');
select (public.create_location_idempotent(
  '${fixture.authUserId}',
  (select id from private.application_users where auth_principal_id = '${fixture.authUserId}'),
  'aal1', '${fixture.organizationId}', '${fixture.idempotencyKey}', '${requestHash}', '${fixture.correlationId}'
))->>'locationId';
select private.append_operational_log('info', '${fixture.correlationId}', 'automated_test', 'f42.recovery.fixture', 'Synthetic recovery fixture', null, null, null, null, '{"fixture":"synthetic"}'::jsonb);
`;
  const locationId = sql(sqlText).split('\n').at(-2);
  assert.match(locationId, /^[0-9a-f-]{36}$/);
  fixture.locationId = locationId;
  fixture.createdAt = new Date().toISOString();
  safeWrite(join(recoveryRoot, 'fixture.json'), `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(JSON.stringify({ fixture: 'PASS', locationId, organizationId: fixture.organizationId }, null, 2));
}

function collectArtifact(setDirectory, name, producer) {
  const path = join(setDirectory, name);
  const output = producer();
  safeWrite(path, output);
  const stats = require('node:fs').statSync(path);
  return { name, sizeBytes: stats.size, sha256: createHash('sha256').update(output).digest('hex'), required: true };
}

function backup() {
  mkdirSync(recoveryRoot, { recursive: true, mode: 0o700 });
  const backupSetId = randomUUID();
  const setDirectory = join(recoveryRoot, backupSetId);
  mkdirSync(setDirectory, { recursive: true, mode: 0o700 });
  const sourceRevision = command('git', ['rev-parse', 'HEAD']).trim();
  const databaseVersion = docker(['psql', '-U', 'postgres', '-Atc', 'select version();']).trim();
  const backupToolVersion = docker(['pg_dump', '--version']).trim();
  const artifacts = [
    collectArtifact(setDirectory, 'roles.sql', () => docker(['pg_dumpall', '-U', 'postgres', '--roles-only'])),
    collectArtifact(setDirectory, 'schema.sql', () => docker(['pg_dump', '-U', 'postgres', '--schema-only', '--no-owner', '--no-privileges', '-n', 'public', '-n', 'private', '-n', 'foundation', '-n', 'auth', '-n', 'supabase_migrations', '-n', 'extensions', 'postgres'])),
    collectArtifact(setDirectory, 'data.sql', () => docker(['pg_dump', '-U', 'postgres', '--data-only', '--no-owner', '--no-privileges', '-n', 'public', '-n', 'private', '-n', 'foundation', '-n', 'auth', '-n', 'supabase_migrations', '-n', 'extensions', 'postgres']))
  ];
  const manifest = {
    backup_set_id: backupSetId,
    created_at: new Date().toISOString(),
    source_environment: process.env.KITCHENIQ_ENVIRONMENT || 'local',
    source_revision: sourceRevision,
    backup_tool_version: backupToolVersion,
    database_version: databaseVersion,
    artifacts,
    backup_method: 'logical_postgresql_dump'
  };
  safeWrite(manifestPath(setDirectory), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ backup: 'PASS', backupSetId, artifacts: artifacts.map(({ name, sizeBytes, sha256 }) => ({ name, sizeBytes, sha256 })) }, null, 2));
}

function verify() {
  const setDirectory = currentSetDirectory();
  const manifest = JSON.parse(readFileSync(manifestPath(setDirectory), 'utf8'));
  verifyRecoveryManifest(manifest, setDirectory);
  console.log(JSON.stringify({ verify: 'PASS', backupSetId: manifest.backup_set_id, artifactCount: manifest.artifacts.length }, null, 2));
}

function isolatedSchemaDump(contents) {
  return contents
    .replace(/\nCREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;\n/, '\n')
    .replace(/\nCOMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';\n/, '\n')
    .replace(/\nCREATE SCHEMA public;\n/, '\n')
    .replace(/\nCREATE SCHEMA extensions;\n/, '\n')
    .replace(/\n    SET log_min_messages TO 'fatal'\n/g, '\n');
}

function isolatedDataDump(contents) {
  return contents.replace(/--\n-- Data for Name: [^\n]+; Type: TABLE DATA; Schema: cron; Owner: -\n--\n[\s\S]*?\\\.\n/g, '');
}

function restoreTest() {
  const setDirectory = currentSetDirectory();
  let target;
  let cleanupRequired = false;

  currentStage = 'manifest_verification';
  const manifest = JSON.parse(readFileSync(manifestPath(setDirectory), 'utf8'));
  verifyRecoveryManifest(manifest, setDirectory);

  const fixture = JSON.parse(readFileSync(join(recoveryRoot, 'fixture.json'), 'utf8'));
  target = `f42_recovery_${manifest.backup_set_id.replaceAll('-', '').slice(0, 20)}`;
  const startedAt = new Date();

  try {
    currentStage = 'database_creation';
    sql(`drop database if exists ${target}; create database ${target};`);
    cleanupRequired = true;

    currentStage = 'schema_restore';
    const isolatedSchema = `create schema if not exists extensions;\ncreate extension if not exists pgcrypto with schema extensions;\ncreate extension if not exists "uuid-ossp" with schema extensions;\n${isolatedSchemaDump(readFileSync(join(setDirectory, 'schema.sql'), 'utf8'))}`;
    const schemaResult = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', target, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: isolatedSchema, encoding: 'utf8' });
    if (schemaResult.status !== 0) throw new Error('Isolated schema restore failed.');

    currentStage = 'data_restore';
    const isolatedData = `SET session_replication_role = replica;\n${isolatedDataDump(readFileSync(join(setDirectory, 'data.sql'), 'utf8'))}\nSET session_replication_role = origin;\n`;
    const dataResult = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', target, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: isolatedData, encoding: 'utf8' });
    if (dataResult.status !== 0) throw new Error('Isolated data restore failed.');

    currentStage = 'state_validation';
    const validation = sql(`
select 'schemas' where exists (select 1 from pg_namespace where nspname = 'foundation') and exists (select 1 from pg_namespace where nspname = 'private') and exists (select 1 from pg_namespace where nspname = 'auth');
select 'migration_history' where exists (select 1 from pg_tables where schemaname = 'supabase_migrations' and tablename = 'schema_migrations');
select 'application_user' where exists (select 1 from private.application_users where auth_principal_id = '${fixture.authUserId}');
select 'organization_location' where exists (select 1 from public.organizations where id = '${fixture.organizationId}') and exists (select 1 from public.locations where id = '${fixture.locationId}');
select 'security' where exists (select 1 from pg_policies where schemaname = 'public') and exists (select 1 from private.role_assignments where organization_id = '${fixture.organizationId}');
select 'audit' where exists (select 1 from private.audit_records where correlation_id = '${fixture.correlationId}');
select 'idempotency_event_outbox' where exists (select 1 from private.idempotency_records where organization_id = '${fixture.organizationId}') and exists (select 1 from private.event_records where correlation_id = '${fixture.correlationId}') and exists (select 1 from private.event_outbox where event_id in (select id from private.event_records where correlation_id = '${fixture.correlationId}'));
select 'operational_log' where exists (select 1 from private.operational_logs where correlation_id = '${fixture.correlationId}');
select 'numeric_domains' where exists (select 1 from pg_type where typnamespace = 'foundation'::regnamespace and typname = 'monetary_total_amount');
select 'audit_immutability' where exists (select 1 from pg_trigger where tgrelid = 'private.audit_records'::regclass and tgname = 'audit_records_immutable');
select 'event_immutability' where exists (select 1 from pg_trigger where tgrelid = 'private.event_records'::regclass and tgname = 'event_records_immutable');
select 'operational_log_protection' where not has_table_privilege('authenticated', 'private.operational_logs', 'SELECT') and exists (select 1 from pg_proc where pronamespace = 'private'::regnamespace and proname = 'append_operational_log');
`, target).split('\n').filter(Boolean);

    const required = ['schemas', 'migration_history', 'application_user', 'organization_location', 'security', 'audit', 'idempotency_event_outbox', 'operational_log', 'numeric_domains', 'audit_immutability', 'event_immutability', 'operational_log_protection'];
    assert.deepEqual(validation.sort(), required.sort());

    const completedAt = new Date();
    const exercise = {
      exercise_id: randomUUID(),
      performed_at: completedAt.toISOString(),
      source_backup_set: manifest.backup_set_id,
      restore_target: target,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      elapsed_seconds: (completedAt - startedAt) / 1000,
      validation_result: 'PASS',
      validated_requirements: required,
      operator_evidence_reference: 'local-container-isolated-database',
      evidence_level: 'local_tooling_validation'
    };

    safeWrite(join(setDirectory, 'restore-exercise.json'), `${JSON.stringify(exercise, null, 2)}\n`);

    console.log(JSON.stringify({
      restore: 'PASS',
      evidenceLevel: exercise.evidence_level,
      restoreTarget: target,
      elapsedSeconds: exercise.elapsed_seconds,
      backupSizeBytes: manifest.artifacts.reduce((total, artifact) => total + artifact.sizeBytes, 0),
      validatedRequirements: required
    }, null, 2));
  } finally {
    if (cleanupRequired && target) {
      currentStage = 'cleanup';
      sql(`drop database if exists ${target};`);
      cleanupRequired = false;
    }
  }
}

function preflight() {
  const evidencePath = process.argv[3];
  assert.ok(evidencePath, 'Usage: recovery:preflight <evidence.json>');
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  validateRecoveryPreflight(evidence);
  console.log(JSON.stringify({ preflight: 'PASS', evidenceReference: evidence.evidence_reference }, null, 2));
}

function exercise() {
  currentStage = 'fixture_creation';
  createFixture();

  currentStage = 'backup';
  backup();

  restoreTest();
}

let currentStage = 'startup';

const action = process.argv[2];
try {
  if (action === 'fixture') createFixture();
  else if (action === 'backup') backup();
  else if (action === 'verify') verify();
  else if (action === 'restore-test') restoreTest();
  else if (action === 'preflight') preflight();
  else if (action === 'exercise') exercise();
  else throw new Error('Usage: f42-recovery.js <fixture|backup|verify|restore-test|preflight|exercise>');
} catch (error) {
  console.error(JSON.stringify({
    recovery: 'FAIL',
    severity: 'error',
    health_signal: 'backup_failure',
    component: 'foundation.recovery_tooling',
    stage: currentStage,
    errorType: error instanceof Error ? error.name : 'UnknownError',
    message: 'Recovery operation failed.'
  }));
  process.exitCode = 1;
}
