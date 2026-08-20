import {
  type EntityId,
  type UUID,
  isUUIDv4
} from '../../foundation/identifiers';

import {
  type CurrencyCode,
  isCurrencyCode
} from '../../foundation/currency';

import {
  createMoney,
  type Money
} from '../../foundation/money';

import {
  createKnownValueState,
  createUnknownValueState,
  type KnownValueState,
  type UnknownValueState
} from '../../foundation/value-state';

import {
  parseDecimal
} from '../../foundation/decimal';

import type {
  DecimalString
} from '../../foundation/decimal/decimal';

import type {
  PurchaseSpecificationId
} from './purchase-specification';

import type {
  SupplierProductId
} from './supplier-product-mapping';

/**
 * M2-I04 Ingredient Cost State + Cost History domain.
 *
 * Cost truth belongs to Purchase Specification history.
 * This does not define Ingredient preferred/current cost.
 */

export type PurchaseSpecificationCostObservationId =
  EntityId<'ingredient_purchase_specification_cost_observation'>;

export type PurchaseSpecificationCostValueStateKind =
  | 'known'
  | 'unknown';

export type PurchaseSpecificationCostSourceKind =
  | 'manual'
  | 'supplier_product';

interface PurchaseSpecificationCostObservationBase {
  readonly id: PurchaseSpecificationCostObservationId;
  readonly organizationId: UUID;
  readonly purchaseSpecificationId: PurchaseSpecificationId;
  readonly sourceKind: PurchaseSpecificationCostSourceKind;
  readonly supplierProductId: SupplierProductId | null;
  readonly effectiveFrom: Date;
  readonly createdAt: Date;
}

export interface KnownPurchaseSpecificationCostObservation
  extends PurchaseSpecificationCostObservationBase {
  readonly valueState: 'known';
  readonly unitCost: DecimalString;
  readonly currency: CurrencyCode;
}

export interface UnknownPurchaseSpecificationCostObservation
  extends PurchaseSpecificationCostObservationBase {
  readonly valueState: 'unknown';
  readonly unitCost: null;
  readonly currency: null;
}

export type PurchaseSpecificationCostObservation =
  | KnownPurchaseSpecificationCostObservation
  | UnknownPurchaseSpecificationCostObservation;

export type PurchaseSpecificationEffectiveCostState =
  | KnownValueState<Money>
  | UnknownValueState;

export type CostValidationResult<T> =
  | {
      readonly valid: true;
      readonly value: T;
    }
  | {
      readonly valid: false;
      readonly error: string;
    };

export function isPurchaseSpecificationCostValueStateKind(
  value: unknown
): value is PurchaseSpecificationCostValueStateKind {
  return value === 'known' || value === 'unknown';
}

export function isPurchaseSpecificationCostSourceKind(
  value: unknown
): value is PurchaseSpecificationCostSourceKind {
  return (
    value === 'manual'
    || value === 'supplier_product'
  );
}

export function validatePurchaseSpecificationUnitCost(
  value: unknown
): CostValidationResult<DecimalString> {
  let normalized: DecimalString;

  try {
    normalized = parseDecimal(value);
  } catch {
    return {
      valid: false,
      error:
        'Purchase Specification unit cost must be a valid decimal string'
    };
  }

  if (normalized.startsWith('-')) {
    return {
      valid: false,
      error:
        'Purchase Specification unit cost cannot be negative'
    };
  }

  return {
    valid: true,
    value: normalized
  };
}

function isValidDate(
  value: unknown
): value is Date {
  return (
    value instanceof Date
    && !Number.isNaN(value.getTime())
  );
}


export function isPurchaseSpecificationCostObservation(
  value: unknown
): value is PurchaseSpecificationCostObservation {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
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
    || typeof candidate.purchaseSpecificationId !== 'string'
    || !isUUIDv4(candidate.purchaseSpecificationId)
    || !isPurchaseSpecificationCostValueStateKind(
      candidate.valueState
    )
    || !isPurchaseSpecificationCostSourceKind(
      candidate.sourceKind
    )
    || !isValidDate(candidate.effectiveFrom)
    || !isValidDate(candidate.createdAt)
  ) {
    return false;
  }

  if (candidate.sourceKind === 'manual') {
    if (candidate.supplierProductId !== null) {
      return false;
    }
  } else {
    if (
      typeof candidate.supplierProductId !== 'string'
      || !isUUIDv4(candidate.supplierProductId)
    ) {
      return false;
    }
  }

  if (candidate.valueState === 'known') {
    const cost =
      validatePurchaseSpecificationUnitCost(
        candidate.unitCost
      );

    return (
      cost.valid
      && isCurrencyCode(candidate.currency)
    );
  }

  return (
    candidate.unitCost === null
    && candidate.currency === null
  );
}

/**
 * Validates a complete history for one Purchase Specification.
 *
 * Historical observations may be supplied in any order. Backfilled history is
 * therefore valid. The only temporal uniqueness requirement is one
 * authoritative observation per exact effective instant.
 */
export function validatePurchaseSpecificationCostTimeline(
  observations:
    readonly PurchaseSpecificationCostObservation[]
): CostValidationResult<
  readonly PurchaseSpecificationCostObservation[]
> {
  if (observations.length === 0) {
    return {
      valid: true,
      value: observations
    };
  }

  const first = observations[0];

  if (
    !first
    || !isPurchaseSpecificationCostObservation(first)
  ) {
    return {
      valid: false,
      error:
        'Purchase Specification cost history contains an invalid observation'
    };
  }

  const organizationId =
    first.organizationId;

  const purchaseSpecificationId =
    first.purchaseSpecificationId;

  const effectiveInstants =
    new Set<number>();

  for (const observation of observations) {
    if (
      !isPurchaseSpecificationCostObservation(
        observation
      )
    ) {
      return {
        valid: false,
        error:
          'Purchase Specification cost history contains an invalid observation'
      };
    }

    if (
      observation.organizationId
        !== organizationId
      || observation.purchaseSpecificationId
        !== purchaseSpecificationId
    ) {
      return {
        valid: false,
        error:
          'Cost history must belong to one organization and one Purchase Specification'
      };
    }

    const effectiveTime =
      observation.effectiveFrom.getTime();

    if (
      effectiveInstants.has(effectiveTime)
    ) {
      return {
        valid: false,
        error:
          'Purchase Specification cost history cannot contain duplicate effective instants'
      };
    }

    effectiveInstants.add(effectiveTime);
  }

  return {
    valid: true,
    value: observations
  };
}

/**
 * Resolves effective cost as-of a specific instant.
 *
 * Selection is based on effective time, not insertion order.
 */
export function resolveEffectivePurchaseSpecificationCostObservation(
  observations:
    readonly PurchaseSpecificationCostObservation[],
  asOf: Date
): CostValidationResult<
  PurchaseSpecificationCostObservation | null
> {
  if (!isValidDate(asOf)) {
    return {
      valid: false,
      error:
        'Effective cost as-of time must be a valid Date'
    };
  }

  const timeline =
    validatePurchaseSpecificationCostTimeline(
      observations
    );

  if (!timeline.valid) {
    return timeline;
  }

  let effective:
    PurchaseSpecificationCostObservation
    | null = null;

  for (const observation of observations) {
    if (
      observation.effectiveFrom.getTime()
      > asOf.getTime()
    ) {
      continue;
    }

    if (
      effective === null
      || observation.effectiveFrom.getTime()
        > effective.effectiveFrom.getTime()
    ) {
      effective = observation;
    }
  }

  return {
    valid: true,
    value: effective
  };
}

/**
 * Projects an observation onto the frozen Foundation ValueState + Money
 * representation.
 *
 * `not_applicable` is intentionally impossible for M2-I04 cost state.
 */
export function projectPurchaseSpecificationCostState(
  observation: PurchaseSpecificationCostObservation
): CostValidationResult<
  PurchaseSpecificationEffectiveCostState
> {
  if (
    !isPurchaseSpecificationCostObservation(
      observation
    )
  ) {
    return {
      valid: false,
      error:
        'Cannot project invalid Purchase Specification cost observation'
    };
  }

  if (observation.valueState === 'unknown') {
    return {
      valid: true,
      value: createUnknownValueState()
    };
  }

  return {
    valid: true,
    value: createKnownValueState(
      createMoney(
        observation.unitCost,
        observation.currency
      )
    )
  };
}
