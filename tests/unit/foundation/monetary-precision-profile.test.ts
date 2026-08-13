import {
  MONETARY_PRECISION_PROFILES,
  isMonetaryPrecisionProfile,
  precisionForMonetaryProfile,
  type MonetaryPrecisionProfile
} from '../../../src/foundation/money';

describe('Foundation monetary precision profiles', () => {
  test('exposes exactly the monetary_total and unit_cost profiles', () => {
    expect(MONETARY_PRECISION_PROFILES).toEqual([
      'monetary_total',
      'unit_cost'
    ]);
    expect(new Set(MONETARY_PRECISION_PROFILES).size).toBe(2);
  });

  test('profile names remain restricted to the two defined profiles', () => {
    const names: MonetaryPrecisionProfile[] = ['monetary_total', 'unit_cost'];

    expect(names).toHaveLength(2);
  });

  test('recognizes only the approved profile names', () => {
    expect(isMonetaryPrecisionProfile('monetary_total')).toBe(true);
    expect(isMonetaryPrecisionProfile('unit_cost')).toBe(true);

    for (const profile of ['total', 'money', 'unit-price', 'unit_price', 'high_precision', 'cost']) {
      expect(isMonetaryPrecisionProfile(profile)).toBe(false);
    }
  });

  test('rejects non-string profile names', () => {
    for (const profile of [null, undefined, 0, false, {}, []]) {
      expect(isMonetaryPrecisionProfile(profile)).toBe(false);
    }
  });

  test('returns metadata for each approved profile', () => {
    expect(precisionForMonetaryProfile('monetary_total')).toEqual({ precision: 19, scale: 4 });
    expect(precisionForMonetaryProfile('unit_cost')).toEqual({ precision: 20, scale: 8 });
  });

  test('round-trips both profile names through JSON', () => {
    for (const profile of MONETARY_PRECISION_PROFILES) {
      const parsed: unknown = JSON.parse(JSON.stringify(profile));

      expect(parsed).toBe(profile);
      expect(isMonetaryPrecisionProfile(parsed)).toBe(true);
    }
  });

  test('returns metadata that cannot be mutated at runtime', () => {
    const metadata = precisionForMonetaryProfile('monetary_total');

    expect(Object.isFrozen(metadata)).toBe(true);
    expect(() => {
      (metadata as { precision: number }).precision = 1;
    }).toThrow();
    expect(precisionForMonetaryProfile('monetary_total')).toEqual({ precision: 19, scale: 4 });
  });
});
