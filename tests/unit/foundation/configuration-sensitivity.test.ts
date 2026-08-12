import { CONFIGURATION_SENSITIVITIES, isConfigurationSensitivity, ConfigurationSensitivity, isPublicClientConfiguration, isSecretConfiguration } from '../../../src/foundation/configuration/configuration-sensitivity';

describe('ConfigurationSensitivity primitive', () => {
  test('CONFIGURATION_SENSITIVITIES exactly equals the two canonical values in order', () => {
    expect(CONFIGURATION_SENSITIVITIES).toEqual([
      'public_client',
      'secret',
    ]);
  });

  test('CONFIGURATION_SENSITIVITIES has exactly two entries and no duplicates', () => {
    expect(CONFIGURATION_SENSITIVITIES.length).toBe(2);
    const unique = new Set(CONFIGURATION_SENSITIVITIES);
    expect(unique.size).toBe(2);
  });

  test('isConfigurationSensitivity accepts both canonical values', () => {
    for (const sens of CONFIGURATION_SENSITIVITIES) {
      expect(isConfigurationSensitivity(sens)).toBe(true);
    }
  });

  test('isConfigurationSensitivity rejects common non-canonical or malformed values', () => {
    const rejects = [
      '',
      'public',
      'client',
      'public-client',
      'PUBLIC_CLIENT',
      'private',
      'server',
      'sensitive',
      'credential',
    ];
    for (const v of rejects) {
      expect(isConfigurationSensitivity(v)).toBe(false);
    }
  });

  test('isConfigurationSensitivity rejects non-string values', () => {
    expect(isConfigurationSensitivity(null)).toBe(false);
    expect(isConfigurationSensitivity(undefined)).toBe(false);
    expect(isConfigurationSensitivity(0)).toBe(false);
    expect(isConfigurationSensitivity(false)).toBe(false);
    expect(isConfigurationSensitivity({})).toBe(false);
    expect(isConfigurationSensitivity([])).toBe(false);
  });

  test('TypeScript narrowing works via isConfigurationSensitivity', () => {
    const value: unknown = 'secret';
    if (isConfigurationSensitivity(value)) {
      const narrowed: ConfigurationSensitivity = value;
      expect(narrowed).toBe('secret');
    } else {
      throw new Error('Narrowing failed for canonical configuration sensitivity');
    }
  });

  test('isPublicClientConfiguration correctly identifies public_client', () => {
    expect(isPublicClientConfiguration('public_client')).toBe(true);
    expect(isPublicClientConfiguration('secret')).toBe(false);
  });

  test('isSecretConfiguration correctly identifies secret', () => {
    expect(isSecretConfiguration('secret')).toBe(true);
    expect(isSecretConfiguration('public_client')).toBe(false);
  });

  test('both canonical values survive JSON stringify/parse as ordinary strings', () => {
    for (const sens of CONFIGURATION_SENSITIVITIES) {
      const json = JSON.stringify({ sensitivity: sens });
      const parsed = JSON.parse(json);
      expect(typeof parsed.sensitivity).toBe('string');
      expect(isConfigurationSensitivity(parsed.sensitivity)).toBe(true);
      expect(parsed.sensitivity).toBe(sens);
    }
  });
});
