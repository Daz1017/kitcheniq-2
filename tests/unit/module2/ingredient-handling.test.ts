import {
  isIngredientHandlingValueState,
  validateIngredientHandlingCode,
  validateIngredientHandlingDisplayName,
  validateIngredientHandlingValue,
  isIngredientHandlingInstruction
} from '../../../src/modules/ingredient-intelligence';

describe('M2-I06 Ingredient Handling', () => {
  test.each([
    'known',
    'unknown',
    'not_applicable'
  ])(
    'accepts handling value state %s',
    (state) => {
      expect(
        isIngredientHandlingValueState(state)
      ).toBe(true);
    }
  );

  test('rejects invalid handling value state', () => {
    expect(
      isIngredientHandlingValueState('maybe')
    ).toBe(false);
  });

  test('normalizes handling code', () => {
    expect(
      validateIngredientHandlingCode(
        '  refrigerated_storage  '
      )
    ).toEqual({
      valid: true,
      value: 'refrigerated_storage'
    });
  });

  test('rejects empty handling code', () => {
    expect(
      validateIngredientHandlingCode('   ').valid
    ).toBe(false);
  });

  test('normalizes handling display name', () => {
    expect(
      validateIngredientHandlingDisplayName(
        '  Refrigerated Storage  '
      )
    ).toEqual({
      valid: true,
      value: 'Refrigerated Storage'
    });
  });

  test('known handling requires non-empty instruction text', () => {
    expect(
      validateIngredientHandlingValue(
        'known',
        '  Keep sealed after opening  '
      )
    ).toEqual({
      valid: true,
      valueState: 'known',
      instructionText:
        'Keep sealed after opening'
    });

    expect(
      validateIngredientHandlingValue(
        'known',
        null
      ).valid
    ).toBe(false);

    expect(
      validateIngredientHandlingValue(
        'known',
        '   '
      ).valid
    ).toBe(false);
  });

  test('unknown handling requires null instruction', () => {
    expect(
      validateIngredientHandlingValue(
        'unknown',
        null
      )
    ).toEqual({
      valid: true,
      valueState: 'unknown',
      instructionText: null
    });

    expect(
      validateIngredientHandlingValue(
        'unknown',
        'Unknown'
      ).valid
    ).toBe(false);
  });

  test('not_applicable handling requires null instruction', () => {
    expect(
      validateIngredientHandlingValue(
        'not_applicable',
        null
      )
    ).toEqual({
      valid: true,
      valueState: 'not_applicable',
      instructionText: null
    });
  });

  test('validates structural handling instruction', () => {
    expect(
      isIngredientHandlingInstruction({
        id:
          '550e8400-e29b-41d4-a716-446655448001',
        organizationId:
          '550e8400-e29b-41d4-a716-446655448002',
        ingredientId:
          '550e8400-e29b-41d4-a716-446655448003',
        handlingDefinitionId:
          '550e8400-e29b-41d4-a716-446655448004',
        valueState: 'known',
        instructionText:
          'Keep container closed',
        effectiveFrom:
          new Date('2026-08-20T00:00:00Z'),
        createdAt:
          new Date('2026-08-20T00:00:01Z')
      })
    ).toBe(true);
  });
});
