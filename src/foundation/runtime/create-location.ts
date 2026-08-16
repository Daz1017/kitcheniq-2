import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { resolveAuthenticatedApplicationUser } from './supabase-auth';
import { type SupabaseServerConfig } from './supabase-server-config';
import { isUUIDv4 } from '../identifiers';
import { createCorrelationId, type CorrelationId } from '../correlation';
import { createIdempotencyKey, type IdempotencyKey } from '../idempotency';

export class CreateLocationAuthorizationError extends Error {
  public constructor() {
    super('Create Location was not authorized.');
    this.name = 'CreateLocationAuthorizationError';
  }
}

export async function createLocation(
  accessToken: string,
  organizationId: string,
  idempotencyKey: IdempotencyKey | string,
  config: SupabaseServerConfig
): Promise<string> {
  const result = await createLocationWithAudit(accessToken, organizationId, idempotencyKey, config);
  return result.locationId;
}

export async function createLocationWithAudit(
  accessToken: string,
  organizationId: string,
  idempotencyKey: IdempotencyKey | string,
  config: SupabaseServerConfig
): Promise<Readonly<{ locationId: string; correlationId: CorrelationId; replayed: boolean }>> {
  if (!isUUIDv4(organizationId)) {
    throw new CreateLocationAuthorizationError();
  }

  let validatedIdempotencyKey: IdempotencyKey;
  try {
    validatedIdempotencyKey = createIdempotencyKey(idempotencyKey);
  } catch {
    throw new CreateLocationAuthorizationError();
  }

  const correlationId = createCorrelationId();
  const requestHash = hashCreateLocationRequest(organizationId);

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
  const result = await serverClient.rpc('create_location_idempotent', {
    p_auth_principal_id: principalId,
    p_application_user_id: identity.userId,
    p_aal: aal,
    p_organization_id: organizationId,
    p_idempotency_key: validatedIdempotencyKey,
    p_request_hash: requestHash,
    p_correlation_id: correlationId
  });
  const response = result.data as { locationId?: unknown; replayed?: unknown } | null;
  if (result.error || !response || typeof response.locationId !== 'string' || !isUUIDv4(response.locationId) || typeof response.replayed !== 'boolean') {
    throw new CreateLocationAuthorizationError();
  }

  return { locationId: response.locationId, correlationId, replayed: response.replayed };
}

export function hashCreateLocationRequest(organizationId: string): string {
  if (!isUUIDv4(organizationId)) {
    throw new Error('Create Location organizationId must be a UUIDv4.');
  }

  return createHash('sha256')
    .update(`{"organizationId":"${organizationId}"}`, 'utf8')
    .digest('hex');
}