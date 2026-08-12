import { createEventId, generateEventId, isEventId } from '../../../src/foundation/events';
import { generateUUID, isUUIDv4 } from '../../../src/foundation/identifiers';

describe('Foundation event identifier', () => {
  test('generates multiple valid UUIDv4 event IDs', () => {
    const ids = Array.from({ length: 8 }, () => generateEventId());

    expect(ids.every((id) => isEventId(id))).toBe(true);
    expect(ids.every((id) => isUUIDv4(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('accepts a canonical UUIDv4', () => {
    const id = createEventId('550e8400-e29b-41d4-a716-446655440000');

    expect(isEventId(id)).toBe(true);
    expect(id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  test('rejects malformed and non-v4 UUID values', () => {
    const uuid = generateUUID();
    const nonV4 = `${uuid.substring(0, 14)}1${uuid.substring(15)}`;

    expect(isEventId('not-an-event-id')).toBe(false);
    expect(isEventId(nonV4)).toBe(false);
    expect(() => createEventId('not-an-event-id')).toThrow();
    expect(() => createEventId(nonV4)).toThrow();
  });

  test('rejects non-string values', () => {
    for (const value of [null, undefined, 123, false, {}, []]) {
      expect(isEventId(value)).toBe(false);
      expect(() => createEventId(value)).toThrow();
    }
  });

  test('round-trips as an ordinary JSON string', () => {
    const id = generateEventId();
    const parsed: { eventId: unknown } = JSON.parse(JSON.stringify({ eventId: id }));

    expect(parsed.eventId).toBe(id);
    expect(isEventId(parsed.eventId)).toBe(true);
  });

  test('keeps event identity distinct from opaque idempotency keys', () => {
    const id = generateEventId();

    expect(isEventId('caller-replay-key')).toBe(false);
    expect(isEventId(id)).toBe(true);
  });
});