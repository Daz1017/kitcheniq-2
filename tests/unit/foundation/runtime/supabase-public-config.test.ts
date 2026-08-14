import { loadSupabasePublicConfig } from '../../../../src/foundation/runtime';

describe('F-36 public Supabase configuration', () => {
  test('loads URL and public key without treating the key as a secret', () => {
    expect(loadSupabasePublicConfig({
      KITCHENIQ_SUPABASE_URL: 'http://127.0.0.1:54321',
      KITCHENIQ_SUPABASE_PUBLIC_KEY: 'anon-key'
    })).toEqual({ url: 'http://127.0.0.1:54321', publicKey: 'anon-key' });
  });

  test('fails closed for missing or invalid public configuration', () => {
    expect(() => loadSupabasePublicConfig({})).toThrow();
    expect(() => loadSupabasePublicConfig({
      KITCHENIQ_SUPABASE_URL: 'not-a-url',
      KITCHENIQ_SUPABASE_PUBLIC_KEY: 'anon-key'
    })).toThrow();
  });
});