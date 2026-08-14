import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createApplicationUserIdentity,
  createAuthenticationPrincipalRef,
  type ApplicationUserIdentity
} from '../identity';
import { isUUIDv4 } from '../identifiers';
import { type SupabasePublicConfig } from './supabase-public-config';

export class AuthenticationVerificationError extends Error {
  public constructor() {
    super('Authentication could not be verified.');
    this.name = 'AuthenticationVerificationError';
  }
}

export function createSupabaseAuthClient(config: SupabasePublicConfig): SupabaseClient {
  return createClient(config.url, config.publicKey);
}

export async function resolveAuthenticatedApplicationUser(
  accessToken: string,
  config: SupabasePublicConfig
): Promise<ApplicationUserIdentity> {
  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new AuthenticationVerificationError();
  }

  const verificationClient = createSupabaseAuthClient(config);
  const { data, error } = await verificationClient.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub || typeof data.claims.sub !== 'string') {
    throw new AuthenticationVerificationError();
  }

  const principal = createAuthenticationPrincipalRef(data.claims.sub);
  const authenticatedClient = createClient(config.url, config.publicKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
  const result = await authenticatedClient.rpc('current_application_user_id');
  if (result.error || typeof result.data !== 'string' || !isUUIDv4(result.data)) {
    throw new AuthenticationVerificationError();
  }

  return createApplicationUserIdentity(result.data, principal);
}