import { generateUUID, isUUIDv4, brandUUID } from '../../../src/foundation/identifiers/uuid';

describe('UUID v4 identifier primitive', () => {
  test('generates a valid UUIDv4', () => {
    const id = generateUUID();
    expect(typeof id).toBe('string');
    expect(isUUIDv4(id)).toBe(true);
  });

  test('accepts lowercase and uppercase UUIDv4', () => {
    const lower = generateUUID();
    const upper = lower.toUpperCase();
    expect(isUUIDv4(lower)).toBe(true);
    expect(isUUIDv4(upper)).toBe(true);
    expect(brandUUID(upper)).toBe(upper);
  });

  test('rejects malformed UUIDs', () => {
    expect(() => brandUUID('not-a-uuid')).toThrow();
    expect(isUUIDv4('not-a-uuid')).toBe(false);
  });

  test('rejects non-v4 UUIDs (different version)', () => {
    // forge a version 1 uuid-like string by mutating the version nibble
    const id = generateUUID();
    // version nibble is the 15th character (0-based index 14)
    const v1 = id.substring(0, 14) + '1' + id.substring(15);
    expect(isUUIDv4(v1)).toBe(false);
    expect(() => brandUUID(v1)).toThrow();
  });

  test('JSON serialization preserves UUID string form', () => {
    const id = generateUUID();
    const obj = { id };
    const json = JSON.stringify(obj);
    expect(json).toContain(id);
  });
});
