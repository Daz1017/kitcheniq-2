import {
  createIdempotencyKey,
  isIdempotencyKey
} from '../../../src/foundation/idempotency';

describe('Foundation idempotency key primitive', () => {
  test('accepts and preserves opaque strings', () => {
    for (const value of ['req-000123', 'invoice-import:abc-001', 'ABCdef123', '123']) {
      expect(createIdempotencyKey(value)).toBe(value);
      expect(isIdempotencyKey(value)).toBe(true);
    }
  });

  test('accepts non-UUID opaque keys without imposing a format', () => {
    const key = createIdempotencyKey('invoice-import:abc-001');
    expect(key).toBe('invoice-import:abc-001');
    expect(isIdempotencyKey(key)).toBe(true);
  });

  test('rejects non-string input', () => {
    for (const value of [null, undefined, 123, false, {}, []]) {
      expect(isIdempotencyKey(value)).toBe(false);
      expect(() => createIdempotencyKey(value)).toThrow();
    }
  });

  test('rejects empty, whitespace-only, and surrounding whitespace', () => {
    for (const value of ['', ' ', '\t', '\n', ' key', 'key ']) {
      expect(isIdempotencyKey(value)).toBe(false);
      expect(() => createIdempotencyKey(value)).toThrow();
    }
  });

  test('preserves exact case and punctuation', () => {
    const mixedCase = createIdempotencyKey('ABCdef123');
    const punctuated = createIdempotencyKey('req-000123');

    expect(mixedCase).toBe('ABCdef123');
    expect(punctuated).toBe('req-000123');
  });

  test('preserves exact value through JSON round-trip', () => {
    const key = createIdempotencyKey('invoice-import:abc-001');
    const parsed: unknown = JSON.parse(JSON.stringify({ idempotencyKey: key })).idempotencyKey;

    expect(isIdempotencyKey(parsed)).toBe(true);
    expect(parsed).toBe('invoice-import:abc-001');
  });
});
