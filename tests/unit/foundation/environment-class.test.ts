import { ENVIRONMENT_CLASSES, isEnvironmentClass, EnvironmentClass, isProductionEnvironment, isLowerEnvironment } from '../../../src/foundation/environment/environment-class';

describe('EnvironmentClass primitive', () => {
  test('ENVIRONMENT_CLASSES exactly equals the four canonical values in order', () => {
    expect(ENVIRONMENT_CLASSES).toEqual([
      'development',
      'automated_test',
      'staging',
      'production',
    ]);
  });

  test('ENVIRONMENT_CLASSES has exactly four entries and no duplicates', () => {
    expect(ENVIRONMENT_CLASSES.length).toBe(4);
    const unique = new Set(ENVIRONMENT_CLASSES);
    expect(unique.size).toBe(4);
  });

  test('isEnvironmentClass accepts every canonical value', () => {
    for (const env of ENVIRONMENT_CLASSES) {
      expect(isEnvironmentClass(env)).toBe(true);
    }
  });

  test('isEnvironmentClass rejects common non-canonical or malformed values', () => {
    const rejects = [
      '',
      'dev',
      'test',
      'qa',
      'uat',
      'prod',
      'Development',
      'automated-test',
      'automated test',
      'STAGING',
      'Production',
    ];
    for (const v of rejects) {
      expect(isEnvironmentClass(v)).toBe(false);
    }
  });

  test('isEnvironmentClass rejects non-string values', () => {
    expect(isEnvironmentClass(null)).toBe(false);
    expect(isEnvironmentClass(undefined)).toBe(false);
    expect(isEnvironmentClass(0)).toBe(false);
    expect(isEnvironmentClass(false)).toBe(false);
    expect(isEnvironmentClass({})).toBe(false);
    expect(isEnvironmentClass([])).toBe(false);
  });

  test('TypeScript narrowing works via isEnvironmentClass', () => {
    const value: unknown = 'staging';
    if (isEnvironmentClass(value)) {
      const narrowed: EnvironmentClass = value;
      expect(narrowed).toBe('staging');
    } else {
      throw new Error('Narrowing failed for canonical environment class');
    }
  });

  test('isProductionEnvironment correctly identifies production', () => {
    expect(isProductionEnvironment('production')).toBe(true);
    expect(isProductionEnvironment('development')).toBe(false);
    expect(isProductionEnvironment('automated_test')).toBe(false);
    expect(isProductionEnvironment('staging')).toBe(false);
  });

  test('isLowerEnvironment correctly identifies non-production environments', () => {
    expect(isLowerEnvironment('development')).toBe(true);
    expect(isLowerEnvironment('automated_test')).toBe(true);
    expect(isLowerEnvironment('staging')).toBe(true);
    expect(isLowerEnvironment('production')).toBe(false);
  });

  test('all four canonical values survive JSON stringify/parse as ordinary strings', () => {
    for (const env of ENVIRONMENT_CLASSES) {
      const json = JSON.stringify({ environment: env });
      const parsed = JSON.parse(json);
      expect(typeof parsed.environment).toBe('string');
      expect(isEnvironmentClass(parsed.environment)).toBe(true);
      expect(parsed.environment).toBe(env);
    }
  });
});
