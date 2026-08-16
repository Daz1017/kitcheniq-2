const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const {
  createLocationWithAudit,
  executeWithFoundationErrorBoundary,
  appendOperationalLog,
  loadSupabaseServerConfig,
  processOutboxBatch,
  runWithCorrelation,
  createSupabaseOperationalLogSink
} = require('../dist/foundation/runtime');
const { createCorrelationId } = require('../dist/foundation/correlation');

process.env.KITCHENIQ_ENVIRONMENT = 'automated_test';

function status() {
  const output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' });
  return Object.fromEntries(output.split('\n').flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^"|"$/g, '')]] : [];
  }));
}

function sql(text) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_kitcheniq-2', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: text, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function searchCount(whereClause) {
  return Number(sql(`select count(*) from private.operational_logs where ${whereClause};`));
}

function makeLocalSink() {
  return async (context) => {
    const details = JSON.stringify(context.details ?? {}).replaceAll("'", "''");
    const result = sql(`select private.append_operational_log('${context.severity}', '${context.correlationId}', '${context.environment}', '${context.component}', '${context.message.replaceAll("'", "''")}', ${context.healthSignal ? `'${context.healthSignal}'` : 'null'}, ${context.errorCode ? `'${context.errorCode}'` : 'null'}, ${context.errorCategory ? `'${context.errorCategory}'` : 'null'}, ${context.retryable == null ? 'null' : context.retryable}, '${details}'::jsonb);`);
    return { id: result, occurred_at: new Date().toISOString(), severity: context.severity, correlation_id: context.correlationId, environment: context.environment, component: context.component, message: context.message, health_signal: context.healthSignal ?? null, error_code: context.errorCode ?? null, error_category: context.errorCategory ?? null, retryable: context.retryable ?? null, details: context.details ?? {} };
  };
}

async function createUser(client, label) {
  const email = `f41-${label}-${Date.now()}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password: 'F41-local-password-123!' });
  assert.equal(error, null, error?.message);
  assert.ok(data.session?.access_token);
  return { accessToken: data.session.access_token, authUserId: data.user.id };
}

async function main() {
  const local = status();
  const publicConfig = { url: local.API_URL, publicKey: local.ANON_KEY };
  const sink = makeLocalSink();
  const serverConfig = loadSupabaseServerConfig({ KITCHENIQ_SUPABASE_URL: publicConfig.url, KITCHENIQ_SUPABASE_PUBLIC_KEY: publicConfig.publicKey, KITCHENIQ_SUPABASE_SECRET_KEY: local.SERVICE_ROLE_KEY, });
  const config = { ...serverConfig, operationalLogSink: sink };
  const publicClient = createClient(publicConfig.url, publicConfig.publicKey);
  const serviceClient = createClient(publicConfig.url, local.SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const user = await createUser(publicClient, 'authorized');
  const denied = await createUser(publicClient, 'denied');
  const identity = sql(`select id from private.application_users where auth_principal_id = '${user.authUserId}'`);
  const deniedIdentity = sql(`select id from private.application_users where auth_principal_id = '${denied.authUserId}'`);
  const organizationId = randomUUID();
  sql(`insert into public.organizations (id) values ('${organizationId}'); insert into private.role_permissions (role_class, permission_id) values ('manager', 'foundation.location.create') on conflict do nothing; insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id) values ('${identity}', 'manager', 'organization', '${organizationId}');`);

  const key = `f41-runtime-create-${Date.now()}`;
  const first = await createLocationWithAudit(user.accessToken, organizationId, key, config);
  const replay = await createLocationWithAudit(user.accessToken, organizationId, key, config);
  assert.equal(replay.locationId, first.locationId);
  assert.equal(replay.replayed, true);
  const authoritative = sql(`select (select count(*) from public.locations where id = '${first.locationId}') || ',' || (select count(*) from private.audit_records where correlation_id = '${first.correlationId}') || ',' || (select count(*) from private.event_records where correlation_id = '${first.correlationId}') || ',' || (select count(*) from private.event_outbox where event_id in (select id from private.event_records where correlation_id = '${first.correlationId}'));`);
  assert.equal(authoritative, '1,1,1,1');
  assert.ok(Number(sql(`select count(*) from private.operational_logs where correlation_id = '${first.correlationId}'`)) >= 1);
  assert.ok(Number(sql(`select count(*) from private.operational_logs where correlation_id = '${replay.correlationId}'`)) >= 1);

  const deniedResult = await executeWithFoundationErrorBoundary(() => createLocationWithAudit(denied.accessToken, organizationId, 'f41-denied', config), { component: 'f41.integration.authorization', sink });
  assert.equal(deniedResult.category, 'authorization');
  assert.ok(deniedResult.correlationId);
  const mismatch = await serviceClient.rpc('create_location_idempotent', { p_auth_principal_id: user.authUserId, p_application_user_id: identity, p_aal: 'aal1', p_organization_id: organizationId, p_idempotency_key: key, p_request_hash: 'b'.repeat(64), p_correlation_id: first.correlationId });
  assert.ok(mismatch.error);
  const unknown = await executeWithFoundationErrorBoundary(() => { throw new Error('raw F41 internal text'); }, { component: 'f41.integration.unknown', sink });
  assert.equal(unknown.code, 'internal.generic');
  assert.equal(unknown.userMessage, 'An internal error occurred.');

  for (const severity of ['debug', 'info', 'warn', 'error']) {
    await sink({ severity, component: 'f41.integration.severity', message: 'severity fixture', correlationId: createCorrelationId(), environment: 'automated_test', details: {} });
  }
  for (const healthSignal of ['error', 'import_failure', 'integration_failure', 'event_backlog', 'job_failure', 'backup_failure']) {
    await runWithCorrelation(createCorrelationId(), () => sink({ severity: 'info', component: 'f41.integration.health', message: 'health fixture', correlationId: createCorrelationId(), environment: 'automated_test', healthSignal, details: {} }));
  }
  assert.ok(searchCount(`correlation_id = '${first.correlationId}'`) >= 1);
  for (const severity of ['debug', 'info', 'warn', 'error']) {
    assert.ok(searchCount(`severity = '${severity}'`) >= 1);
  }
  for (const healthSignal of ['error', 'import_failure', 'integration_failure', 'event_backlog', 'job_failure', 'backup_failure']) {
    assert.ok(searchCount(`health_signal = '${healthSignal}'`) >= 1);
  }

  const failing = await processOutboxBatch(config, () => { throw new Error('handler secret'); }, { batchSize: 1, operationalLogSink: sink }).catch((error) => error);
  assert.ok(failing instanceof Error);
  assert.ok(searchCount("health_signal = 'job_failure' and component = 'foundation.outbox_worker'") >= 1);
  await processOutboxBatch(config, () => undefined, { batchSize: 1, operationalLogSink: sink });

  const redacted = await appendOperationalLog({ severity: 'info', component: 'f41.integration.redaction', message: 'redaction', correlationId: createCorrelationId(), environment: 'automated_test', details: { nested: { token: 'synthetic-secret' } } }, sink);
  assert.equal(redacted.details.nested.token, '[REDACTED]');
  assert.ok(!JSON.stringify(redacted).includes('synthetic-secret'));
  assert.equal(Number(sql(`select count(*) from private.operational_logs where correlation_id = '${redacted.correlation_id}' and details::text like '%synthetic-secret%'`)), 0);

  console.log(JSON.stringify({ createLocation: 'PASS', replay: 'PASS', correlation: 'PASS', safeFailures: 'PASS', search: 'PASS', healthSignals: 'PASS', redaction: 'PASS', outboxFailure: 'PASS', outboxRedelivery: 'PASS', deniedIdentity }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
