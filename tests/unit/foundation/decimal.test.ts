import {
  addDecimal,
  isDecimal,
  multiplyDecimal,
  parseDecimal,
  roundDecimalToScale,
  subtractDecimal
} from '../../../src/foundation/decimal';
import {
  MONETARY_TOTAL_PRECISION,
  MONETARY_TOTAL_SCALE,
  PHYSICAL_QUANTITY_PRECISION,
  PHYSICAL_QUANTITY_SCALE,
  RATIO_RATE_PERCENT_PRECISION,
  RATIO_RATE_PERCENT_SCALE,
  UNIT_COST_PRECISION,
  UNIT_COST_SCALE
} from '../../../src/foundation/decimal/precision';

describe('Foundation decimal arithmetic', () => {
  test('parses accepted decimal strings and rejects invalid ones', () => {
    const accepted = ['0', '1', '-1', '0.1', '-0.1', '12345678901234567890.12345678'];

    for (const value of accepted) {
      expect(parseDecimal(value)).toBe(value);
      expect(isDecimal(value)).toBe(true);
    }

    const rejected = ['', ' ', 'abc', '1,000.00', 'NaN', 'Infinity', '-Infinity', '1e3', '1E-3', ' 1.25', '1.25 ', ' 1.25 '];
    for (const value of rejected) {
      expect(isDecimal(value)).toBe(false);
      expect(() => parseDecimal(value)).toThrow();
    }

    expect(() => parseDecimal(0 as unknown as string)).toThrow();
    expect(() => parseDecimal(Number.NaN as unknown as string)).toThrow();
    expect(() => parseDecimal(Number.POSITIVE_INFINITY as unknown as string)).toThrow();
    expect(() => parseDecimal(Number.NEGATIVE_INFINITY as unknown as string)).toThrow();
  });

  test('canonicalizes formatting and negative zero', () => {
    expect(parseDecimal('001.2300')).toBe('1.23');
    expect(parseDecimal('-0.000')).toBe('0');
    expect(isDecimal('001.2300')).toBe(true);
    expect(isDecimal('-0.000')).toBe(true);
  });

  test('performs exact arithmetic and preserves precision', () => {
    expect(addDecimal('0.1', '0.2')).toBe('0.3');
    expect(subtractDecimal('0.3', '0.1')).toBe('0.2');
    expect(multiplyDecimal('0.6', '3')).toBe('1.8');

    const largeValue = '12345678901234567890.12345678';
    const exact = addDecimal(largeValue, '0.00000001');
    expect(exact).toBe('12345678901234567890.12345679');
  });

  test('does not round intermediate arithmetic until an explicit boundary is requested', () => {
    const intermediate = multiplyDecimal(addDecimal('0.1', '0.2'), '3');
    expect(intermediate).toBe('0.9');

    const rounded = roundDecimalToScale(intermediate, 2);
    expect(rounded).toBe('0.90');
  });

  test('rounds half-up explicitly for positive and negative boundaries', () => {
    expect(roundDecimalToScale('1.005', 2)).toBe('1.01');
    expect(roundDecimalToScale('1.004', 2)).toBe('1.00');
    expect(roundDecimalToScale('2.5', 0)).toBe('3');
    expect(roundDecimalToScale('-2.5', 0)).toBe('-3');
    expect(roundDecimalToScale('-1.005', 2)).toBe('-1.01');
  });

  test('keeps canonical ordinary decimal output for very small and very large values', () => {
    expect(parseDecimal('0.00000001')).toBe('0.00000001');
    expect(parseDecimal('1000000000000000000000')).toBe('1000000000000000000000');
    expect(addDecimal('0.00000001', '0.00000001')).toBe('0.00000002');
    expect(multiplyDecimal('1000000000000000000000', '1000000000000000000000')).toBe('1000000000000000000000000000000000000000000');
    expect(subtractDecimal('1000000000000000000000', '1')).toBe('999999999999999999999');

    const outputs = [
      parseDecimal('0.00000001'),
      addDecimal('0.00000001', '0.00000001'),
      subtractDecimal('1000000000000000000000', '1'),
      multiplyDecimal('1000000000000000000000', '1000000000000000000000'),
      roundDecimalToScale('1.005', 2)
    ];

    expect(outputs.every((value) => !/[eE]/.test(value))).toBe(true);
  });

  test('rejects invalid rounding scales', () => {
    expect(() => roundDecimalToScale('1.23', -1)).toThrow();
    expect(() => roundDecimalToScale('1.23', 1.5)).toThrow();
    expect(() => roundDecimalToScale('1.23', Number.NaN)).toThrow();
    expect(() => roundDecimalToScale('1.23', Number.POSITIVE_INFINITY)).toThrow();
  });

  test('exposes frozen precision and scale constants', () => {
    expect(MONETARY_TOTAL_PRECISION).toBe(19);
    expect(MONETARY_TOTAL_SCALE).toBe(4);
    expect(UNIT_COST_PRECISION).toBe(20);
    expect(UNIT_COST_SCALE).toBe(8);
    expect(PHYSICAL_QUANTITY_PRECISION).toBe(20);
    expect(PHYSICAL_QUANTITY_SCALE).toBe(8);
    expect(RATIO_RATE_PERCENT_PRECISION).toBe(18);
    expect(RATIO_RATE_PERCENT_SCALE).toBe(8);
  });

  test('serializes through JSON as ordinary decimal strings', () => {
    const value = parseDecimal('001.2300');
    const json = JSON.stringify({ value });
    expect(json).toBe('{"value":"1.23"}');
  });
});
