import {
  isPurchaseSpecificationCostObservation,
  projectPurchaseSpecificationCostState,
  resolveEffectivePurchaseSpecificationCostObservation,
  validatePurchaseSpecificationCostTimeline,
  validatePurchaseSpecificationUnitCost,
  type KnownPurchaseSpecificationCostObservation,
  type UnknownPurchaseSpecificationCostObservation
} from '../../../src/modules/ingredient-intelligence';

const ORG_ID =
  '550e8400-e29b-41d4-a716-446655444001';

const SPEC_ID =
  '550e8400-e29b-41d4-a716-446655444002';

const OTHER_SPEC_ID =
  '550e8400-e29b-41d4-a716-446655444003';

const SUPPLIER_PRODUCT_ID =
  '550e8400-e29b-41d4-a716-446655444004';

const OBS_1_ID =
  '550e8400-e29b-41d4-a716-446655444005';

const OBS_2_ID =
  '550e8400-e29b-41d4-a716-446655444006';

const OBS_3_ID =
  '550e8400-e29b-41d4-a716-446655444007';

function knownObservation(
  overrides:
    Partial<KnownPurchaseSpecificationCostObservation>
    = {}
): KnownPurchaseSpecificationCostObservation {
  return {
    id:
      OBS_1_ID as
        KnownPurchaseSpecificationCostObservation['id'],
    organizationId:
      ORG_ID as
        KnownPurchaseSpecificationCostObservation[
          'organizationId'
        ],
    purchaseSpecificationId:
      SPEC_ID as
        KnownPurchaseSpecificationCostObservation[
          'purchaseSpecificationId'
        ],
    valueState: 'known',
    unitCost: '12.5',
    currency: 'USD' as
      KnownPurchaseSpecificationCostObservation[
        'currency'
      ],
    sourceKind: 'manual',
    supplierProductId: null,
    effectiveFrom:
      new Date('2026-08-01T12:00:00Z'),
    createdAt:
      new Date('2026-08-01T12:00:01Z'),
    ...overrides
  };
}

function unknownObservation(
  overrides:
    Partial<UnknownPurchaseSpecificationCostObservation>
    = {}
): UnknownPurchaseSpecificationCostObservation {
  return {
    id:
      OBS_3_ID as
        UnknownPurchaseSpecificationCostObservation['id'],
    organizationId:
      ORG_ID as
        UnknownPurchaseSpecificationCostObservation[
          'organizationId'
        ],
    purchaseSpecificationId:
      SPEC_ID as
        UnknownPurchaseSpecificationCostObservation[
          'purchaseSpecificationId'
        ],
    valueState: 'unknown',
    unitCost: null,
    currency: null,
    sourceKind: 'manual',
    supplierProductId: null,
    effectiveFrom:
      new Date('2026-08-20T12:00:00Z'),
    createdAt:
      new Date('2026-08-20T12:00:01Z'),
    ...overrides
  };
}

describe('M2-I04 Purchase Specification cost state', () => {
  test.each([
    ['0', '0'],
    ['0.00000000', '0'],
    ['12.50000000', '12.5'],
    ['0.123456789123', '0.123456789123'],
    ['-0', '0']
  ])(
    'accepts nonnegative decimal %s without JS-number conversion',
    (input, expected) => {
      expect(
        validatePurchaseSpecificationUnitCost(
          input
        )
      ).toEqual({
        valid: true,
        value: expected
      });
    }
  );

  test.each([
    '-0.00000001',
    '-1',
    '+4.25',
    '',
    ' ',
    ' 1.25',
    '1.25 ',
    'NaN',
    '1e3',
    1.25,
    null
  ])(
    'rejects invalid or negative unit cost %p',
    (value) => {
      expect(
        validatePurchaseSpecificationUnitCost(
          value
        ).valid
      ).toBe(false);
    }
  );

  test('preserves exact high precision instead of rounding in TypeScript', () => {
    const result =
      validatePurchaseSpecificationUnitCost(
        '123.123456789123456'
      );

    expect(result).toEqual({
      valid: true,
      value: '123.123456789123456'
    });
  });

  test('accepts known manual cost observation', () => {
    expect(
      isPurchaseSpecificationCostObservation(
        knownObservation()
      )
    ).toBe(true);
  });

  test('accepts exact open currency vocabulary', () => {
    expect(
      isPurchaseSpecificationCostObservation(
        knownObservation({
          currency:
            'currency:test' as
              KnownPurchaseSpecificationCostObservation[
                'currency'
              ]
        })
      )
    ).toBe(true);

    expect(
      isPurchaseSpecificationCostObservation(
        knownObservation({
          currency:
            'usd' as
              KnownPurchaseSpecificationCostObservation[
                'currency'
              ]
        })
      )
    ).toBe(true);
  });

  test('known cost requires currency', () => {
    expect(
      isPurchaseSpecificationCostObservation({
        ...knownObservation(),
        currency: null
      })
    ).toBe(false);
  });

  test('unknown cost requires both amount and currency to be absent', () => {
    expect(
      isPurchaseSpecificationCostObservation(
        unknownObservation()
      )
    ).toBe(true);

    expect(
      isPurchaseSpecificationCostObservation({
        ...unknownObservation(),
        unitCost: '1.25'
      })
    ).toBe(false);

    expect(
      isPurchaseSpecificationCostObservation({
        ...unknownObservation(),
        currency: 'USD'
      })
    ).toBe(false);
  });

  test('manual provenance cannot carry Supplier Product identity', () => {
    expect(
      isPurchaseSpecificationCostObservation({
        ...knownObservation(),
        supplierProductId:
          SUPPLIER_PRODUCT_ID
      })
    ).toBe(false);
  });

  test('Supplier Product provenance requires Supplier Product identity', () => {
    expect(
      isPurchaseSpecificationCostObservation({
        ...knownObservation(),
        sourceKind:
          'supplier_product',
        supplierProductId:
          SUPPLIER_PRODUCT_ID
      })
    ).toBe(true);

    expect(
      isPurchaseSpecificationCostObservation({
        ...knownObservation(),
        sourceKind:
          'supplier_product',
        supplierProductId:
          null
      })
    ).toBe(false);
  });

  test('cost timeline may be supplied out of insertion order', () => {
    const earlier =
      knownObservation({
        effectiveFrom:
          new Date('2026-08-01T12:00:00Z')
      });

    const later =
      knownObservation({
        id:
          OBS_2_ID as
            KnownPurchaseSpecificationCostObservation[
              'id'
            ],
        unitCost: '14.25',
        effectiveFrom:
          new Date('2026-08-15T12:00:00Z')
      });

    expect(
      validatePurchaseSpecificationCostTimeline([
        later,
        earlier
      ]).valid
    ).toBe(true);
  });

  test('cost timeline rejects duplicate effective instants', () => {
    const first =
      knownObservation();

    const second =
      knownObservation({
        id:
          OBS_2_ID as
            KnownPurchaseSpecificationCostObservation[
              'id'
            ]
      });

    expect(
      validatePurchaseSpecificationCostTimeline([
        first,
        second
      ]).valid
    ).toBe(false);
  });

  test('cost timeline cannot cross Purchase Specifications', () => {
    const first =
      knownObservation();

    const second =
      knownObservation({
        id:
          OBS_2_ID as
            KnownPurchaseSpecificationCostObservation[
              'id'
            ],
        purchaseSpecificationId:
          OTHER_SPEC_ID as
            KnownPurchaseSpecificationCostObservation[
              'purchaseSpecificationId'
            ],
        effectiveFrom:
          new Date('2026-08-15T12:00:00Z')
      });

    expect(
      validatePurchaseSpecificationCostTimeline([
        first,
        second
      ]).valid
    ).toBe(false);
  });

  test('resolves effective observation by effective time rather than array order', () => {
    const first =
      knownObservation({
        unitCost: '10'
      });

    const second =
      knownObservation({
        id:
          OBS_2_ID as
            KnownPurchaseSpecificationCostObservation[
              'id'
            ],
        unitCost: '15',
        effectiveFrom:
          new Date('2026-08-15T12:00:00Z')
      });

    const result =
      resolveEffectivePurchaseSpecificationCostObservation(
        [
          second,
          first
        ],
        new Date('2026-08-16T00:00:00Z')
      );

    expect(result.valid).toBe(true);

    if (result.valid) {
      expect(result.value?.id)
        .toBe(second.id);
    }
  });

  test('future observations do not affect earlier as-of state', () => {
    const first =
      knownObservation({
        unitCost: '10'
      });

    const future =
      knownObservation({
        id:
          OBS_2_ID as
            KnownPurchaseSpecificationCostObservation[
              'id'
            ],
        unitCost: '20',
        effectiveFrom:
          new Date('2026-09-01T12:00:00Z')
      });

    const result =
      resolveEffectivePurchaseSpecificationCostObservation(
        [future, first],
        new Date('2026-08-10T12:00:00Z')
      );

    expect(result.valid).toBe(true);

    if (result.valid) {
      expect(result.value?.id)
        .toBe(first.id);
    }
  });

  test('explicit unknown observation becomes the effective state', () => {
    const known =
      knownObservation();

    const unknown =
      unknownObservation();

    const result =
      resolveEffectivePurchaseSpecificationCostObservation(
        [unknown, known],
        new Date('2026-08-21T12:00:00Z')
      );

    expect(result.valid).toBe(true);

    if (result.valid) {
      expect(result.value?.valueState)
        .toBe('unknown');
    }
  });

  test('no historical observation before as-of returns null', () => {
    const result =
      resolveEffectivePurchaseSpecificationCostObservation(
        [knownObservation()],
        new Date('2026-07-01T12:00:00Z')
      );

    expect(result).toEqual({
      valid: true,
      value: null
    });
  });

  test('projects known cost to Foundation ValueState Money', () => {
    const result =
      projectPurchaseSpecificationCostState(
        knownObservation({
          unitCost: '12.50000000',
          currency:
            'USD' as
              KnownPurchaseSpecificationCostObservation[
                'currency'
              ]
        })
      );

    expect(result).toEqual({
      valid: true,
      value: {
        status: 'known',
        value: {
          amount: '12.5',
          currency: 'USD'
        }
      }
    });
  });

  test('projects explicit unknown without inventing a value', () => {
    expect(
      projectPurchaseSpecificationCostState(
        unknownObservation()
      )
    ).toEqual({
      valid: true,
      value: {
        status: 'unknown'
      }
    });
  });

  test('I04 cost observation has no Ingredient preferred/current-cost identity', () => {
    const observation =
      knownObservation();

    expect(observation)
      .not.toHaveProperty('ingredientId');

    expect(observation)
      .not.toHaveProperty('preferred');

    expect(observation)
      .not.toHaveProperty('currentCost');

    expect(observation)
      .not.toHaveProperty('preferredSupplierProductId');
  });
});
