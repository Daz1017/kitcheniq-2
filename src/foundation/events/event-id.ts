import { type EntityId, brandEntityId, generateUUID, isUUIDv4 } from '../identifiers';

export type EventId = EntityId<'event'>;

export function generateEventId(): EventId {
  return brandEntityId<'event'>(generateUUID());
}

export function createEventId(value: unknown): EventId {
  if (!isEventId(value)) {
    throw new Error('Invalid EventId');
  }

  return brandEntityId<'event'>(value);
}

export function isEventId(value: unknown): value is EventId {
  return typeof value === 'string' && isUUIDv4(value);
}