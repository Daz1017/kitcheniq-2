import { createEventType, isEventType } from '../../../src/foundation/events';

describe('Foundation event type', () => {
  test('accepts and preserves open vocabulary strings', () => {
    const values = [
      'inventory.changed',
      'invoice:validated',
      'IMPORT_COMPLETED',
      'event-001',
      '123'
    ];

    for (const value of values) {
      expect(createEventType(value)).toBe(value);
      expect(isEventType(value)).toBe(true);
    }
  });

  test('preserves case and punctuation exactly', () => {
    const value = 'Inventory.Changed:V2_event-001';

    expect(createEventType(value)).toBe(value);
  });

  test('rejects empty and whitespace-only strings', () => {
    for (const value of ['', ' ', '\t', '\n']) {
      expect(isEventType(value)).toBe(false);
      expect(() => createEventType(value)).toThrow();
    }
  });

  test('rejects surrounding whitespace without trimming', () => {
    for (const value of [' inventory.changed', 'inventory.changed ']) {
      expect(isEventType(value)).toBe(false);
      expect(() => createEventType(value)).toThrow();
    }
  });

  test('rejects non-string values', () => {
    for (const value of [null, undefined, 123, false, {}, []]) {
      expect(isEventType(value)).toBe(false);
      expect(() => createEventType(value)).toThrow();
    }
  });

  test('round-trips as an ordinary JSON string', () => {
    const eventType = createEventType('Inventory.Changed');
    const parsed: { eventType: unknown } = JSON.parse(JSON.stringify({ eventType }));

    expect(parsed.eventType).toBe(eventType);
    expect(isEventType(parsed.eventType)).toBe(true);
  });
});