import { createCorrelationId, isCorrelationId } from '../../../src/foundation/correlation/correlation-id';
import { generateUUID, isUUIDv4 } from '../../../src/foundation/identifiers/uuid';

describe('Foundation correlation identifier', () => {
  test('createCorrelationId produces a valid UUIDv4', () => {
    const id = createCorrelationId();
    expect(isCorrelationId(id)).toBe(true);
    expect(isUUIDv4(id)).toBe(true);
  });

  test('independent calls produce distinct IDs', () => {
    const ids = new Set(Array.from({ length: 8 }, () => createCorrelationId()));
    expect(ids.size).toBe(8);
  });

  test('correlation IDs serialize as normal strings', () => {
    const id = createCorrelationId();
    expect(JSON.stringify({ correlationId: id })).toContain(id);
  });

  test('malformed strings fail correlation-ID validation', () => {
    expect(isCorrelationId('not-a-correlation-id')).toBe(false);
  });

  test('generation reuses UUID validation semantics', () => {
    const id = createCorrelationId();
    expect(isUUIDv4(id)).toBe(true);
  });
});
