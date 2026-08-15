import { type SupabasePublicConfig } from './supabase-public-config';

export const KITCHENIQ_SUPABASE_SECRET_KEY_VARIABLE = 'KITCHENIQ_SUPABASE_SECRET_KEY' as const;

export type SupabaseServerConfig = SupabasePublicConfig & Readonly<{
  readonly secretKey: string;
}>;

export function loadSupabaseServerConfig(source: NodeJS.ProcessEnv = process.env): SupabaseServerConfig {
  const url = source.KITCHENIQ_SUPABASE_URL;
  const publicKey = source.KITCHENIQ_SUPABASE_PUBLIC_KEY;
  const secretKey = source[KITCHENIQ_SUPABASE_SECRET_KEY_VARIABLE];

  if (!url || !isHttpUrl(url)) {
    throw new Error('KITCHENIQ_SUPABASE_URL must be a valid HTTP(S) URL.');
  }
  if (!publicKey || publicKey.trim().length === 0) {
    throw new Error('KITCHENIQ_SUPABASE_PUBLIC_KEY is required.');
  }
  if (!secretKey || secretKey.trim().length === 0) {
    throw new Error(`${KITCHENIQ_SUPABASE_SECRET_KEY_VARIABLE} is required in server runtime only.`);
  }

  return { url, publicKey, secretKey };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}