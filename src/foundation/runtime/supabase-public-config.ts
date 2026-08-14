export const KITCHENIQ_SUPABASE_URL_VARIABLE = 'KITCHENIQ_SUPABASE_URL' as const;
export const KITCHENIQ_SUPABASE_PUBLIC_KEY_VARIABLE = 'KITCHENIQ_SUPABASE_PUBLIC_KEY' as const;

export type SupabasePublicConfig = Readonly<{
  readonly url: string;
  readonly publicKey: string;
}>;

export function loadSupabasePublicConfig(source: NodeJS.ProcessEnv = process.env): SupabasePublicConfig {
  const url = source[KITCHENIQ_SUPABASE_URL_VARIABLE];
  const publicKey = source[KITCHENIQ_SUPABASE_PUBLIC_KEY_VARIABLE];

  if (!url || !isHttpUrl(url)) {
    throw new Error(`${KITCHENIQ_SUPABASE_URL_VARIABLE} must be a valid HTTP(S) URL.`);
  }
  if (!publicKey || publicKey.trim().length === 0) {
    throw new Error(`${KITCHENIQ_SUPABASE_PUBLIC_KEY_VARIABLE} is required.`);
  }

  return { url, publicKey };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}