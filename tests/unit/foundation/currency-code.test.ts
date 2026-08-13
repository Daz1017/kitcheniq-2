import { createCurrencyCode, isCurrencyCode } from '../../../src/foundation/currency';

describe('Foundation currency code', () => {
  test('accepts representative non-empty currency codes', () => {
    const values = ['USD', 'EUR', 'JPY', 'GBP', 'BTC'];

    for (const value of values) {
      expect(createCurrencyCode(value)).toBe(value);
      expect(isCurrencyCode(value)).toBe(true);
    }
  });

  test('preserves case and punctuation exactly', () => {
    const value = 'XAU';

    expect(createCurrencyCode(value)).toBe(value);
    expect(isCurrencyCode(value)).toBe(true);
  });

  test('rejects empty and whitespace-only strings', () => {
    for (const value of ['', ' ', '\t', '\n', '   ']) {
      expect(isCurrencyCode(value)).toBe(false);
      expect(() => createCurrencyCode(value)).toThrow();
    }
  });

  test('rejects surrounding whitespace without trimming', () => {
    for (const value of [' USD', 'USD ', ' USD ']) {
      expect(isCurrencyCode(value)).toBe(false);
      expect(() => createCurrencyCode(value)).toThrow();
    }
  });

  test('rejects non-string values', () => {
    for (const value of [null, undefined, 123, false, {}, []]) {
      expect(isCurrencyCode(value)).toBe(false);
      expect(() => createCurrencyCode(value)).toThrow();
    }
  });

  test('round-trips as an ordinary JSON string', () => {
    const code = createCurrencyCode('XAU');
    const parsed: { code: unknown } = JSON.parse(JSON.stringify({ code }));

    expect(parsed.code).toBe(code);
    expect(isCurrencyCode(parsed.code)).toBe(true);
  });
});
