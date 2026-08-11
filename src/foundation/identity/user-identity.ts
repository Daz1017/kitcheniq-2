import { type EntityId, isUUIDv4 } from '../identifiers';

export type ApplicationUserId = EntityId<'user'>;

export type AuthenticationAuthority = 'supabase_auth';

export type AuthenticationPrincipalRef = Readonly<{
  readonly authority: AuthenticationAuthority;
  readonly subject: string;
}>;

export type ApplicationUserIdentity = Readonly<{
  readonly userId: ApplicationUserId;
  readonly principal: AuthenticationPrincipalRef;
}>;

export function createAuthenticationPrincipalRef(subject: string): AuthenticationPrincipalRef {
  if (!isValidPrincipalSubject(subject)) {
    throw new Error('Authentication principal subject must be a non-empty string.');
  }

  return {
    authority: 'supabase_auth',
    subject
  };
}

export function createApplicationUserIdentity(userId: string, principal: AuthenticationPrincipalRef): ApplicationUserIdentity {
  return {
    userId: brandApplicationUserId(userId),
    principal: normalizePrincipal(principal)
  };
}

export function isAuthenticationPrincipalRef(value: unknown): value is AuthenticationPrincipalRef {
  if (!isPlainObject(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const ownKeys = Object.keys(candidate);
  return ownKeys.length === 2 && ownKeys.includes('authority') && ownKeys.includes('subject') && candidate.authority === 'supabase_auth' && typeof candidate.subject === 'string' && isValidPrincipalSubject(candidate.subject);
}

export function isApplicationUserIdentity(value: unknown): value is ApplicationUserIdentity {
  if (!isPlainObject(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const ownKeys = Object.keys(candidate);
  return ownKeys.length === 2 && ownKeys.includes('userId') && ownKeys.includes('principal') && typeof candidate.userId === 'string' && isUUIDv4(candidate.userId) && isAuthenticationPrincipalRef(candidate.principal);
}

function brandApplicationUserId(value: string): ApplicationUserId {
  if (!isUUIDv4(value)) {
    throw new Error('ApplicationUserId must be a valid UUIDv4.');
  }

  return value as ApplicationUserId;
}

function normalizePrincipal(principal: AuthenticationPrincipalRef): AuthenticationPrincipalRef {
  if (!isAuthenticationPrincipalRef(principal)) {
    throw new Error('Authentication principal must be a valid Supabase Auth principal reference.');
  }

  return principal;
}

function isValidPrincipalSubject(subject: string): boolean {
  return subject.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
