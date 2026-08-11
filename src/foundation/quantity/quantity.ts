import { parseDecimal, isDecimal } from '../decimal';
import type { DecimalString } from '../decimal/decimal';
import {
  type CanonicalUnitCode,
  type Dimension,
  dimensionForCanonicalUnit,
  isCanonicalUnitCode
} from '../units';

export interface Quantity {
  readonly value: DecimalString;
  readonly unit: CanonicalUnitCode;
}

export function createQuantity(value: unknown, unit: unknown): Quantity {
  if (!isDecimal(value)) {
    throw new Error('Quantity value must be a valid decimal string.');
  }

  if (!isCanonicalUnitCode(unit)) {
    throw new Error('Quantity unit must be one of: g, mL, ea.');
  }

  return {
    value: parseDecimal(value),
    unit
  };
}

export function isQuantity(value: unknown): value is Quantity {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.value !== 'string' || !isDecimal(candidate.value)) {
    return false;
  }

  if (typeof candidate.unit !== 'string' || !isCanonicalUnitCode(candidate.unit)) {
    return false;
  }

  return !('dimension' in candidate);
}

export function dimensionOfQuantity(quantity: Quantity): Dimension {
  return dimensionForCanonicalUnit(quantity.unit);
}
