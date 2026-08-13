import {
  NON_MONETARY_PRECISION_PROFILES,
  isNonMonetaryPrecisionProfile,
  precisionForNonMonetaryProfile,
  type NonMonetaryPrecisionProfile
} from '../../../src/foundation/decimal';

describe('Foundation non-monetary precision profiles', () => {
  test('exposes exactly two unique profiles and their metadata', () => {
    expect(NON_MONETARY_PRECISION_PROFILES).toEqual([
      'physical_quantity',
      'ratio_rate_percent'
    ]);
    expect(new Set(NON_MONETARY_PRECISION_PROFILES).size).toBe(2);
    expect(precisionForNonMonetaryProfile('physical_quantity')).toEqual({
      precision: 20,
      scale: 8
    });
    expect(precisionForNonMonetaryProfile('ratio_rate_percent')).toEqual({
      precision: 18,
      scale: 8
    });
  });

  test('profile names remain restricted to the two defined profiles', () => {
    const profiles: NonMonetaryPrecisionProfile[] = [
      'physical_quantity',
      'ratio_rate_percent'
    ];

    expect(profiles).toHaveLength(2);
  });

  test('rejects invalid aliases without normalization', () => {
    for (const profile of [
      'quantity',
      'physical',
      'ratio',
      'rate',
      'percent',
      'percentage',
      'ratio_rate'
    ]) {
      expect(isNonMonetaryPrecisionProfile(profile)).toBe(false);
    }
  });

  test('rejects all non-string values', () => {
    for (const profile of [null, undefined, 0, false, {}, []]) {
      expect(isNonMonetaryPrecisionProfile(profile)).toBe(false);
    }
  });

  test('round-trips both profile names through JSON', () => {
    for (const profile of NON_MONETARY_PRECISION_PROFILES) {
      const parsed: unknown = JSON.parse(JSON.stringify(profile));

      expect(parsed).toBe(profile);
      expect(isNonMonetaryPrecisionProfile(parsed)).toBe(true);
    }
  });

  test('returns immutable metadata without rounding behavior', () => {
    const physicalQuantity = precisionForNonMonetaryProfile('physical_quantity');
    const ratioRatePercent = precisionForNonMonetaryProfile('ratio_rate_percent');

    expect(Object.isFrozen(physicalQuantity)).toBe(true);
    expect(Object.isFrozen(ratioRatePercent)).toBe(true);
    expect(physicalQuantity).toEqual({ precision: 20, scale: 8 });
    expect(ratioRatePercent).toEqual({ precision: 18, scale: 8 });
    expect(() => {
      (physicalQuantity as { precision: number }).precision = 1;
    }).toThrow();
    expect(precisionForNonMonetaryProfile('physical_quantity')).toEqual({
      precision: 20,
      scale: 8
    });
  });
});
