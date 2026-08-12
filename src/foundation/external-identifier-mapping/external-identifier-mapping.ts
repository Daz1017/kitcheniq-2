import { type EntityId, isUUIDv4, brandEntityId } from '../identifiers';
import {
  type ExternalIdentifierRef,
  isExternalIdentifierRef
} from '../external-identifiers';

export type ExternalIdentifierMapping<TEntity extends string = string> = Readonly<{
  readonly externalRef: ExternalIdentifierRef;
  readonly kitchenIqId: EntityId<TEntity>;
}>;

export function createExternalIdentifierMapping<TEntity extends string = string>(
  externalRef: ExternalIdentifierRef,
  kitchenIqId: string
): ExternalIdentifierMapping<TEntity> {
  if (!isExternalIdentifierRef(externalRef)) {
    throw new Error('External identifier reference must be structurally valid.');
  }

  return Object.freeze({
    externalRef,
    kitchenIqId: brandEntityId<TEntity>(kitchenIqId)
  });
}

export function isExternalIdentifierMapping(
  value: unknown
): value is ExternalIdentifierMapping {
  if (!isPlainObject(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const ownKeys = Object.keys(candidate);
  return ownKeys.length === 2
    && ownKeys.includes('externalRef')
    && ownKeys.includes('kitchenIqId')
    && isExternalIdentifierRef(candidate.externalRef)
    && typeof candidate.kitchenIqId === 'string'
    && isUUIDv4(candidate.kitchenIqId);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
