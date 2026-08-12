export const CONFIGURATION_SENSITIVITIES = [
  'public_client',
  'secret',
] as const;

export type ConfigurationSensitivity = (typeof CONFIGURATION_SENSITIVITIES)[number];

export function isConfigurationSensitivity(value: unknown): value is ConfigurationSensitivity {
  return typeof value === 'string' && (CONFIGURATION_SENSITIVITIES as readonly string[]).includes(value);
}

export function isPublicClientConfiguration(sensitivity: ConfigurationSensitivity): boolean {
  return sensitivity === 'public_client';
}

export function isSecretConfiguration(sensitivity: ConfigurationSensitivity): boolean {
  return sensitivity === 'secret';
}

export default CONFIGURATION_SENSITIVITIES;
