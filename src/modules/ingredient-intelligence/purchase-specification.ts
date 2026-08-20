import {
  type EntityId,
  type UUID,
  isUUIDv4
} from '../../foundation/identifiers';
import {
  type CanonicalUnitCode,
  isCanonicalUnitCode
} from '../../foundation/units';
import {
  isDecimal,
  parseDecimal
} from '../../foundation/decimal';
import type {
  DecimalString
} from '../../foundation/decimal/decimal';
import {
  type Quantity,
  isQuantity
} from '../../foundation/quantity';

/**
 * M2-I02 Purchase Specification + Package Structure domain.
 *
 * This module owns contextual commercial package structure while preserving
 * Foundation canonical physical truth in g / mL / ea.
 *
 * It intentionally does NOT define generic lb/oz/kg/L/cup/gal conversions.
 */

export type PurchaseSpecificationId =
  EntityId<'ingredient_purchase_specification'>;

export type PurchaseSpecificationVersionId =
  EntityId<'ingredient_purchase_specification_version'>;

export type PurchaseSpecificationPackageLevelId =
  EntityId<'ingredient_purchase_specification_package_level'>;

export type PurchaseSpecificationLifecycleStatus =
  | 'active'
  | 'inactive'
  | 'archived';

export interface PurchaseSpecification {
  readonly id: PurchaseSpecificationId;
  readonly organizationId: UUID;
  readonly ingredientId: EntityId<'ingredient'>;
  readonly lifecycleStatus: PurchaseSpecificationLifecycleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

export interface PurchaseSpecificationVersion {
  readonly id: PurchaseSpecificationVersionId;
  readonly organizationId: UUID;
  readonly purchaseSpecificationId: PurchaseSpecificationId;
  readonly versionNumber: number;
  readonly specificationLabel: string;
  readonly effectiveFrom: Date;
  readonly supersedesVersionId: PurchaseSpecificationVersionId | null;
  readonly createdAt: Date;
}

export interface PurchaseSpecificationPackageLevel {
  readonly id: PurchaseSpecificationPackageLevelId;
  readonly organizationId: UUID;
  readonly purchaseSpecificationVersionId: PurchaseSpecificationVersionId;

  /**
   * 1-based hierarchy position.
   *
   * Example:
   * 1 = case
   * 2 = bag
   */
  readonly ordinal: number;

  /**
   * Contextual commercial label only.
   *
   * Examples:
   * case, bag, bottle, tray
   *
   * This is NOT a Foundation canonical unit.
   */
  readonly packageLabel: string;

  /**
   * Number of this level contained by one immediately preceding parent level.
   *
   * Must be null for ordinal 1.
   * Must be positive for ordinal > 1.
   */
  readonly unitsPerParent: DecimalString | null;

  /**
   * Present only on the final package level.
   *
   * The Quantity unit must equal the owning Ingredient base canonical unit.
   */
  readonly terminalQuantity: Quantity | null;

  readonly createdAt: Date;
}

export type ValidationResult<T> =
  | { readonly valid: true; readonly value: T }
  | { readonly valid: false; readonly error: string };

export function isPurchaseSpecificationLifecycleStatus(
  value: unknown
): value is PurchaseSpecificationLifecycleStatus {
  return (
    value === 'active'
    || value === 'inactive'
    || value === 'archived'
  );
}

export function validatePurchaseSpecificationLifecycleStatus(
  value: unknown
): ValidationResult<PurchaseSpecificationLifecycleStatus> {
  if (!isPurchaseSpecificationLifecycleStatus(value)) {
    return {
      valid: false,
      error:
        'Purchase Specification lifecycle status must be one of: active, inactive, archived'
    };
  }

  return { valid: true, value };
}

export function validateSpecificationLabel(
  value: unknown
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: 'Specification label must be a string'
    };
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return {
      valid: false,
      error: 'Specification label must not be empty or whitespace-only'
    };
  }

  return { valid: true, value: trimmed };
}

export function validatePackageLabel(
  value: unknown
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: 'Package label must be a string'
    };
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return {
      valid: false,
      error: 'Package label must not be empty or whitespace-only'
    };
  }

  return { valid: true, value: trimmed };
}

export function validatePurchaseSpecificationVersionNumber(
  value: unknown
): ValidationResult<number> {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 1
  ) {
    return {
      valid: false,
      error: 'Purchase Specification version number must be a positive integer'
    };
  }

  return { valid: true, value };
}

export function validatePackageOrdinal(
  value: unknown
): ValidationResult<number> {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 1
  ) {
    return {
      valid: false,
      error: 'Package ordinal must be a positive integer'
    };
  }

  return { valid: true, value };
}

/**
 * Tests whether a Foundation decimal string is strictly greater than zero
 * without converting it to JavaScript number.
 */
export function isPositiveDecimalString(
  value: unknown
): value is DecimalString {
  if (!isDecimal(value)) {
    return false;
  }

  const normalized = parseDecimal(value);

  return normalized !== '0' && !normalized.startsWith('-');
}

export function validateUnitsPerParent(
  value: unknown
): ValidationResult<DecimalString> {
  if (!isPositiveDecimalString(value)) {
    return {
      valid: false,
      error: 'unitsPerParent must be a positive decimal string'
    };
  }

  return {
    valid: true,
    value: parseDecimal(value)
  };
}

export function isPurchaseSpecification(
  value: unknown
): value is PurchaseSpecification {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string'
    || !isUUIDv4(candidate.id)
    || typeof candidate.organizationId !== 'string'
    || !isUUIDv4(candidate.organizationId)
    || typeof candidate.ingredientId !== 'string'
    || !isUUIDv4(candidate.ingredientId)
    || !isPurchaseSpecificationLifecycleStatus(
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

export function isPurchaseSpecificationVersion(
  value: unknown
): value is PurchaseSpecificationVersion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string'
    || !isUUIDv4(candidate.id)
    || typeof candidate.organizationId !== 'string'
    || !isUUIDv4(candidate.organizationId)
    || typeof candidate.purchaseSpecificationId !== 'string'
    || !isUUIDv4(candidate.purchaseSpecificationId)
    || !validatePurchaseSpecificationVersionNumber(
      candidate.versionNumber
    ).valid
    || !validateSpecificationLabel(candidate.specificationLabel).valid
    || !(candidate.effectiveFrom instanceof Date)
    || !(candidate.createdAt instanceof Date)
  ) {
    return false;
  }

  if (
    candidate.supersedesVersionId !== null
    && (
      typeof candidate.supersedesVersionId !== 'string'
      || !isUUIDv4(candidate.supersedesVersionId)
    )
  ) {
    return false;
  }

  if (
    candidate.versionNumber === 1
    && candidate.supersedesVersionId !== null
  ) {
    return false;
  }

  if (
    typeof candidate.versionNumber === 'number'
    && candidate.versionNumber > 1
    && candidate.supersedesVersionId === null
  ) {
    return false;
  }

  return true;
}

export function isPurchaseSpecificationPackageLevel(
  value: unknown
): value is PurchaseSpecificationPackageLevel {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string'
    || !isUUIDv4(candidate.id)
    || typeof candidate.organizationId !== 'string'
    || !isUUIDv4(candidate.organizationId)
    || typeof candidate.purchaseSpecificationVersionId !== 'string'
    || !isUUIDv4(candidate.purchaseSpecificationVersionId)
    || !validatePackageOrdinal(candidate.ordinal).valid
    || !validatePackageLabel(candidate.packageLabel).valid
    || !(candidate.createdAt instanceof Date)
  ) {
    return false;
  }

  if (
    candidate.unitsPerParent !== null
    && !isPositiveDecimalString(candidate.unitsPerParent)
  ) {
    return false;
  }

  if (
    candidate.terminalQuantity !== null
    && !isQuantity(candidate.terminalQuantity)
  ) {
    return false;
  }

  return true;
}

/**
 * Validates one complete immutable package hierarchy.
 *
 * Rules:
 * - at least one level;
 * - ordinals are exactly 1..N;
 * - first level has unitsPerParent = null;
 * - every later level has positive unitsPerParent;
 * - only final level has terminalQuantity;
 * - final terminal quantity is positive;
 * - final terminal unit equals Ingredient base canonical unit.
 */
export function validatePurchaseSpecificationPackageStructure(
  levels: readonly PurchaseSpecificationPackageLevel[],
  ingredientBaseCanonicalUnit: CanonicalUnitCode
): ValidationResult<readonly PurchaseSpecificationPackageLevel[]> {
  if (!isCanonicalUnitCode(ingredientBaseCanonicalUnit)) {
    return {
      valid: false,
      error: 'Ingredient base canonical unit must be one of: g, mL, ea'
    };
  }

  if (levels.length === 0) {
    return {
      valid: false,
      error: 'Purchase Specification requires at least one package level'
    };
  }

  for (let index = 0; index < levels.length; index += 1) {
    const level = levels[index];
    const expectedOrdinal = index + 1;
    const isFirst = index === 0;
    const isFinal = index === levels.length - 1;

    if (!isPurchaseSpecificationPackageLevel(level)) {
      return {
        valid: false,
        error: `Package level ${expectedOrdinal} is invalid`
      };
    }

    if (level.ordinal !== expectedOrdinal) {
      return {
        valid: false,
        error: 'Package level ordinals must be contiguous starting at 1'
      };
    }

    if (isFirst) {
      if (level.unitsPerParent !== null) {
        return {
          valid: false,
          error: 'First package level must not define unitsPerParent'
        };
      }
    } else if (
      level.unitsPerParent === null
      || !isPositiveDecimalString(level.unitsPerParent)
    ) {
      return {
        valid: false,
        error:
          'Package levels after ordinal 1 require positive unitsPerParent'
      };
    }

    if (!isFinal && level.terminalQuantity !== null) {
      return {
        valid: false,
        error: 'Only the final package level may define terminalQuantity'
      };
    }

    if (isFinal) {
      if (
        level.terminalQuantity === null
        || !isQuantity(level.terminalQuantity)
        || !isPositiveDecimalString(level.terminalQuantity.value)
      ) {
        return {
          valid: false,
          error:
            'Final package level requires a positive canonical terminal quantity'
        };
      }

      if (
        level.terminalQuantity.unit
        !== ingredientBaseCanonicalUnit
      ) {
        return {
          valid: false,
          error:
            'Terminal quantity unit must match Ingredient base canonical unit'
        };
      }
    }
  }

  return {
    valid: true,
    value: levels
  };
}
