import {
  type EntityId,
  type UUID,
  isUUIDv4
} from '../../foundation/identifiers';
import type {
  ValueStateKind
} from '../../foundation/value-state';

export type IngredientHandlingDefinitionId =
  EntityId<'ingredient_handling_definition'>;

export type IngredientHandlingInstructionId =
  EntityId<'ingredient_handling_instruction'>;

export type IngredientHandlingDefinitionLifecycleStatus =
  'active' | 'inactive' | 'archived';

export type IngredientHandlingValueState =
  ValueStateKind;

export interface IngredientHandlingDefinition {
  readonly id: IngredientHandlingDefinitionId;
  readonly organizationId: UUID;
  readonly code: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly lifecycleStatus:
    IngredientHandlingDefinitionLifecycleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

export interface IngredientHandlingInstruction {
  readonly id: IngredientHandlingInstructionId;
  readonly organizationId: UUID;
  readonly ingredientId: EntityId<'ingredient'>;
  readonly handlingDefinitionId:
    IngredientHandlingDefinitionId;
  readonly valueState: IngredientHandlingValueState;
  readonly instructionText: string | null;
  readonly effectiveFrom: Date;
  readonly createdAt: Date;
}

export function isIngredientHandlingDefinitionLifecycleStatus(
  value: unknown
): value is IngredientHandlingDefinitionLifecycleStatus {
  return (
    value === 'active'
    || value === 'inactive'
    || value === 'archived'
  );
}

export function isIngredientHandlingValueState(
  value: unknown
): value is IngredientHandlingValueState {
  return (
    value === 'known'
    || value === 'unknown'
    || value === 'not_applicable'
  );
}

export function validateIngredientHandlingCode(
  input: unknown
):
  | { valid: true; value: string }
  | { valid: false; error: string } {
  if (typeof input !== 'string') {
    return {
      valid: false,
      error: 'Handling code must be a string'
    };
  }

  const trimmed = input.trim();

  if (trimmed === '') {
    return {
      valid: false,
      error: 'Handling code must not be empty'
    };
  }

  return {
    valid: true,
    value: trimmed
  };
}

export function validateIngredientHandlingDisplayName(
  input: unknown
):
  | { valid: true; value: string }
  | { valid: false; error: string } {
  if (typeof input !== 'string') {
    return {
      valid: false,
      error: 'Handling display name must be a string'
    };
  }

  const trimmed = input.trim();

  if (trimmed === '') {
    return {
      valid: false,
      error: 'Handling display name must not be empty'
    };
  }

  return {
    valid: true,
    value: trimmed
  };
}

export function validateIngredientHandlingValue(
  valueState: unknown,
  instructionText: unknown
):
  | {
      valid: true;
      valueState: IngredientHandlingValueState;
      instructionText: string | null;
    }
  | { valid: false; error: string } {
  if (!isIngredientHandlingValueState(valueState)) {
    return {
      valid: false,
      error: 'Handling value state is invalid'
    };
  }

  if (valueState === 'known') {
    if (typeof instructionText !== 'string') {
      return {
        valid: false,
        error: 'Known handling state requires instruction text'
      };
    }

    const trimmed = instructionText.trim();

    if (trimmed === '') {
      return {
        valid: false,
        error: 'Known handling instruction must not be empty'
      };
    }

    return {
      valid: true,
      valueState,
      instructionText: trimmed
    };
  }

  if (instructionText !== null) {
    return {
      valid: false,
      error:
        'Unknown or not-applicable handling state requires null instruction'
    };
  }

  return {
    valid: true,
    valueState,
    instructionText: null
  };
}

export function isIngredientHandlingInstruction(
  value: unknown
): value is IngredientHandlingInstruction {
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
    || typeof candidate.handlingDefinitionId !== 'string'
    || !isUUIDv4(candidate.handlingDefinitionId)
    || !(candidate.effectiveFrom instanceof Date)
    || !(candidate.createdAt instanceof Date)
  ) {
    return false;
  }

  return validateIngredientHandlingValue(
    candidate.valueState,
    candidate.instructionText
  ).valid;
}
