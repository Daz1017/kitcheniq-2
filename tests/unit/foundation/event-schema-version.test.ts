import { createEventSchemaVersion, isEventSchemaVersion } from '../../../src/foundation/events';

describe('Foundation event schema version', () => {
  test('accepts representative non-empty schema version strings', () => {
    const values = ['1', '2', 'v1', '1.0', 'a non-SemVer example'];

    for (const value of values) {
      expect(createEventSchemaVersion(value)).toBe(value);
      expect(isEventSchemaVersion(value)).toBe(true);
    }
  });

  test('preserves case and punctuation exactly', () => {
    const value = 'Schema-V2.1';

    expect(createEventSchemaVersion(value)).toBe(value);
    expect(isEventSchemaVersion(value)).toBe(true);
  });

  test('rejects empty and whitespace-only strings', () => {
    for (const value of ['', ' ', '\t', '\n', '   ']) {
      expect(isEventSchemaVersion(value)).toBe(false);
      expect(() => createEventSchemaVersion(value)).toThrow();
    }
  });

  test('rejects surrounding whitespace without trimming', () => {
    for (const value of [' 1.0.0', '1.0.0 ', ' 1.0.0 ']) {
      expect(isEventSchemaVersion(value)).toBe(false);
      expect(() => createEventSchemaVersion(value)).toThrow();
    }
  });

  test('rejects non-string values', () => {
    for (const value of [null, undefined, 123, false, {}, []]) {
      expect(isEventSchemaVersion(value)).toBe(false);
      expect(() => createEventSchemaVersion(value)).toThrow();
    }
  });

  test('round-trips as an ordinary JSON string', () => {
    const version = createEventSchemaVersion('Schema-V2.1');
    const parsed: { version: unknown } = JSON.parse(JSON.stringify({ version }));

    expect(parsed.version).toBe(version);
    expect(isEventSchemaVersion(parsed.version)).toBe(true);
  });
});
