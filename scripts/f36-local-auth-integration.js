const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const {
  loadSupabasePublicConfig,
  resolveAuthenticatedApplicationUser
} = require('../dist/foundation/runtime');
const { isApplicationUserIdentity } = require('../dist/foundation/identity');

const config = loadSupabasePublicConfig({
  KITCHENIQ_SUPABASE_URL: process.env.KITCHENIQ_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  KITCHENIQ_SUPABASE_PUBLIC_KEY: process.env.KITCHENIQ_SUPABASE_PUBLIC_KEY
});
const client = createClient(config.url, config.publicKey);

async function createUser(label) {
  const email = `f36-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password: 'F36-local-password-123!' });
  assert.equal(error, null, `local signup failed: ${error?.message}`);
  assert.ok(data.session?.access_token, 'local signup did not return an access token');
  assert.ok(data.user?.id, 'local signup did not return an auth user');
  return { accessToken: data.session.access_token, authUserId: data.user.id };
}

async function main() {
  await assert.rejects(() => resolveAuthenticatedApplicationUser('', config));
  const first = await createUser('first');
  const firstIdentity = await resolveAuthenticatedApplicationUser(first.accessToken, config);
  const repeatedIdentity = await resolveAuthenticatedApplicationUser(first.accessToken, config);
  assert.equal(firstIdentity.principal.subject, first.authUserId);
  assert.equal(firstIdentity.userId, repeatedIdentity.userId);
  assert.ok(isApplicationUserIdentity(firstIdentity));

  const second = await createUser('second');
  const secondIdentity = await resolveAuthenticatedApplicationUser(second.accessToken, config);
  assert.notEqual(firstIdentity.userId, secondIdentity.userId);
  assert.equal(secondIdentity.principal.subject, second.authUserId);

  console.log(JSON.stringify({
    signup: 'PASS',
    tokenVerification: 'PASS',
    firstAuthPrincipal: first.authUserId,
    firstApplicationUserId: firstIdentity.userId,
    repeatedResolution: 'PASS',
    secondAuthPrincipal: second.authUserId,
    secondApplicationUserId: secondIdentity.userId,
    unauthenticatedResolution: 'REJECTED'
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});