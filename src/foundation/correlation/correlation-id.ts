import { EntityId, generateUUID, isUUIDv4, brandEntityId } from '../identifiers/uuid';

export type CorrelationId = EntityId<'correlation'>;

export function createCorrelationId(): CorrelationId {
  return brandEntityId<'correlation'>(generateUUID());
}

export function isCorrelationId(value: unknown): value is CorrelationId {
  return typeof value === 'string' && isUUIDv4(value);
}
