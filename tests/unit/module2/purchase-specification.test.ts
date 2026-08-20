import {
  isPositiveDecimalString,
  isPurchaseSpecification,
  isPurchaseSpecificationLifecycleStatus,
  isPurchaseSpecificationVersion,
  validatePackageLabel,
  validatePackageOrdinal,
  validatePurchaseSpecificationPackageStructure,
  validatePurchaseSpecificationVersionNumber,
  validateSpecificationLabel,
  validateUnitsPerParent,
  type PurchaseSpecificationPackageLevel
} from '../../../src/modules/ingredient-intelligence';

import {
  createQuantity
} from '../../../src/foundation/quantity';

const ORG_ID = '550e8400-e29b-41d4-a716-446655440001';
const INGREDIENT_ID = '550e8400-e29b-41d4-a716-446655440002';
const SPEC_ID = '550e8400-e29b-41d4-a716-446655440003';
const VERSION_1_ID = '550e8400-e29b-41d4-a716-446655440004';
const VERSION_2_ID = '550e8400-e29b-41d4-a716-446655440005';
const LEVEL_1_ID = '550e8400-e29b-41d4-a716-446655440006';
const LEVEL_2_ID = '550e8400-e29b-41d4-a716-446655440007';

function packageLevel(
  overrides: Partial<PurchaseSpecificationPackageLevel> = {}
): PurchaseSpecificationPackageLevel {
  return {
    id: LEVEL_1_ID as PurchaseSpecificationPackageLevel['id'],
    organizationId:
      ORG_ID as PurchaseSpecificationPackageLevel['organizationId'],
    purchaseSpecificationVersionId:
      VERSION_1_ID as PurchaseSpecificationPackageLevel[
        'purchaseSpecificationVersionId'
      ],
    ordinal: 1,
    packageLabel: 'case',
    unitsPerParent: null,
    terminalQuantity: createQuantity('100', 'ea'),
    createdAt: new Date('2026-08-19T12:00:00Z'),
    ...overrides
  };
}

describe('M2-I02 Purchase Specification domain', () => {
  test.each(['active', 'inactive', 'archived'])(
    'accepts lifecycle %s',
    (value) => {
      expect(
        isPurchaseSpecificationLifecycleStatus(value)
      ).toBe(true);
    }
  );

  test.each(['Active', 'ARCHIVED', 'deleted', '', null])(
    'rejects lifecycle %p',
    (value) => {
      expect(
        isPurchaseSpecificationLifecycleStatus(value)
      ).toBe(false);
    }
  );

  test('trims specification label', () => {
    expect(
      validateSpecificationLabel('  Frozen Shrimp  ')
    ).toEqual({
      valid: true,
      value: 'Frozen Shrimp'
    });
  });

  test('rejects blank specification label', () => {
    expect(
      validateSpecificationLabel('   ').valid
    ).toBe(false);
  });

  test('trims contextual package label', () => {
    expect(
      validatePackageLabel('  case  ')
    ).toEqual({
      valid: true,
      value: 'case'
    });
  });

  test('requires positive integer version number', () => {
    expect(
      validatePurchaseSpecificationVersionNumber(1).valid
    ).toBe(true);

    expect(
      validatePurchaseSpecificationVersionNumber(0).valid
    ).toBe(false);

    expect(
      validatePurchaseSpecificationVersionNumber(1.5).valid
    ).toBe(false);
  });

  test('requires positive integer package ordinal', () => {
    expect(validatePackageOrdinal(1).valid).toBe(true);
    expect(validatePackageOrdinal(0).valid).toBe(false);
    expect(validatePackageOrdinal(1.5).valid).toBe(false);
  });

  test.each(['1', '0.5', '6', '12.00000000'])(
    'accepts positive decimal %s',
    (value) => {
      expect(isPositiveDecimalString(value)).toBe(true);
      expect(validateUnitsPerParent(value).valid).toBe(true);
    }
  );

  test.each(['0', '-1', '-0.5', '', 'abc', 1])(
    'rejects non-positive or invalid decimal %p',
    (value) => {
      expect(isPositiveDecimalString(value)).toBe(false);
      expect(validateUnitsPerParent(value).valid).toBe(false);
    }
  );

  test('accepts active Purchase Specification', () => {
    expect(
      isPurchaseSpecification({
        id: SPEC_ID,
        organizationId: ORG_ID,
        ingredientId: INGREDIENT_ID,
        lifecycleStatus: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null
      })
    ).toBe(true);
  });

  test('requires archivedAt for archived specification', () => {
    expect(
      isPurchaseSpecification({
        id: SPEC_ID,
        organizationId: ORG_ID,
        ingredientId: INGREDIENT_ID,
        lifecycleStatus: 'archived',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null
      })
    ).toBe(false);
  });

  test('accepts version 1 without supersedes ID', () => {
    expect(
      isPurchaseSpecificationVersion({
        id: VERSION_1_ID,
        organizationId: ORG_ID,
        purchaseSpecificationId: SPEC_ID,
        versionNumber: 1,
        specificationLabel: '6 x 5 lb Bags',
        effectiveFrom: new Date(),
        supersedesVersionId: null,
        createdAt: new Date()
      })
    ).toBe(true);
  });

  test('accepts version 2 with supersedes ID', () => {
    expect(
      isPurchaseSpecificationVersion({
        id: VERSION_2_ID,
        organizationId: ORG_ID,
        purchaseSpecificationId: SPEC_ID,
        versionNumber: 2,
        specificationLabel: '4 x 5 lb Bags',
        effectiveFrom: new Date(),
        supersedesVersionId: VERSION_1_ID,
        createdAt: new Date()
      })
    ).toBe(true);
  });

  test('accepts one-level canonical count package', () => {
    const result =
      validatePurchaseSpecificationPackageStructure(
        [
          packageLevel({
            packageLabel: 'case',
            terminalQuantity: createQuantity('100', 'ea')
          })
        ],
        'ea'
      );

    expect(result.valid).toBe(true);
  });

  test('accepts case to bag to canonical grams', () => {
    const levels: PurchaseSpecificationPackageLevel[] = [
      packageLevel({
        ordinal: 1,
        packageLabel: 'case',
        unitsPerParent: null,
        terminalQuantity: null
      }),
      packageLevel({
        id:
          LEVEL_2_ID as PurchaseSpecificationPackageLevel['id'],
        ordinal: 2,
        packageLabel: 'bag',
        unitsPerParent: '6',
        terminalQuantity: createQuantity(
          '2267.96185',
          'g'
        )
      })
    ];

    expect(
      validatePurchaseSpecificationPackageStructure(
        levels,
        'g'
      ).valid
    ).toBe(true);
  });

  test('requires contiguous package ordinals', () => {
    const levels: PurchaseSpecificationPackageLevel[] = [
      packageLevel({
        ordinal: 1,
        terminalQuantity: null
      }),
      packageLevel({
        id:
          LEVEL_2_ID as PurchaseSpecificationPackageLevel['id'],
        ordinal: 3,
        packageLabel: 'bag',
        unitsPerParent: '6',
        terminalQuantity: createQuantity('100', 'g')
      })
    ];

    expect(
      validatePurchaseSpecificationPackageStructure(
        levels,
        'g'
      ).valid
    ).toBe(false);
  });

  test('first level cannot define unitsPerParent', () => {
    expect(
      validatePurchaseSpecificationPackageStructure(
        [
          packageLevel({
            unitsPerParent: '6',
            terminalQuantity: createQuantity('100', 'g')
          })
        ],
        'g'
      ).valid
    ).toBe(false);
  });

  test('later package level requires unitsPerParent', () => {
    const levels: PurchaseSpecificationPackageLevel[] = [
      packageLevel({
        terminalQuantity: null
      }),
      packageLevel({
        id:
          LEVEL_2_ID as PurchaseSpecificationPackageLevel['id'],
        ordinal: 2,
        packageLabel: 'bag',
        unitsPerParent: null,
        terminalQuantity: createQuantity('100', 'g')
      })
    ];

    expect(
      validatePurchaseSpecificationPackageStructure(
        levels,
        'g'
      ).valid
    ).toBe(false);
  });

  test('only final package level can hold terminal quantity', () => {
    const levels: PurchaseSpecificationPackageLevel[] = [
      packageLevel({
        terminalQuantity: createQuantity('50', 'g')
      }),
      packageLevel({
        id:
          LEVEL_2_ID as PurchaseSpecificationPackageLevel['id'],
        ordinal: 2,
        packageLabel: 'bag',
        unitsPerParent: '6',
        terminalQuantity: createQuantity('100', 'g')
      })
    ];

    expect(
      validatePurchaseSpecificationPackageStructure(
        levels,
        'g'
      ).valid
    ).toBe(false);
  });

  test('terminal quantity must match Ingredient canonical unit', () => {
    expect(
      validatePurchaseSpecificationPackageStructure(
        [
          packageLevel({
            terminalQuantity:
              createQuantity('3785.411784', 'mL')
          })
        ],
        'g'
      ).valid
    ).toBe(false);
  });

  test('rejects noncanonical oz as Quantity unit', () => {
    expect(() =>
      createQuantity('5', 'oz' as never)
    ).toThrow(
      'Quantity unit must be one of: g, mL, ea.'
    );
  });

  test('rejects contextual case as Quantity unit', () => {
    expect(() =>
      createQuantity('1', 'case' as never)
    ).toThrow(
      'Quantity unit must be one of: g, mL, ea.'
    );
  });
});
