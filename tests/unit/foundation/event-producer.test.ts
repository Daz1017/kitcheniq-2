import { createEventProducer, isEventProducer } from '../../../src/foundation/events';

describe('Foundation event producer', () => {
  test('accepts representative non-empty producer strings', () => {
    const values = ['foundation', 'invoice_processing', 'module-5', 'integration:pos', 'InvoiceProcessor'];

    for (const value of values) {
      expect(createEventProducer(value)).toBe(value);
      expect(isEventProducer(value)).toBe(true);
    }
  });

  test('preserves case and punctuation exactly', () => {
    const value = 'InvoiceProcessor:POS-5';

    expect(createEventProducer(value)).toBe(value);
    expect(isEventProducer(value)).toBe(true);
  });

  test('rejects empty and whitespace-only strings', () => {
    for (const value of ['', ' ', '\t', '\n', '   ']) {
      expect(isEventProducer(value)).toBe(false);
      expect(() => createEventProducer(value)).toThrow();
    }
  });

  test('rejects surrounding whitespace without trimming', () => {
    for (const value of [' foundation', 'foundation ', ' foundation ']) {
      expect(isEventProducer(value)).toBe(false);
      expect(() => createEventProducer(value)).toThrow();
    }
  });

  test('rejects non-string values', () => {
    for (const value of [null, undefined, 123, false, {}, []]) {
      expect(isEventProducer(value)).toBe(false);
      expect(() => createEventProducer(value)).toThrow();
    }
  });

  test('round-trips as an ordinary JSON string', () => {
    const producer = createEventProducer('InvoiceProcessor:POS-5');
    const parsed: { producer: unknown } = JSON.parse(JSON.stringify({ producer }));

    expect(parsed.producer).toBe(producer);
    expect(isEventProducer(parsed.producer)).toBe(true);
  });
});
