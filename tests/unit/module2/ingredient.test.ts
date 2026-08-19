import {
  isIngredient,
  isIngredientLifecycleStatus,
  validateIngredientDisplayName,
  validateIngredientDescription,
  validateIngredientBaseCanonicalUnit,
  validateIngredientLifecycleStatus,
  type Ingredient,
  type IngredientId,
  type IngredientLifecycleStatus
} from '../../../src/modules/ingredient-intelligence/ingredient';
import { brandEntityId, brandUUID } from '../../../src/foundation/identifiers';

describe('Ingredient domain representation', () => {
  const validOrganizationId = brandUUID('12345678-1234-4567-8901-234567890123');
  const validIngredientId = brandEntityId<'ingredient'>('87654321-4321-4321-8765-432187654321');

  describe('Ingredient lifecycle validation', () => {
    test('accepts exactly active', () => {
      expect(isIngredientLifecycleStatus('active')).toBe(true);
    });

    test('accepts exactly inactive', () => {
      expect(isIngredientLifecycleStatus('inactive')).toBe(true);
    });

    test('accepts exactly archived', () => {
      expect(isIngredientLifecycleStatus('archived')).toBe(true);
    });

    test('rejects Active (case variant)', () => {
      expect(isIngredientLifecycleStatus('Active')).toBe(false);
    });

    test('rejects ARCHIVED (case variant)', () => {
      expect(isIngredientLifecycleStatus('ARCHIVED')).toBe(false);
    });

    test('rejects INACTIVE (case variant)', () => {
      expect(isIngredientLifecycleStatus('INACTIVE')).toBe(false);
    });

    test('rejects deleted', () => {
      expect(isIngredientLifecycleStatus('deleted')).toBe(false);
    });

    test('rejects enabled', () => {
      expect(isIngredientLifecycleStatus('enabled')).toBe(false);
    });

    test('rejects null', () => {
      expect(isIngredientLifecycleStatus(null)).toBe(false);
    });

    test('rejects undefined', () => {
      expect(isIngredientLifecycleStatus(undefined)).toBe(false);
    });

    test('validateIngredientLifecycleStatus accepts valid status', () => {
      const result = validateIngredientLifecycleStatus('active');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('active');
      }
    });

    test('validateIngredientLifecycleStatus rejects invalid status', () => {
      const result = validateIngredientLifecycleStatus('invalid');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('active, inactive, archived');
      }
    });
  });

  describe('Ingredient canonical unit validation', () => {
    test('accepts g', () => {
      const result = validateIngredientBaseCanonicalUnit('g');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('g');
      }
    });

    test('accepts mL', () => {
      const result = validateIngredientBaseCanonicalUnit('mL');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('mL');
      }
    });

    test('accepts ea', () => {
      const result = validateIngredientBaseCanonicalUnit('ea');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('ea');
      }
    });

    test('rejects G (case variant)', () => {
      const result = validateIngredientBaseCanonicalUnit('G');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects ml (case variant)', () => {
      const result = validateIngredientBaseCanonicalUnit('ml');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects ML (case variant)', () => {
      const result = validateIngredientBaseCanonicalUnit('ML');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects oz', () => {
      const result = validateIngredientBaseCanonicalUnit('oz');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects lb', () => {
      const result = validateIngredientBaseCanonicalUnit('lb');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects kg', () => {
      const result = validateIngredientBaseCanonicalUnit('kg');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects L', () => {
      const result = validateIngredientBaseCanonicalUnit('L');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects cup', () => {
      const result = validateIngredientBaseCanonicalUnit('cup');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects tbsp', () => {
      const result = validateIngredientBaseCanonicalUnit('tbsp');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects tsp', () => {
      const result = validateIngredientBaseCanonicalUnit('tsp');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects qt', () => {
      const result = validateIngredientBaseCanonicalUnit('qt');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects gal', () => {
      const result = validateIngredientBaseCanonicalUnit('gal');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects case', () => {
      const result = validateIngredientBaseCanonicalUnit('case');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects bag', () => {
      const result = validateIngredientBaseCanonicalUnit('bag');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });

    test('rejects bottle', () => {
      const result = validateIngredientBaseCanonicalUnit('bottle');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('g, mL, ea');
      }
    });
  });

  describe('Ingredient display-name validation', () => {
    test('accepts valid trimmed name', () => {
      const result = validateIngredientDisplayName('Shrimp');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('Shrimp');
      }
    });

    test('rejects empty string', () => {
      const result = validateIngredientDisplayName('');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('whitespace-only');
      }
    });

    test('rejects whitespace-only', () => {
      const result = validateIngredientDisplayName('   ');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('whitespace-only');
      }
    });

    test('rejects leading whitespace and trims', () => {
      const result = validateIngredientDisplayName(' Shrimp');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('Shrimp');
        expect(result.value).toBe(result.value.trim());
      }
    });

    test('rejects trailing whitespace and trims', () => {
      const result = validateIngredientDisplayName('Shrimp ');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('Shrimp');
        expect(result.value).toBe(result.value.trim());
      }
    });

    test('rejects non-string input', () => {
      const result = validateIngredientDisplayName(123 as unknown as string);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('string');
      }
    });
  });

  describe('Ingredient description validation', () => {
    test('accepts null', () => {
      const result = validateIngredientDescription(null);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBeNull();
      }
    });

    test('accepts undefined as null', () => {
      const result = validateIngredientDescription(undefined);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBeNull();
      }
    });

    test('accepts valid description', () => {
      const result = validateIngredientDescription('A type of shellfish');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('A type of shellfish');
      }
    });

    test('trims leading/trailing whitespace', () => {
      const result = validateIngredientDescription('  A type of shellfish  ');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('A type of shellfish');
      }
    });

    test('rejects whitespace-only description', () => {
      const result = validateIngredientDescription('   ');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('whitespace');
      }
    });

    test('rejects non-string, non-null input', () => {
      const result = validateIngredientDescription(123 as unknown as string);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('string or null');
      }
    });
  });

  describe('Ingredient domain representation', () => {
    const validIngredient: Ingredient = {
      id: validIngredientId,
      organizationId: validOrganizationId,
      displayName: 'Shrimp',
      description: 'A type of shellfish',
      baseCanonicalUnit: 'g',
      lifecycleStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null
    };

    test('isIngredient validates a complete valid Ingredient', () => {
      expect(isIngredient(validIngredient)).toBe(true);
    });

    test('isIngredient validates an Ingredient with null description', () => {
      const ingredient: Ingredient = {
        ...validIngredient,
        description: null
      };
      expect(isIngredient(ingredient)).toBe(true);
    });

    test('isIngredient rejects incomplete object', () => {
      expect(isIngredient({ id: validIngredientId })).toBe(false);
    });

    test('isIngredient rejects object with invalid UUID', () => {
      expect(
        isIngredient({
          ...validIngredient,
          id: 'not-a-uuid'
        })
      ).toBe(false);
    });

    test('isIngredient rejects object with invalid organizationId', () => {
      expect(
        isIngredient({
          ...validIngredient,
          organizationId: 'not-a-uuid'
        })
      ).toBe(false);
    });

    test('isIngredient rejects object with empty displayName', () => {
      expect(
        isIngredient({
          ...validIngredient,
          displayName: ''
        })
      ).toBe(false);
    });

    test('isIngredient rejects object with invalid lifecycleStatus', () => {
      expect(
        isIngredient({
          ...validIngredient,
          lifecycleStatus: 'invalid'
        })
      ).toBe(false);
    });

    test('isIngredient rejects object with invalid baseCanonicalUnit', () => {
      expect(
        isIngredient({
          ...validIngredient,
          baseCanonicalUnit: 'invalid'
        })
      ).toBe(false);
    });

    test('JSON serialization preserves Ingredient identity', () => {
      const json = JSON.stringify(validIngredient);
      expect(json).toContain(validIngredient.id);
      expect(json).toContain(validIngredient.organizationId);
      expect(json).toContain(validIngredient.displayName);
      expect(json).toContain(validIngredient.baseCanonicalUnit);
    });

    test('archived Ingredient has valid archived_at timestamp', () => {
      const archivedDate = new Date();
      const archivedIngredient: Ingredient = {
        ...validIngredient,
        lifecycleStatus: 'archived',
        archivedAt: archivedDate
      };
      expect(isIngredient(archivedIngredient)).toBe(true);
      expect(archivedIngredient.archivedAt).toEqual(archivedDate);
    });

    test('active Ingredient has null archived_at', () => {
      expect(validIngredient.lifecycleStatus).toBe('active');
      expect(validIngredient.archivedAt).toBeNull();
    });

    test('inactive Ingredient has null archived_at', () => {
      const inactiveIngredient: Ingredient = {
        ...validIngredient,
        lifecycleStatus: 'inactive'
      };
      expect(isIngredient(inactiveIngredient)).toBe(true);
      expect(inactiveIngredient.archivedAt).toBeNull();
    });
  });
});
