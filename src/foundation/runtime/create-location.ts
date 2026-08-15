import { createClient } from '@supabase/supabase-js';
import { resolveAuthenticatedApplicationUser } from './supabase-auth';
import { type SupabaseServerConfig } from './supabase-server-config';
import { isUUIDv4 } from '../identifiers';
import { createCorrelationId, type CorrelationId } from '../correlation';

export class CreateLocationAuthorizationError extends Error {
  public constructor() {
    super('Create Location was not authorized.');
    this.name = 'CreateLocationAuthorizationError';
  }
}

export async function createLocation(
  accessToken: string,
  organizationId: string,
  config: SupabaseServerConfig
): Promise<string> {
  const result = await createLocationWithAudit(accessToken, organizationId, config);
  return result.locationId;
}

export async function createLocationWithAudit(
  accessToken: string,
  organizationId: string,
  config: SupabaseServerConfig
): Promise<Readonly<{ locationId: string; correlationId: CorrelationId }>> {
  if (!isUUIDv4(organizationId)) {
    throw new CreateLocationAuthorizationError();
  }

  const correlationId = createCorrelationId();

  const verificationClient = createClient(config.url, config.publicKey);
  const { data: claimsResult, error: claimsError } = await verificationClient.auth.getClaims(accessToken);
  const claims = claimsResult?.claims as Record<string, unknown> | undefined;
  const principalId = claims?.sub;
  const aal = claims?.aal;
  if (claimsError || typeof principalId !== 'string' || (aal !== 'aal1' && aal !== 'aal2')) {
    throw new CreateLocationAuthorizationError();
  }

  const identity = await resolveAuthenticatedApplicationUser(accessToken, config);
  const serverClient = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const result = await serverClient.rpc('create_location', {
    p_auth_principal_id: principalId,
    p_application_user_id: identity.userId,
    p_aal: aal,
    p_organization_id: organizationId,
    p_correlation_id: correlationId
  });
  if (result.error || typeof result.data !== 'string' || !isUUIDv4(result.data)) {
    throw new CreateLocationAuthorizationError();
  }

  return { locationId: result.data, correlationId };
}