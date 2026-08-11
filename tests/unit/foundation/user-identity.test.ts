import {
  createApplicationUserIdentity,
  createAuthenticationPrincipalRef,
  isApplicationUserIdentity,
  isAuthenticationPrincipalRef,
  type ApplicationUserIdentity,
  type AuthenticationPrincipalRef
} from '../../../src/foundation/identity';

describe('Foundation user-identity primitive', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000';
  const principal = createAuthenticationPrincipalRef('opaque-principal');

  test('represents application user identifiers as UUIDv4-based branded types', () => {
    const identity = createApplicationUserIdentity(userId, principal);

    expect(identity.userId).toBe(userId);
    expect(identity.principal).toEqual(principal);
  });

  test('accepts canonical principal references and rejects invalid subjects', () => {
    expect(isAuthenticationPrincipalRef(principal)).toBe(true);
    expect(isAuthenticationPrincipalRef({ authority: 'supabase_auth', subject: 'opaque-principal' })).toBe(true);
    expect(isAuthenticationPrincipalRef({ authority: 'supabase_auth', subject: '' })).toBe(false);
    expect(isAuthenticationPrincipalRef({ authority: 'supabase_auth', subject: '   ' })).toBe(false);
    expect(isAuthenticationPrincipalRef({ authority: 'google', subject: 'opaque-principal' })).toBe(false);
    expect(isAuthenticationPrincipalRef({ authority: 'supabase_auth', subject: 'opaque-principal', extra: true })).toBe(false);
  });

  test('rejects malformed application user IDs', () => {
    expect(() => createApplicationUserIdentity('not-a-uuid', principal)).toThrow();
    expect(() => createApplicationUserIdentity('123e4567-e89b-11d3-a456-426614174000', principal)).toThrow();
  });

  test('accepts canonical identity structures and rejects extras', () => {
    const identity = createApplicationUserIdentity(userId, principal);

    expect(isApplicationUserIdentity(identity)).toBe(true);
    expect(isApplicationUserIdentity({ userId, principal })).toBe(true);
    expect(isApplicationUserIdentity({ userId, principal, email: 'user@example.com' })).toBe(false);
    expect(isApplicationUserIdentity({ userId, principal, role: 'admin' })).toBe(false);
    expect(isApplicationUserIdentity({ userId, principal, organizationId: '123e4567-e89b-42d3-a456-426614174001' })).toBe(false);
    expect(isApplicationUserIdentity({ userId, principal, disabled: true })).toBe(false);
    expect(isApplicationUserIdentity({ userId, principal, token: 'secret' })).toBe(false);
  });

  test('preserves stable application user identity across principal changes', () => {
    const first = createApplicationUserIdentity(userId, createAuthenticationPrincipalRef('principal-a'));
    const second = createApplicationUserIdentity(userId, createAuthenticationPrincipalRef('principal-b'));

    expect(first.userId).toBe(second.userId);
    expect(first.principal.subject).toBe('principal-a');
    expect(second.principal.subject).toBe('principal-b');
  });

  test('rejects non-plain values and credentials-like data', () => {
    class CustomIdentity {
      public userId = userId;
      public principal = principal;
    }

    expect(isApplicationUserIdentity(new CustomIdentity())).toBe(false);
    expect(isApplicationUserIdentity(new Date())).toBe(false);
    expect(isApplicationUserIdentity([])).toBe(false);
    expect(isApplicationUserIdentity(null)).toBe(false);
    expect(isAuthenticationPrincipalRef({ authority: 'supabase_auth', subject: 'opaque', token: 'secret' })).toBe(false);
    expect(isAuthenticationPrincipalRef({ authority: 'supabase_auth', subject: 'opaque', password: 'secret' })).toBe(false);
  });

  test('serializes and validates through JSON round-trips', () => {
    const identity = createApplicationUserIdentity(userId, principal);
    const roundTrip = JSON.parse(JSON.stringify(identity)) as ApplicationUserIdentity;

    expect(isApplicationUserIdentity(roundTrip)).toBe(true);
    expect(roundTrip).toEqual(identity);
  });

  test('does not include scope or profile fields in the canonical identity', () => {
    const identity = createApplicationUserIdentity(userId, principal);

    expect(identity).toEqual({ userId, principal });
    expect('organizationId' in identity).toBe(false);
    expect('locationId' in identity).toBe(false);
    expect('email' in identity).toBe(false);
    expect('displayName' in identity).toBe(false);
  });
});
