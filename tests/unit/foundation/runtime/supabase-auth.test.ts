import {
  AuthenticationVerificationError,
  resolveAuthenticatedApplicationUser
} from '../../../../src/foundation/runtime';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((url: string, key: string, options?: unknown) => ({
    auth: {
      getClaims: jest.fn(async () => ({
        data: { claims: { sub: '123e4567-e89b-42d3-a456-426614174000' } },
        error: null
      }))
    },
    rpc: jest.fn(async () => ({ data: '123e4567-e89b-42d3-a456-426614174001', error: null })),
    url,
    key,
    options
  }))
}));

describe('F-36 Supabase Auth adapter', () => {
  const config = { url: 'http://127.0.0.1:54321', publicKey: 'public-key' };

  test('verifies a token and reconstructs the frozen identity contract', async () => {
    await expect(resolveAuthenticatedApplicationUser('access-token', config)).resolves.toEqual({
      userId: '123e4567-e89b-42d3-a456-426614174001',
      principal: { authority: 'supabase_auth', subject: '123e4567-e89b-42d3-a456-426614174000' }
    });
  });

  test.each(['', '   '])('rejects missing token %j', async (token) => {
    await expect(resolveAuthenticatedApplicationUser(token, config)).rejects.toBeInstanceOf(AuthenticationVerificationError);
  });
});