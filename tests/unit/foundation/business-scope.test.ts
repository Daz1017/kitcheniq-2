import {
  createLocationScope,
  createOrganizationScope,
  isBusinessScope,
  isLocationScope,
  isOrganizationScope,
  type BusinessScope,
  type LocationScope,
  type OrganizationScope
} from '../../../src/foundation/business-scope';

describe('Foundation business-scope primitive', () => {
  const organizationId = '123e4567-e89b-42d3-a456-426614174000';
  const locationId = '123e4567-e89b-43d3-a456-426614174001';

  test('represents organization and location identifiers as UUIDv4-based branded types', () => {
    const organizationScope = createOrganizationScope(organizationId);
    const locationScope = createLocationScope(organizationId, locationId);

    expect(organizationScope.kind).toBe('organization');
    expect(organizationScope.organizationId).toBe(organizationId);
    expect(locationScope.kind).toBe('location');
    expect(locationScope.organizationId).toBe(organizationId);
    expect(locationScope.locationId).toBe(locationId);
  });

  test('validates organization and location scope structures', () => {
    const organizationScope = createOrganizationScope(organizationId);
    const locationScope = createLocationScope(organizationId, locationId);

    expect(isOrganizationScope(organizationScope)).toBe(true);
    expect(isLocationScope(locationScope)).toBe(true);
    expect(isBusinessScope(organizationScope)).toBe(true);
    expect(isBusinessScope(locationScope)).toBe(true);
    expect(isOrganizationScope(locationScope)).toBe(false);
    expect(isLocationScope(organizationScope)).toBe(false);
  });

  test('rejects malformed location scopes without the required organization context', () => {
    expect(isLocationScope({ kind: 'location', locationId })).toBe(false);
    expect(isBusinessScope({ kind: 'location', locationId })).toBe(false);
  });

  test('rejects malformed UUIDs and unsupported scope kinds', () => {
    expect(() => createOrganizationScope('not-a-uuid')).toThrow();
    expect(() => createLocationScope(organizationId, 'not-a-uuid')).toThrow();
    expect(isBusinessScope({ kind: 'global', organizationId })).toBe(false);
    expect(isBusinessScope({ kind: 'tenant', organizationId })).toBe(false);
    expect(isBusinessScope({ kind: 'store', organizationId })).toBe(false);
    expect(isBusinessScope({ kind: 'restaurant', organizationId })).toBe(false);
  });

  test('rejects organization scopes with extra location fields and profile-like data', () => {
    expect(isOrganizationScope({ kind: 'organization', organizationId, locationId })).toBe(false);
    expect(isOrganizationScope({ kind: 'organization', organizationId, organizationName: 'Anything' })).toBe(false);
    expect(isOrganizationScope({ kind: 'organization', organizationId, role: 'admin' })).toBe(false);
  });

  test('rejects location scopes with extra fields and access-control-like data', () => {
    expect(isLocationScope({ kind: 'location', organizationId, locationId, extra: true })).toBe(false);
    expect(isLocationScope({ kind: 'location', organizationId, locationId, role: 'admin' })).toBe(false);
  });

  test('rejects class instances, dates, arrays, and null', () => {
    class CustomObject {
      public kind = 'organization';
      public organizationId = organizationId;
    }

    const date = new Date();
    const array = [1, 2, 3];

    expect(isBusinessScope(new CustomObject())).toBe(false);
    expect(isBusinessScope(date)).toBe(false);
    expect(isBusinessScope(array)).toBe(false);
    expect(isBusinessScope(null)).toBe(false);
  });

  test('supports ordinary JSON serialization and deserialization', () => {
    const organizationScope = createOrganizationScope(organizationId);
    const locationScope = createLocationScope(organizationId, locationId);

    const roundTripOrganization = JSON.parse(JSON.stringify(organizationScope)) as OrganizationScope;
    const roundTripLocation = JSON.parse(JSON.stringify(locationScope)) as LocationScope;

    expect(isOrganizationScope(roundTripOrganization)).toBe(true);
    expect(isLocationScope(roundTripLocation)).toBe(true);
    expect(roundTripOrganization).toEqual(organizationScope);
    expect(roundTripLocation).toEqual(locationScope);
  });

  test('keeps the plain-data contract and excludes extra mutable fields', () => {
    const organizationScope = createOrganizationScope(organizationId);
    const locationScope = createLocationScope(organizationId, locationId);

    expect(organizationScope).toEqual({ kind: 'organization', organizationId });
    expect(locationScope).toEqual({ kind: 'location', organizationId, locationId });
    expect('organizationName' in organizationScope).toBe(false);
    expect('locationName' in locationScope).toBe(false);
    expect('address' in locationScope).toBe(false);
    expect('timezone' in locationScope).toBe(false);
  });

  test('rejects arbitrary objects and non-plain values', () => {
    expect(isBusinessScope({})).toBe(false);
    expect(isOrganizationScope('not-an-object')).toBe(false);
    expect(isLocationScope(42)).toBe(false);
  });
});
