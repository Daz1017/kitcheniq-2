import {
  isIngredientSupplierProduct,
  isSupplierProductLifecycleStatus,
  isSupplierProductPurchaseSpecificationMapping,
  validateSupplierProductExternalReference,
  validateSupplierProductLifecycleStatus,
  validateSupplierProductMappingChain,
  validateSupplierProductMappingVersionNumber,
  type SupplierProductPurchaseSpecificationMapping
} from '../../../src/modules/ingredient-intelligence';

const ORG_ID =
  '550e8400-e29b-41d4-a716-446655441001';

const SUPPLIER_PRODUCT_ID =
  '550e8400-e29b-41d4-a716-446655441002';

const MAPPING_1_ID =
  '550e8400-e29b-41d4-a716-446655441003';

const MAPPING_2_ID =
  '550e8400-e29b-41d4-a716-446655441004';

const SPEC_1_ID =
  '550e8400-e29b-41d4-a716-446655441005';

const SPEC_2_ID =
  '550e8400-e29b-41d4-a716-446655441006';

function mapping(
  overrides:
    Partial<SupplierProductPurchaseSpecificationMapping>
    = {}
): SupplierProductPurchaseSpecificationMapping {
  return {
    id:
      MAPPING_1_ID as
        SupplierProductPurchaseSpecificationMapping['id'],
    organizationId:
      ORG_ID as
        SupplierProductPurchaseSpecificationMapping[
          'organizationId'
        ],
    supplierProductId:
      SUPPLIER_PRODUCT_ID as
        SupplierProductPurchaseSpecificationMapping[
          'supplierProductId'
        ],
    purchaseSpecificationId:
      SPEC_1_ID as
        SupplierProductPurchaseSpecificationMapping[
          'purchaseSpecificationId'
        ],
    versionNumber: 1,
    effectiveFrom:
      new Date('2026-08-19T12:00:00Z'),
    supersedesMappingId: null,
    createdAt:
      new Date('2026-08-19T12:00:00Z'),
    ...overrides
  };
}

describe('M2-I03 Supplier Product Mapping domain', () => {
  test.each([
    'active',
    'inactive',
    'archived'
  ])(
    'accepts lifecycle %s',
    (value) => {
      expect(
        isSupplierProductLifecycleStatus(value)
      ).toBe(true);

      expect(
        validateSupplierProductLifecycleStatus(value)
          .valid
      ).toBe(true);
    }
  );

  test.each([
    'Active',
    'deleted',
    '',
    null
  ])(
    'rejects lifecycle %p',
    (value) => {
      expect(
        isSupplierProductLifecycleStatus(value)
      ).toBe(false);
    }
  );

  test('preserves opaque external identity exactly', () => {
    const result =
      validateSupplierProductExternalReference(
        'vendor_erp',
        '00123-AbC/42'
      );

    expect(result).toEqual({
      valid: true,
      value: {
        sourceNamespace: 'vendor_erp',
        externalId: '00123-AbC/42'
      }
    });
  });

  test('does not normalize leading zeros or case', () => {
    const leading =
      validateSupplierProductExternalReference(
        'vendor',
        '00123'
      );

    const plain =
      validateSupplierProductExternalReference(
        'vendor',
        '123'
      );

    const upper =
      validateSupplierProductExternalReference(
        'vendor',
        'ABC'
      );

    const lower =
      validateSupplierProductExternalReference(
        'vendor',
        'abc'
      );

    expect(leading.valid).toBe(true);
    expect(plain.valid).toBe(true);
    expect(upper.valid).toBe(true);
    expect(lower.valid).toBe(true);

    if (
      leading.valid
      && plain.valid
      && upper.valid
      && lower.valid
    ) {
      expect(leading.value.externalId)
        .not.toBe(plain.value.externalId);

      expect(upper.value.externalId)
        .not.toBe(lower.value.externalId);
    }
  });

  test.each([
    ['', '001'],
    [' vendor', '001'],
    ['vendor ', '001'],
    ['vendor', ''],
    ['vendor', ' 001'],
    ['vendor', '001 '],
    ['vendor', 123]
  ])(
    'rejects invalid external identity %#',
    (namespace, externalId) => {
      expect(
        validateSupplierProductExternalReference(
          namespace,
          externalId
        ).valid
      ).toBe(false);
    }
  );

  test('requires positive integer mapping version', () => {
    expect(
      validateSupplierProductMappingVersionNumber(1)
        .valid
    ).toBe(true);

    expect(
      validateSupplierProductMappingVersionNumber(0)
        .valid
    ).toBe(false);

    expect(
      validateSupplierProductMappingVersionNumber(1.5)
        .valid
    ).toBe(false);
  });

  test('accepts active Supplier Product with exact external reference', () => {
    expect(
      isIngredientSupplierProduct({
        id: SUPPLIER_PRODUCT_ID,
        organizationId: ORG_ID,
        sourceNamespace: 'vendor_erp',
        externalId: '000123',
        lifecycleStatus: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null
      })
    ).toBe(true);
  });

  test('requires archivedAt when Supplier Product is archived', () => {
    expect(
      isIngredientSupplierProduct({
        id: SUPPLIER_PRODUCT_ID,
        organizationId: ORG_ID,
        sourceNamespace: 'vendor_erp',
        externalId: '000123',
        lifecycleStatus: 'archived',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null
      })
    ).toBe(false);
  });

  test('version 1 cannot supersede another mapping', () => {
    expect(
      isSupplierProductPurchaseSpecificationMapping(
        mapping({
          supersedesMappingId:
            MAPPING_2_ID as
              SupplierProductPurchaseSpecificationMapping[
                'supersedesMappingId'
              ]
        })
      )
    ).toBe(false);
  });

  test('later mapping version requires supersedes mapping', () => {
    expect(
      isSupplierProductPurchaseSpecificationMapping(
        mapping({
          versionNumber: 2,
          supersedesMappingId: null
        })
      )
    ).toBe(false);
  });

  test('accepts contiguous immutable mapping chain', () => {
    const first = mapping();

    const second = mapping({
      id:
        MAPPING_2_ID as
          SupplierProductPurchaseSpecificationMapping['id'],
      purchaseSpecificationId:
        SPEC_2_ID as
          SupplierProductPurchaseSpecificationMapping[
            'purchaseSpecificationId'
          ],
      versionNumber: 2,
      effectiveFrom:
        new Date('2026-08-20T12:00:00Z'),
      supersedesMappingId: first.id,
      createdAt:
        new Date('2026-08-20T12:00:00Z')
    });

    expect(
      validateSupplierProductMappingChain([
        first,
        second
      ]).valid
    ).toBe(true);
  });

  test('rejects noncontiguous mapping versions', () => {
    const first = mapping();

    const third = mapping({
      id:
        MAPPING_2_ID as
          SupplierProductPurchaseSpecificationMapping['id'],
      purchaseSpecificationId:
        SPEC_2_ID as
          SupplierProductPurchaseSpecificationMapping[
            'purchaseSpecificationId'
          ],
      versionNumber: 3,
      effectiveFrom:
        new Date('2026-08-20T12:00:00Z'),
      supersedesMappingId: first.id
    });

    expect(
      validateSupplierProductMappingChain([
        first,
        third
      ]).valid
    ).toBe(false);
  });

  test('later mapping must supersede immediate predecessor', () => {
    const first = mapping();

    const second = mapping({
      id:
        MAPPING_2_ID as
          SupplierProductPurchaseSpecificationMapping['id'],
      purchaseSpecificationId:
        SPEC_2_ID as
          SupplierProductPurchaseSpecificationMapping[
            'purchaseSpecificationId'
          ],
      versionNumber: 2,
      effectiveFrom:
        new Date('2026-08-20T12:00:00Z'),
      supersedesMappingId: '550e8400-e29b-41d4-a716-446655441099' as SupplierProductPurchaseSpecificationMapping['supersedesMappingId']
    });

    expect(
      validateSupplierProductMappingChain([
        first,
        second
      ]).valid
    ).toBe(false);
  });

  test('mapping effective dates must increase strictly', () => {
    const first = mapping();

    const second = mapping({
      id:
        MAPPING_2_ID as
          SupplierProductPurchaseSpecificationMapping['id'],
      purchaseSpecificationId:
        SPEC_2_ID as
          SupplierProductPurchaseSpecificationMapping[
            'purchaseSpecificationId'
          ],
      versionNumber: 2,
      effectiveFrom:
        new Date('2026-08-19T12:00:00Z'),
      supersedesMappingId: first.id
    });

    expect(
      validateSupplierProductMappingChain([
        first,
        second
      ]).valid
    ).toBe(false);
  });

  test('new mapping version must change Purchase Specification', () => {
    const first = mapping();

    const second = mapping({
      id:
        MAPPING_2_ID as
          SupplierProductPurchaseSpecificationMapping['id'],
      versionNumber: 2,
      effectiveFrom:
        new Date('2026-08-20T12:00:00Z'),
      supersedesMappingId: first.id
    });

    expect(
      validateSupplierProductMappingChain([
        first,
        second
      ]).valid
    ).toBe(false);
  });

  test('mapping chain cannot cross organizations', () => {
    const first = mapping();

    const second = mapping({
      id:
        MAPPING_2_ID as
          SupplierProductPurchaseSpecificationMapping['id'],
      organizationId: '550e8400-e29b-41d4-a716-446655441099' as SupplierProductPurchaseSpecificationMapping['organizationId'],
      purchaseSpecificationId:
        SPEC_2_ID as
          SupplierProductPurchaseSpecificationMapping[
            'purchaseSpecificationId'
          ],
      versionNumber: 2,
      effectiveFrom:
        new Date('2026-08-20T12:00:00Z'),
      supersedesMappingId: first.id
    });

    expect(
      validateSupplierProductMappingChain([
        first,
        second
      ]).valid
    ).toBe(false);
  });

  test('domain contains no Supplier master identity requirement', () => {
    const product = {
      id: SUPPLIER_PRODUCT_ID,
      organizationId: ORG_ID,
      sourceNamespace: 'vendor_erp',
      externalId: '000123',
      lifecycleStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null
    };

    expect(
      isIngredientSupplierProduct(product)
    ).toBe(true);

    expect(product).not.toHaveProperty('supplierId');
    expect(product).not.toHaveProperty('supplierName');
    expect(product).not.toHaveProperty('vendorId');
  });
});
