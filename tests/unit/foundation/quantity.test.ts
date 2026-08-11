import {
  createQuantity,
  dimensionOfQuantity,
  isQuantity,
  type Quantity
} from '../../../src/foundation/quantity';

describe('Foundation quantity primitive', () => {
  test('creates canonical quantities for the frozen units', () => {
    expect(createQuantity('001.2300', 'g')).toEqual({ value: '1.23', unit: 'g' });
    expect(createQuantity('000.000', 'mL')).toEqual({ value: '0', unit: 'mL' });
    expect(createQuantity('-2.500', 'ea')).toEqual({ value: '-2.5', unit: 'ea' });
  });

  test('accepts zero and negative quantities', () => {
    const zero = createQuantity('0', 'g');
    const negative = createQuantity('-3.14159', 'ea');

    expect(zero.value).toBe('0');
    expect(negative.value).toBe('-3.14159');
  });

  test('rejects primitive JavaScript numbers and invalid decimal strings', () => {
    expect(() => createQuantity(1 as unknown as string, 'g')).toThrow();
    expect(() => createQuantity('1e3' as unknown as string, 'g')).toThrow();
    expect(() => createQuantity('NaN' as unknown as string, 'g')).toThrow();
    expect(() => createQuantity('Infinity' as unknown as string, 'g')).toThrow();
    expect(() => createQuantity('abc', 'g')).toThrow();
  });

  test('rejects invalid and noncanonical units', () => {
    expect(() => createQuantity('1', 'kg' as unknown as 'g')).toThrow();
    expect(() => createQuantity('1', '' as unknown as 'g')).toThrow();
    expect(() => createQuantity('1', null as unknown as 'g')).toThrow();
  });

  test('preserves high precision without scale-8 rounding', () => {
    const quantity = createQuantity('1.12345678901234567890', 'g');
    expect(quantity.value).toBe('1.1234567890123456789');
  });

  test('derives dimensions from the frozen unit substrate', () => {
    expect(dimensionOfQuantity(createQuantity('1', 'g'))).toBe('mass');
    expect(dimensionOfQuantity(createQuantity('1', 'mL'))).toBe('volume');
    expect(dimensionOfQuantity(createQuantity('1', 'ea'))).toBe('count');
  });

  test('does not include a redundant dimension field', () => {
    const quantity = createQuantity('1.23', 'g');
    expect(quantity).toEqual({ value: '1.23', unit: 'g' });
    expect('dimension' in quantity).toBe(false);
  });

  test('serializes as ordinary JSON data', () => {
    const quantity = createQuantity('001.2300', 'g');
    const json = JSON.stringify(quantity);
    expect(json).toBe('{"value":"1.23","unit":"g"}');
  });

  test('preserves large decimal precision', () => {
    const large = createQuantity('12345678901234567890.12345678', 'ea');
    expect(large.value).toBe('12345678901234567890.12345678');
  });

  test('validates quantities using the frozen semantics', () => {
    expect(isQuantity(createQuantity('1', 'g'))).toBe(true);
    expect(isQuantity({ value: '1', unit: 'g' })).toBe(true);
    expect(isQuantity({ value: 1, unit: 'g' })).toBe(false);
    expect(isQuantity({ value: '1', unit: 'kg' })).toBe(false);
  });
});
