import {
  type EntityId,
  type UUID,
  brandEntityId,
  isUUIDv4
} from '../../foundation/identifiers';
import {
  type CanonicalUnitCode,
  isCanonicalUnitCode,
  CANONICAL_UNIT_CODES
} from '../../foundation/units';

/**
 * Module 2 Ingredient domain types and contracts.
 * Implements the core Ingredient master with organization scope, lifecycle governance,
 * and Module 2 permission boundaries.
 */

/**
 * IngredientId: Entity-specific branded UUID for Ingredient identity.
 * Ingredient IDs are UUIDv4 and never used as mutable display identifiers.
 */
export type IngredientId = EntityId<'ingredient'>;

/**
 * IngredientLifecycleStatus: Exactly active, inactive, or archived.
 * Create defaults to active.
 * Update may transition only active ↔ inactive.
 * Archive is one-way and non-destructive.
 */
export type IngredientLifecycleStatus = 'active' | 'inactive' | 'archived';

const INGREDIENT_LIFECYCLE_STATUSES: readonly IngredientLifecycleStatus[] = [
  'active',
  'inactive',
  'archived'
] as const;

/**
 * Validates that a value is a valid IngredientLifecycleStatus.
 */
export function isIngredientLifecycleStatus(value: unknown): value is IngredientLifecycleStatus {
  return (
    typeof value === 'string' &&
    (value === 'active' || value === 'inactive' || value === 'archived')
  );
}

/**
 * Ingredient: The authoritative kitchen-owned ingredient master record.
 *
 * An Ingredient is organization-scoped with:
 * - Unique UUIDv4 identity (never used as mutable display identifier)
 * - Mutable display name and optional description
 * - Canonical base measurement unit (g, mL, or ea)
 * - Lifecycle governance (active, inactive, or archived)
 * - Audit-tracked mutations through controlled server functions
 * - Row-Level Security at organization scope
 */
export interface Ingredient {
  readonly id: IngredientId;
  readonly organizationId: UUID;
  readonly displayName: string;
  readonly description: string | null;
  readonly baseCanonicalUnit: CanonicalUnitCode;
  readonly lifecycleStatus: IngredientLifecycleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

/**
 * Validates that an Ingredient object has all required fields and correct types.
 */
export function isIngredient(value: unknown): value is Ingredient {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    isUUIDv4(obj.id) &&
    typeof obj.organizationId === 'string' &&
    isUUIDv4(obj.organizationId) &&
    typeof obj.displayName === 'string' &&
    obj.displayName !== '' &&
    (obj.description === null || (typeof obj.description === 'string' && obj.description !== '')) &&
    isCanonicalUnitCode(obj.baseCanonicalUnit) &&
    isIngredientLifecycleStatus(obj.lifecycleStatus) &&
    obj.createdAt instanceof Date &&
    obj.updatedAt instanceof Date &&
    (obj.archivedAt === null || obj.archivedAt instanceof Date)
  );
}

/**
 * Display name validation: must not be empty or whitespace-only.
 * Trims leading/trailing whitespace on input.
 */
export function validateIngredientDisplayName(input: string): { valid: true; value: string } | { valid: false; error: string } {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Display name must be a string' };
  }

  const trimmed = input.trim();

  if (trimmed === '') {
    return { valid: false, error: 'Display name must not be empty or whitespace-only' };
  }

  return { valid: true, value: trimmed };
}

/**
 * Optional description validation: must not be only whitespace if provided.
 * Accepts null; trims on input.
 */
export function validateIngredientDescription(
  input: string | null | undefined
): { valid: true; value: string | null } | { valid: false; error: string } {
  if (input === null || input === undefined) {
    return { valid: true, value: null };
  }

  if (typeof input !== 'string') {
    return { valid: false, error: 'Description must be a string or null' };
  }

  const trimmed = input.trim();

  if (trimmed === '') {
    return { valid: false, error: 'Description must not be only whitespace' };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate base canonical unit.
 * Only g, mL, ea are accepted.
 */
export function validateIngredientBaseCanonicalUnit(
  input: unknown
): { valid: true; value: CanonicalUnitCode } | { valid: false; error: string } {
  if (!isCanonicalUnitCode(input)) {
    return { valid: false, error: `Base canonical unit must be one of: ${CANONICAL_UNIT_CODES.join(', ')}` };
  }

  return { valid: true, value: input };
}

/**
 * Validate lifecycle status.
 * Only active, inactive, archived are accepted.
 */
export function validateIngredientLifecycleStatus(
  input: unknown
): { valid: true; value: IngredientLifecycleStatus } | { valid: false; error: string } {
  if (!isIngredientLifecycleStatus(input)) {
    return { valid: false, error: 'Lifecycle status must be one of: active, inactive, archived' };
  }

  return { valid: true, value: input };
}

export default {
  isIngredient,
  isIngredientLifecycleStatus,
  validateIngredientDisplayName,
  validateIngredientDescription,
  validateIngredientBaseCanonicalUnit,
  validateIngredientLifecycleStatus
};
