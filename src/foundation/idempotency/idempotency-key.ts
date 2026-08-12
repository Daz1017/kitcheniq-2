export type IdempotencyKey = string & {
  readonly __idempotencyKeyBrand: unique symbol;
};

export function createIdempotencyKey(value: unknown): IdempotencyKey {
  if (!isIdempotencyKey(value)) {
    throw new Error('Idempotency key must be a non-empty string without surrounding whitespace.');
  }

  return value;
}

export function isIdempotencyKey(value: unknown): value is IdempotencyKey {
  return typeof value === 'string'
    && value.length > 0
    && value.trim().length > 0
    && value === value.trim();
}
