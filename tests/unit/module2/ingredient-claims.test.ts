import {
  isIngredientClaimValueState,
  validateIngredientClaimCode,
  validateIngredientClaimDisplayName,
  validateIngredientClaimValue,
  isIngredientClaimAssertion
} from '../../../src/modules/ingredient-intelligence';

describe('M2-I05 Ingredient Claims', () => {
  test.each([
    'known',
    'unknown',
    'not_applicable'
  ])(
    'accepts claim value state %s',
    (state) => {
      expect(
        isIngredientClaimValueState(state)
      ).toBe(true);
    }
  );

  test('rejects invalid claim value state', () => {
    expect(
      isIngredientClaimValueState('maybe')
    ).toBe(false);
  });

  test('normalizes claim code', () => {
    expect(
      validateIngredientClaimCode('  contains_shellfish  ')
    ).toEqual({
      valid: true,
      value: 'contains_shellfish'
    });
  });

  test('rejects empty claim code', () => {
    expect(
      validateIngredientClaimCode('   ').valid
    ).toBe(false);
  });

  test('normalizes claim display name', () => {
    expect(
      validateIngredientClaimDisplayName(
        '  Contains Shellfish  '
      )
    ).toEqual({
      valid: true,
      value: 'Contains Shellfish'
    });
  });

  test('known claim requires boolean true or false', () => {
    expect(
      validateIngredientClaimValue(
        'known',
        true
      )
    ).toEqual({
      valid: true,
      valueState: 'known',
      booleanValue: true
    });

    expect(
      validateIngredientClaimValue(
        'known',
        false
      )
    ).toEqual({
      valid: true,
      valueState: 'known',
      booleanValue: false
    });

    expect(
      validateIngredientClaimValue(
        'known',
        null
      ).valid
    ).toBe(false);
  });

  test('unknown claim requires null value', () => {
    expect(
      validateIngredientClaimValue(
        'unknown',
        null
      )
    ).toEqual({
      valid: true,
      valueState: 'unknown',
      booleanValue: null
    });

    expect(
      validateIngredientClaimValue(
        'unknown',
        false
      ).valid
    ).toBe(false);
  });

  test('not_applicable claim requires null value', () => {
    expect(
      validateIngredientClaimValue(
        'not_applicable',
        null
      )
    ).toEqual({
      valid: true,
      valueState: 'not_applicable',
      booleanValue: null
    });
  });

  test('validates structural claim assertion', () => {
    expect(
      isIngredientClaimAssertion({
        id:
          '550e8400-e29b-41d4-a716-446655446001',
        organizationId:
          '550e8400-e29b-41d4-a716-446655446002',
        ingredientId:
          '550e8400-e29b-41d4-a716-446655446003',
        claimDefinitionId:
          '550e8400-e29b-41d4-a716-446655446004',
        valueState: 'known',
        booleanValue: false,
        effectiveFrom:
          new Date('2026-08-20T00:00:00Z'),
        createdAt:
          new Date('2026-08-20T00:00:01Z')
      })
    ).toBe(true);
  });
});
