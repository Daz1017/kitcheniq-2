const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const { createIdempotencyKey } = require('../dist/foundation/idempotency');
const {
  createLocationWithAudit,
  loadSupabaseServerConfig,
  processOutboxBatch,
  resolveAuthenticatedApplicationUser
} = require('../dist/foundation/runtime');

function localStatus() {
  const output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' });
  const values = {};
  for (const line of output.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return values;
}

function sql(text) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_kitcheniq-2', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], { input: text, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function query(text) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_kitcheniq-2', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function createUser(client, label) {
  const email = `f40-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password: 'F40-local-password-123!' });
  assert.equal(error, null, `local signup failed: ${error?.message}`);
  assert.ok(data.session?.access_token, 'local signup did not return an access token');
  return { accessToken: data.session.access_token, authUserId: data.user.id };
}

async function main() {
  const status = localStatus();
  const publicConfig = { url: status.API_URL, publicKey: status.ANON_KEY };
  const serverConfig = loadSupabaseServerConfig({
    KITCHENIQ_SUPABASE_URL: publicConfig.url,
    KITCHENIQ_SUPABASE_PUBLIC_KEY: publicConfig.publicKey,
    KITCHENIQ_SUPABASE_SECRET_KEY: process.env.KITCHENIQ_SUPABASE_SECRET_KEY ?? status.SERVICE_ROLE_KEY
  });
  const publicClient = createClient(publicConfig.url, publicConfig.publicKey);
  const user = await createUser(publicClient, 'authorized');
  const unauthorized = await createUser(publicClient, 'unauthorized');
  const identity = await resolveAuthenticatedApplicationUser(user.accessToken, publicConfig);
  const unauthorizedIdentity = await resolveAuthenticatedApplicationUser(unauthorized.accessToken, publicConfig);
  const organizationId = '123e4567-e89b-42d3-a456-426614174070';
  sql(`
    insert into public.organizations (id) values ('${organizationId}');
    insert into private.role_permissions (role_class, permission_id)
      values ('manager', 'foundation.location.create')
      on conflict do nothing;
    insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
      values ('${identity.userId}', 'manager', 'organization', '${organizationId}');
  `);

  const key = createIdempotencyKey('f40-integration-key');
  const first = await createLocationWithAudit(user.accessToken, organizationId, key, serverConfig);
  const firstIdempotencyId = query(`select id from private.idempotency_records where operation = 'foundation.location.create' and organization_id = '${organizationId}' and idempotency_key = '${key}'`);
  const firstEventId = query(`select id from private.event_records where causation_id = '${firstIdempotencyId}'`);
  const firstAuthoritativeCounts = () => ({
    locations: Number(query(`select count(*) from public.locations where id = '${first.locationId}' and organization_id = '${organizationId}'`)),
    audits: Number(query(`select count(*) from private.audit_records where action = 'foundation.location.create' and target_kind = 'location' and target_id = '${first.locationId}' and correlation_id = '${first.correlationId}'`)),
    idempotency: Number(query(`select count(*) from private.idempotency_records where id = '${firstIdempotencyId}' and result_kind = 'location' and result_id = '${first.locationId}'`)),
    events: Number(query(`select count(*) from private.event_records where id = '${firstEventId}' and causation_id = '${firstIdempotencyId}' and correlation_id = '${first.correlationId}' and payload->>'locationId' = '${first.locationId}'`)),
    outbox: Number(query(`select count(*) from private.event_outbox where event_id = '${firstEventId}'`))
  });
  const replay = await createLocationWithAudit(user.accessToken, organizationId, key, serverConfig);
  assert.equal(replay.locationId, first.locationId);
  assert.equal(replay.replayed, true);
  assert.deepEqual(firstAuthoritativeCounts(), { locations: 1, audits: 1, idempotency: 1, events: 1, outbox: 1 });

  const concurrentKey = createIdempotencyKey('f40-concurrent-key');
  const concurrent = await Promise.all([
    createLocationWithAudit(user.accessToken, organizationId, concurrentKey, serverConfig),
    createLocationWithAudit(user.accessToken, organizationId, concurrentKey, serverConfig)
  ]);
  assert.equal(concurrent[0].locationId, concurrent[1].locationId);
  const concurrentIdempotencyId = query(`select id from private.idempotency_records where operation = 'foundation.location.create' and organization_id = '${organizationId}' and idempotency_key = '${concurrentKey}'`);
  const concurrentLocationId = concurrent[0].locationId;
  const concurrentEventId = query(`select id from private.event_records where causation_id = '${concurrentIdempotencyId}'`);
  assert.equal(Number(query(`select count(*) from public.locations where id = '${concurrentLocationId}' and organization_id = '${organizationId}'`)), 1);
  assert.equal(Number(query(`select count(*) from private.audit_records where action = 'foundation.location.create' and target_kind = 'location' and target_id = '${concurrentLocationId}'`)), 1);
  assert.equal(Number(query(`select count(*) from private.idempotency_records where id = '${concurrentIdempotencyId}' and result_kind = 'location' and result_id = '${concurrentLocationId}'`)), 1);
  assert.equal(Number(query(`select count(*) from private.event_records where id = '${concurrentEventId}' and causation_id = '${concurrentIdempotencyId}' and payload->>'locationId' = '${concurrentLocationId}'`)), 1);
  assert.equal(Number(query(`select count(*) from private.event_outbox where event_id = '${concurrentEventId}'`)), 1);

  const serverClient = createClient(publicConfig.url, serverConfig.secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const beforeMismatchCounts = firstAuthoritativeCounts();
  const mismatch = await serverClient.rpc('create_location_idempotent', {
    p_auth_principal_id: user.authUserId,
    p_application_user_id: identity.userId,
    p_aal: 'aal1',
    p_organization_id: organizationId,
    p_idempotency_key: key,
    p_request_hash: 'b'.repeat(64),
    p_correlation_id: first.correlationId
  });
  assert.ok(mismatch.error, 'different request hash is rejected');
  assert.deepEqual(firstAuthoritativeCounts(), beforeMismatchCounts);
  const beforeUnauthorizedCounts = {
    locations: Number(query(`select count(*) from public.locations where organization_id = '${organizationId}'`)),
    audits: Number(query(`select count(*) from private.audit_records where organization_id = '${organizationId}'`)),
    idempotency: Number(query(`select count(*) from private.idempotency_records where organization_id = '${organizationId}'`)),
    events: Number(query(`select count(*) from private.event_records where organization_id = '${organizationId}'`)),
    outbox: Number(query(`select count(*) from private.event_outbox where event_id in (select id from private.event_records where organization_id = '${organizationId}')`))
  };
  await assert.rejects(
    () => createLocationWithAudit(unauthorized.accessToken, organizationId, 'f40-unauthorized-key', serverConfig),
    'unauthorized Create Location is rejected'
  );
  assert.deepEqual({
    locations: Number(query(`select count(*) from public.locations where organization_id = '${organizationId}'`)),
    audits: Number(query(`select count(*) from private.audit_records where organization_id = '${organizationId}'`)),
    idempotency: Number(query(`select count(*) from private.idempotency_records where organization_id = '${organizationId}'`)),
    events: Number(query(`select count(*) from private.event_records where organization_id = '${organizationId}'`)),
    outbox: Number(query(`select count(*) from private.event_outbox where event_id in (select id from private.event_records where organization_id = '${organizationId}')`))
  }, beforeUnauthorizedCounts);
  void unauthorizedIdentity;

  const claimed = await serverClient.rpc('claim_event_outbox', { p_limit: 10, p_lease_seconds: 30 });
  assert.equal(claimed.error, null);
  const claimedFirst = claimed.data.find((event) => event.event_id === firstEventId);
  assert.ok(claimedFirst, 'first F-40 event is claimable');
  const eventId = claimedFirst.event_id;
  const receivedEventIds = [];
  const testHandler = (event) => receivedEventIds.push(event.event_id);
  await testHandler(claimedFirst);
  sql(`update private.event_outbox set lease_until = now() - interval '1 second' where event_id = '${eventId}';`);
  const reclaimed = await serverClient.rpc('claim_event_outbox', { p_limit: 10, p_lease_seconds: 30 });
  assert.equal(reclaimed.error, null);
  const reclaimedFirst = reclaimed.data.find((event) => event.event_id === eventId);
  assert.ok(reclaimedFirst, 'same F-40 event is reclaimed after lease expiry');
  await testHandler(reclaimedFirst);
  assert.deepEqual(receivedEventIds, [eventId, eventId]);
  const acknowledgedFirst = await serverClient.rpc('mark_event_delivered', { p_event_id: eventId, p_claim_token: reclaimedFirst.claim_token });
  assert.equal(acknowledgedFirst.error, null);
  assert.equal(acknowledgedFirst.data, true, 'active second claim acknowledges duplicate delivery');

  const claimedConcurrent = claimed.data.find((event) => event.event_id === concurrentEventId);
  assert.ok(claimedConcurrent, 'concurrent F-40 event is claimable');
  sql(`update private.event_outbox set lease_until = now() - interval '1 second' where event_id = '${concurrentEventId}';`);
  await assert.rejects(
    () => processOutboxBatch(serverConfig, () => { throw new Error('handler secret must not persist'); }, { batchSize: 1 }),
    /handler secret must not persist/
  );
  const persistedHandlerError = query(`select last_error from private.event_outbox where event_id = '${concurrentEventId}'`);
  assert.equal(persistedHandlerError, 'Outbox handler failed.', 'raw handler Error.message is not persisted');
  const reclaimedConcurrent = await serverClient.rpc('claim_event_outbox', { p_limit: 10, p_lease_seconds: 30 });
  assert.equal(reclaimedConcurrent.error, null);
  const activeConcurrent = reclaimedConcurrent.data.find((event) => event.event_id === concurrentEventId);
  assert.ok(activeConcurrent, 'failed concurrent F-40 event is released for redelivery');
  const acknowledgedConcurrent = await serverClient.rpc('mark_event_delivered', { p_event_id: concurrentEventId, p_claim_token: activeConcurrent.claim_token });
  assert.equal(acknowledgedConcurrent.error, null);
  assert.equal(acknowledgedConcurrent.data, true);
  const finalClaim = await serverClient.rpc('claim_event_outbox', { p_limit: 10, p_lease_seconds: 30 });
  assert.equal(finalClaim.error, null);
  assert.equal(finalClaim.data.some((event) => event.event_id === firstEventId), false, 'duplicate-delivered event is no longer claimable after acknowledgement');
  assert.equal(finalClaim.data.some((event) => event.event_id === concurrentEventId), false, 'failed event is no longer claimable after acknowledgement');
  console.log(JSON.stringify({
    idempotentReplay: 'PASS',
    concurrentDuplicateSuppression: 'PASS',
    materialMismatchRejection: 'PASS',
    unauthorizedCreate: 'DENIED',
    leaseExpiryReclaim: 'PASS',
    duplicateDelivery: 'PASS',
    duplicateDeliveryReceivedEventIds: receivedEventIds,
    duplicateDeliveryAcknowledgement: 'PASS',
    postAcknowledgementClaim: 'NONE',
    persistedHandlerError,
    acknowledgement: 'PASS'
  }, null, 2));
}

main().catch(async (error) => {
  if (error.message.includes('unexpectedly succeeded')) {
    console.error(error.message);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});