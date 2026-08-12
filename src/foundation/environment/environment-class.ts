export const ENVIRONMENT_CLASSES = [
  'development',
  'automated_test',
  'staging',
  'production',
] as const;

export type EnvironmentClass = (typeof ENVIRONMENT_CLASSES)[number];

export function isEnvironmentClass(value: unknown): value is EnvironmentClass {
  return typeof value === 'string' && (ENVIRONMENT_CLASSES as readonly string[]).includes(value);
}

export function isProductionEnvironment(environment: EnvironmentClass): boolean {
  return environment === 'production';
}

export function isLowerEnvironment(environment: EnvironmentClass): boolean {
  return environment !== 'production';
}

export default ENVIRONMENT_CLASSES;
