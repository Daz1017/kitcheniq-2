import {
  CANONICAL_UNIT_CODES,
  CANONICAL_UNIT_DIMENSIONS,
  DIMENSIONS,
  dimensionForCanonicalUnit,
  isCanonicalUnitCode,
  isDimension,
  type CanonicalUnitCode,
  type Dimension
} from '../../../src/foundation/units';

describe('Foundation units primitive', () => {
  test('accepts the exact frozen dimensions', () => {
    expect(isDimension('mass')).toBe(true);
    expect(isDimension('volume')).toBe(true);
    expect(isDimension('count')).toBe(true);

    expect(isDimension('')).toBe(false);
    expect(isDimension('weight')).toBe(false);
    expect(isDimension('length')).toBe(false);
    expect(isDimension('Mass')).toBe(false);
    expect(isDimension('VOLUME')).toBe(false);
    expect(isDimension(null as unknown as string)).toBe(false);
    expect(isDimension(undefined as unknown as string)).toBe(false);
    expect(isDimension(0 as unknown as string)).toBe(false);
  });

  test('accepts the exact frozen canonical unit codes', () => {
    expect(isCanonicalUnitCode('g')).toBe(true);
    expect(isCanonicalUnitCode('mL')).toBe(true);
    expect(isCanonicalUnitCode('ea')).toBe(true);

    expect(isCanonicalUnitCode('gram')).toBe(false);
    expect(isCanonicalUnitCode('G')).toBe(false);
    expect(isCanonicalUnitCode('ml')).toBe(false);
    expect(isCanonicalUnitCode('ML')).toBe(false);
    expect(isCanonicalUnitCode('each')).toBe(false);
    expect(isCanonicalUnitCode('EA')).toBe(false);
    expect(isCanonicalUnitCode('kg')).toBe(false);
    expect(isCanonicalUnitCode('lb')).toBe(false);
    expect(isCanonicalUnitCode('oz')).toBe(false);
    expect(isCanonicalUnitCode('L')).toBe(false);
    expect(isCanonicalUnitCode('')).toBe(false);
    expect(isCanonicalUnitCode(null as unknown as string)).toBe(false);
    expect(isCanonicalUnitCode(undefined as unknown as string)).toBe(false);
  });

  test('maps canonical units to their authoritative dimensions', () => {
    expect(dimensionForCanonicalUnit('g')).toBe('mass');
    expect(dimensionForCanonicalUnit('mL')).toBe('volume');
    expect(dimensionForCanonicalUnit('ea')).toBe('count');
  });

  test('exposes exactly three frozen dimensions and three frozen canonical units', () => {
    expect(DIMENSIONS).toEqual(['mass', 'volume', 'count']);
    expect(CANONICAL_UNIT_CODES).toEqual(['g', 'mL', 'ea']);
    expect(DIMENSIONS).toHaveLength(3);
    expect(CANONICAL_UNIT_CODES).toHaveLength(3);
  });

  test('serializes as ordinary JSON strings', () => {
    const payload = {
      dimension: 'mass' as Dimension,
      unit: 'g' as CanonicalUnitCode
    };

    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json) as typeof payload;

    expect(parsed.dimension).toBe('mass');
    expect(parsed.unit).toBe('g');
    expect(typeof parsed.dimension).toBe('string');
    expect(typeof parsed.unit).toBe('string');
  });

  test('holds one authoritative mapping definition for canonical units', () => {
    expect(CANONICAL_UNIT_DIMENSIONS).toEqual({
      g: 'mass',
      mL: 'volume',
      ea: 'count'
    });
  });
});
