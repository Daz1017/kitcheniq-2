import {
  assertAutomatedTestEnvironment,
  loadKitchenIqEnvironment,
} from '../../../../src/foundation/runtime/environment-loader';

describe('runtime environment loader', () => {
  test('accepts development', () => {
    expect(loadKitchenIqEnvironment({ KITCHENIQ_ENVIRONMENT: 'development' })).toBe('development');
  });

  test('accepts automated_test', () => {
    expect(loadKitchenIqEnvironment({ KITCHENIQ_ENVIRONMENT: 'automated_test' })).toBe('automated_test');
  });

  test('accepts staging', () => {
    expect(loadKitchenIqEnvironment({ KITCHENIQ_ENVIRONMENT: 'staging' })).toBe('staging');
  });

  test('accepts production', () => {
    expect(loadKitchenIqEnvironment({ KITCHENIQ_ENVIRONMENT: 'production' })).toBe('production');
  });

  test('rejects missing value', () => {
    expect(() => loadKitchenIqEnvironment({})).toThrow(
      'KITCHENIQ_ENVIRONMENT is required'
    );
  });

  test('rejects empty value', () => {
    expect(() => loadKitchenIqEnvironment({ KITCHENIQ_ENVIRONMENT: '' })).toThrow(
      'KITCHENIQ_ENVIRONMENT must be exactly one of'
    );
  });

  test('rejects unknown value', () => {
    expect(() => loadKitchenIqEnvironment({ KITCHENIQ_ENVIRONMENT: 'qa' })).toThrow(
      'KITCHENIQ_ENVIRONMENT must be exactly one of'
    );
  });

  test('rejects different casing', () => {
    expect(() => loadKitchenIqEnvironment({ KITCHENIQ_ENVIRONMENT: 'Production' })).toThrow(
      'KITCHENIQ_ENVIRONMENT must be exactly one of'
    );
  });

  test('rejects surrounding whitespace', () => {
    expect(() => loadKitchenIqEnvironment({ KITCHENIQ_ENVIRONMENT: ' production ' })).toThrow(
      'KITCHENIQ_ENVIRONMENT must be exactly one of'
    );
  });

  test('automated-test safety rejects production', () => {
    expect(() => assertAutomatedTestEnvironment('production')).toThrow(
      'Automated tests must run with KITCHENIQ_ENVIRONMENT=automated_test'
    );
  });

  test('automated-test safety accepts automated_test', () => {
    expect(() => assertAutomatedTestEnvironment('automated_test')).not.toThrow();
  });
});
