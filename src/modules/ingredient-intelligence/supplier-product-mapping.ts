import {
  type EntityId,
  type UUID,
  isUUIDv4
} from '../../foundation/identifiers';

import {
  type ExternalIdentifierRef,
  type ExternalIdentifierValue,
  type SourceNamespace,
  createExternalIdentifierRef,
  isExternalIdentifierValue,
  isSourceNamespace
} from '../../foundation/external-identifiers';

/**
 * M2-I03 Supplier Product Mapping + External Identity domain.
 *
 * A Supplier Product is an M2-owned stable identity representing an external
 * commercial product reference. It is NOT Supplier master data.
 *
 * Supplier master identity remains outside Module 2.
 */
export type SupplierProductId =
  EntityId<'ingredient_supplier_product'>;

export type SupplierProductPurchaseSpecificationMappingId =
  EntityId<'ingredient_supplier_product_purchase_specification_mapping'>;

export type SupplierProductLifecycleStatus =
  | 'active'
  | 'inactive'
  | 'archived';

export interface IngredientSupplierProduct {
  readonly id: SupplierProductId;
  readonly organizationId: UUID;
  readonly sourceNamespace: SourceNamespace;
  readonly externalId: ExternalIdentifierValue;
  readonly lifecycleStatus: SupplierProductLifecycleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

export interface SupplierProductPurchaseSpecificationMapping {
  readonly id: SupplierProductPurchaseSpecificationMappingId;
  readonly organizationId: UUID;
  readonly supplierProductId: SupplierProductId;
  readonly purchaseSpecificationId:
    EntityId<'ingredient_purchase_specification'>;
  readonly versionNumber: number;
  readonly effectiveFrom: Date;
  readonly supersedesMappingId:
    SupplierProductPurchaseSpecificationMappingId | null;
  readonly createdAt: Date;
}

export type SupplierProductValidationResult<T> =
  | {
      readonly valid: true;
      readonly value: T;
    }
  | {
      readonly valid: false;
      readonly error: string;
    };

export function isSupplierProductLifecycleStatus(
  value: unknown
): value is SupplierProductLifecycleStatus {
  return (
    value === 'active'
    || value === 'inactive'
    || value === 'archived'
  );
}

export function validateSupplierProductLifecycleStatus(
  value: unknown
): SupplierProductValidationResult<SupplierProductLifecycleStatus> {
  if (!isSupplierProductLifecycleStatus(value)) {
    return {
      valid: false,
      error:
        'Supplier Product lifecycle status must be one of: active, inactive, archived'
    };
  }

  return {
    valid: true,
    value
  };
}

export function validateSupplierProductExternalReference(
  sourceNamespace: unknown,
  externalId: unknown
): SupplierProductValidationResult<ExternalIdentifierRef> {
  if (!isSourceNamespace(sourceNamespace)) {
    return {
      valid: false,
      error:
        'Supplier Product source namespace must be a non-empty opaque string without surrounding whitespace'
    };
  }

  if (!isExternalIdentifierValue(externalId)) {
    return {
      valid: false,
      error:
        'Supplier Product external identifier must be a non-empty opaque string without surrounding whitespace'
    };
  }

  return {
    valid: true,
    value: createExternalIdentifierRef(
      sourceNamespace,
      externalId
    )
  };
}

export function validateSupplierProductMappingVersionNumber(
  value: unknown
): SupplierProductValidationResult<number> {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 1
  ) {
    return {
      valid: false,
      error:
        'Supplier Product mapping version number must be a positive integer'
    };
  }

  return {
    valid: true,
    value
  };
}

export function isIngredientSupplierProduct(
  value: unknown
): value is IngredientSupplierProduct {
  if (
    typeof value !== 'object'
    || value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string'
    || !isUUIDv4(candidate.id)
    || typeof candidate.organizationId !== 'string'
    || !isUUIDv4(candidate.organizationId)
    || !isSourceNamespace(candidate.sourceNamespace)
    || !isExternalIdentifierValue(candidate.externalId)
    || !isSupplierProductLifecycleStatus(
      candidate.lifecycleStatus
    )
    || !(candidate.createdAt instanceof Date)
    || !(candidate.updatedAt instanceof Date)
    || !(
      candidate.archivedAt === null
      || candidate.archivedAt instanceof Date
    )
  ) {
    return false;
  }

  if (
    candidate.lifecycleStatus === 'archived'
    && candidate.archivedAt === null
  ) {
    return false;
  }

  if (
    candidate.lifecycleStatus !== 'archived'
    && candidate.archivedAt !== null
  ) {
    return false;
  }

  return true;
}

export function isSupplierProductPurchaseSpecificationMapping(
  value: unknown
): value is SupplierProductPurchaseSpecificationMapping {
  if (
    typeof value !== 'object'
    || value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string'
    || !isUUIDv4(candidate.id)
    || typeof candidate.organizationId !== 'string'
    || !isUUIDv4(candidate.organizationId)
    || typeof candidate.supplierProductId !== 'string'
    || !isUUIDv4(candidate.supplierProductId)
    || typeof candidate.purchaseSpecificationId !== 'string'
    || !isUUIDv4(candidate.purchaseSpecificationId)
    || !validateSupplierProductMappingVersionNumber(
      candidate.versionNumber
    ).valid
    || !(candidate.effectiveFrom instanceof Date)
    || !(candidate.createdAt instanceof Date)
  ) {
    return false;
  }

  if (
    candidate.supersedesMappingId !== null
    && (
      typeof candidate.supersedesMappingId !== 'string'
      || !isUUIDv4(candidate.supersedesMappingId)
    )
  ) {
    return false;
  }

  if (
    candidate.versionNumber === 1
    && candidate.supersedesMappingId !== null
  ) {
    return false;
  }

  if (
    typeof candidate.versionNumber === 'number'
    && candidate.versionNumber > 1
    && candidate.supersedesMappingId === null
  ) {
    return false;
  }

  return true;
}

export function validateSupplierProductMappingChain(
  mappings:
    readonly SupplierProductPurchaseSpecificationMapping[]
): SupplierProductValidationResult<
  readonly SupplierProductPurchaseSpecificationMapping[]
> {
  if (mappings.length === 0) {
    return {
      valid: false,
      error:
        'Supplier Product mapping chain requires at least one mapping'
    };
  }

  const first = mappings[0];

  if (
    !first
    || !isSupplierProductPurchaseSpecificationMapping(first)
  ) {
    return {
      valid: false,
      error: 'Supplier Product mapping version 1 is invalid'
    };
  }

  const organizationId = first.organizationId;
  const supplierProductId = first.supplierProductId;

  for (
    let index = 0;
    index < mappings.length;
    index += 1
  ) {
    const mapping = mappings[index];
    const expectedVersion = index + 1;
    const previous =
      index === 0 ? null : mappings[index - 1];

    if (
      !mapping
      || !isSupplierProductPurchaseSpecificationMapping(
        mapping
      )
    ) {
      return {
        valid: false,
        error:
          `Supplier Product mapping version ${expectedVersion} is invalid`
      };
    }

    if (mapping.versionNumber !== expectedVersion) {
      return {
        valid: false,
        error:
          'Supplier Product mapping versions must be contiguous starting at 1'
      };
    }

    if (
      mapping.organizationId !== organizationId
      || mapping.supplierProductId !== supplierProductId
    ) {
      return {
        valid: false,
        error:
          'All mapping versions must belong to the same organization and Supplier Product'
      };
    }

    if (previous === null) {
      if (mapping.supersedesMappingId !== null) {
        return {
          valid: false,
          error:
            'Supplier Product mapping version 1 must not supersede another mapping'
        };
      }

      continue;
    }

    if (
      mapping.supersedesMappingId !== previous.id
    ) {
      return {
        valid: false,
        error:
          'Each later Supplier Product mapping must supersede the immediately preceding mapping'
      };
    }

    if (
      mapping.effectiveFrom
      <= previous.effectiveFrom
    ) {
      return {
        valid: false,
        error:
          'Supplier Product mapping effective dates must increase strictly'
      };
    }

    if (
      mapping.purchaseSpecificationId
      === previous.purchaseSpecificationId
    ) {
      return {
        valid: false,
        error:
          'A new Supplier Product mapping version must change the Purchase Specification'
      };
    }
  }

  return {
    valid: true,
    value: mappings
  };
}
