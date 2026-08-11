import crypto from 'crypto';

export type UUID = string & { readonly __brand: 'UUID' };

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateUUID(): UUID {
  const id = crypto.randomUUID();
  return brandUUID(id);
}

export function isUUIDv4(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

export function brandUUID(id: string): UUID {
  if (!isUUIDv4(id)) {
    throw new Error('Invalid UUIDv4');
  }
  return id as UUID;
}

export function assertUUIDv4(id: string): asserts id is UUID {
  if (!isUUIDv4(id)) {
    throw new Error('Invalid UUIDv4');
  }
}

// Helper to create entity-specific branded identifier types
export type EntityId<EntityName extends string> = UUID & { readonly __entity: EntityName };

export function brandEntityId<EntityName extends string>(id: string): EntityId<EntityName> {
  // runtime check is the same for all entity ids
  return brandUUID(id) as EntityId<EntityName>;
}

export default {
  generateUUID,
  isUUIDv4,
  brandUUID,
  assertUUIDv4,
  brandEntityId
};
