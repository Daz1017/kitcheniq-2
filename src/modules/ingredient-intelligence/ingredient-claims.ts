import {
  type EntityId,
  type UUID,
  isUUIDv4
} from '../../foundation/identifiers';
import type {
  ValueStateKind
} from '../../foundation/value-state';

export type IngredientClaimDefinitionId =
  EntityId<'ingredient_claim_definition'>;

export type IngredientClaimAssertionId =
  EntityId<'ingredient_claim_assertion'>;

export type IngredientClaimDefinitionLifecycleStatus =
  'active' | 'inactive' | 'archived';

export type IngredientClaimValueState =
  ValueStateKind;

export interface IngredientClaimDefinition {
  readonly id: IngredientClaimDefinitionId;
  readonly organizationId: UUID;
  readonly code: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly lifecycleStatus:
    IngredientClaimDefinitionLifecycleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

export interface IngredientClaimAssertion {
  readonly id: IngredientClaimAssertionId;
  readonly organizationId: UUID;
  readonly ingredientId: EntityId<'ingredient'>;
  readonly claimDefinitionId:
    IngredientClaimDefinitionId;
  readonly valueState: IngredientClaimValueState;
  readonly booleanValue: boolean | null;
  readonly effectiveFrom: Date;
  readonly createdAt: Date;
}

export function isIngredientClaimDefinitionLifecycleStatus(
  value: unknown
): value is IngredientClaimDefinitionLifecycleStatus {
  return (
    value === 'active'
    || value === 'inactive'
    || value === 'archived'
  );
}

export function isIngredientClaimValueState(
  value: unknown
): value is IngredientClaimValueState {
  return (
    value === 'known'
    || value === 'unknown'
    || value === 'not_applicable'
  );
}

export function validateIngredientClaimCode(
  input: unknown
):
  | { valid: true; value: string }
  | { valid: false; error: string } {
  if (typeof input !== 'string') {
    return {
      valid: false,
      error: 'Claim code must be a string'
    };
  }

  const trimmed = input.trim();

  if (trimmed === '') {
    return {
      valid: false,
      error: 'Claim code must not be empty'
    };
  }

  return {
    valid: true,
    value: trimmed
  };
}

export function validateIngredientClaimDisplayName(
  input: unknown
):
  | { valid: true; value: string }
  | { valid: false; error: string } {
  if (typeof input !== 'string') {
    return {
      valid: false,
      error: 'Claim display name must be a string'
    };
  }

  const trimmed = input.trim();

  if (trimmed === '') {
    return {
      valid: false,
      error: 'Claim display name must not be empty'
    };
  }

  return {
    valid: true,
    value: trimmed
  };
}

export function validateIngredientClaimValue(
  valueState: unknown,
  booleanValue: unknown
):
  | {
      valid: true;
      valueState: IngredientClaimValueState;
      booleanValue: boolean | null;
    }
  | { valid: false; error: string } {
  if (!isIngredientClaimValueState(valueState)) {
    return {
      valid: false,
      error: 'Claim value state is invalid'
    };
  }

  if (valueState === 'known') {
    if (typeof booleanValue !== 'boolean') {
      return {
        valid: false,
        error: 'Known claim state requires a boolean value'
      };
    }

    return {
      valid: true,
      valueState,
      booleanValue
    };
  }

  if (booleanValue !== null) {
    return {
      valid: false,
      error:
        'Unknown or not-applicable claim state requires null value'
    };
  }

  return {
    valid: true,
    valueState,
    booleanValue: null
  };
}

export function isIngredientClaimAssertion(
  value: unknown
): value is IngredientClaimAssertion {
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
    || typeof candidate.ingredientId !== 'string'
    || !isUUIDv4(candidate.ingredientId)
    || typeof candidate.claimDefinitionId !== 'string'
    || !isUUIDv4(candidate.claimDefinitionId)
    || !(candidate.effectiveFrom instanceof Date)
    || !(candidate.createdAt instanceof Date)
  ) {
    return false;
  }

  return validateIngredientClaimValue(
    candidate.valueState,
    candidate.booleanValue
  ).valid;
}
