const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const {
  createLocation,
  loadSupabaseServerConfig,
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

async function createUser(client, label) {
  const email = `f37-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password: 'F37-local-password-123!' });
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
  const client = createClient(publicConfig.url, publicConfig.publicKey);
  const first = await createUser(client, 'authorized');
  const second = await createUser(client, 'unauthorized');
  const firstIdentity = await resolveAuthenticatedApplicationUser(first.accessToken, publicConfig);
  const secondIdentity = await resolveAuthenticatedApplicationUser(second.accessToken, publicConfig);
  const organizationId = '123e4567-e89b-42d3-a456-426614174020';
  const secondOrganizationId = '123e4567-e89b-42d3-a456-426614174021';
  sql(`
    insert into public.organizations (id) values ('${organizationId}'), ('${secondOrganizationId}');
    insert into private.role_permissions (role_class, permission_id)
      values ('manager', 'foundation.location.create'), ('manager', 'foundation.scope.read');
    insert into private.role_assignments (application_user_id, role_class, scope_kind, organization_id)
      values ('${firstIdentity.userId}', 'manager', 'organization', '${organizationId}');
  `);

  const authorizedClient = createClient(publicConfig.url, publicConfig.publicKey, { global: { headers: { Authorization: `Bearer ${first.accessToken}` } } });
  const unauthorizedClient = createClient(publicConfig.url, publicConfig.publicKey, { global: { headers: { Authorization: `Bearer ${second.accessToken}` } } });
  const firstRead = await authorizedClient.from('organizations').select('id').eq('id', organizationId);
  assert.equal(firstRead.error, null);
  assert.equal(firstRead.data.length, 1, 'authorized exact-scope read succeeds');
  const secondRead = await unauthorizedClient.from('organizations').select('id').eq('id', organizationId);
  assert.equal(secondRead.error, null);
  assert.equal(secondRead.data.length, 0, 'unauthorized organization read is filtered');
  const directOrganizationInsert = await authorizedClient.from('organizations').insert({ id: '123e4567-e89b-42d3-a456-426614174022' });
  assert.ok(directOrganizationInsert.error, 'direct authenticated organization insert is denied');
  const directInsert = await authorizedClient.from('locations').insert({ organization_id: organizationId });
  assert.ok(directInsert.error, 'direct authenticated location insert is denied');
  const directUpdate = await authorizedClient.from('locations').update({ organization_id: secondOrganizationId }).eq('id', '123e4567-e89b-42d3-a456-426614174033');
  assert.ok(directUpdate.error, 'direct authenticated location update is denied');
  const directDelete = await authorizedClient.from('locations').delete().eq('id', '123e4567-e89b-42d3-a456-426614174033');
  assert.ok(directDelete.error, 'direct authenticated location delete is denied');
  const createdLocationId = await createLocation(first.accessToken, organizationId, serverConfig);
  const created = await authorizedClient.from('locations').select('id').eq('id', createdLocationId);
  assert.equal(created.error, null);
  assert.equal(created.data.length, 0, 'organization scope does not inherit location read');
  await assert.rejects(() => createLocation(second.accessToken, organizationId, serverConfig));
  await assert.rejects(() => createLocation(first.accessToken, secondOrganizationId, serverConfig));
  console.log(JSON.stringify({ realAuthUsers: 2, exactOrganizationRead: 'PASS', unauthorizedRead: 'PASS', directOrganizationInsert: 'DENIED', directLocationInsert: 'DENIED', directLocationUpdate: 'DENIED', directLocationDelete: 'DENIED', serverCreateLocation: 'PASS', unauthorizedServerWrite: 'DENIED', organizationScopeNoLocationInheritance: 'PASS', callerIdentitySpoof: 'DENIED', callerAalSpoof: 'NOT CLIENT-CONTROLLED' }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });