import { type EntityId, isUUIDv4 } from '../identifiers';

export type OrganizationId = EntityId<'organization'>;
export type LocationId = EntityId<'location'>;

export type OrganizationScope = Readonly<{
  readonly kind: 'organization';
  readonly organizationId: OrganizationId;
}>;

export type LocationScope = Readonly<{
  readonly kind: 'location';
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
}>;

export type BusinessScope = OrganizationScope | LocationScope;

export function createOrganizationScope(organizationId: string): OrganizationScope {
  return {
    kind: 'organization',
    organizationId: brandOrganizationId(organizationId)
  };
}

export function createLocationScope(organizationId: string, locationId: string): LocationScope {
  return {
    kind: 'location',
    organizationId: brandOrganizationId(organizationId),
    locationId: brandLocationId(locationId)
  };
}

export function isOrganizationScope(value: unknown): value is OrganizationScope {
  if (!isPlainObject(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const ownKeys = Object.keys(candidate);
  return ownKeys.length === 2 && ownKeys.includes('kind') && ownKeys.includes('organizationId') && candidate.kind === 'organization' && typeof candidate.organizationId === 'string' && isUUIDv4(candidate.organizationId);
}

export function isLocationScope(value: unknown): value is LocationScope {
  if (!isPlainObject(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const ownKeys = Object.keys(candidate);
  return ownKeys.length === 3 && ownKeys.includes('kind') && ownKeys.includes('organizationId') && ownKeys.includes('locationId') && candidate.kind === 'location' && typeof candidate.organizationId === 'string' && isUUIDv4(candidate.organizationId) && typeof candidate.locationId === 'string' && isUUIDv4(candidate.locationId);
}

export function isBusinessScope(value: unknown): value is BusinessScope {
  return isOrganizationScope(value) || isLocationScope(value);
}

function brandOrganizationId(value: string): OrganizationId {
  if (!isUUIDv4(value)) {
    throw new Error('OrganizationId must be a valid UUIDv4.');
  }

  return value as OrganizationId;
}

function brandLocationId(value: string): LocationId {
  if (!isUUIDv4(value)) {
    throw new Error('LocationId must be a valid UUIDv4.');
  }

  return value as LocationId;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
