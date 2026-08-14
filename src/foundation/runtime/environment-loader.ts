import { EnvironmentClass, isEnvironmentClass } from '../environment/environment-class';

export const KITCHENIQ_ENVIRONMENT_VARIABLE = 'KITCHENIQ_ENVIRONMENT' as const;

export function loadKitchenIqEnvironment(
  source: NodeJS.ProcessEnv = process.env
): EnvironmentClass {
  const candidate = source[KITCHENIQ_ENVIRONMENT_VARIABLE];

  if (candidate === undefined) {
    throw new Error(
      `${KITCHENIQ_ENVIRONMENT_VARIABLE} is required and must be one of the frozen Foundation environment classes.`
    );
  }

  if (!isEnvironmentClass(candidate)) {
    throw new Error(
      `${KITCHENIQ_ENVIRONMENT_VARIABLE} must be exactly one of: development, automated_test, staging, production. Received: ${JSON.stringify(candidate)}`
    );
  }

  return candidate;
}

export function assertAutomatedTestEnvironment(environment: EnvironmentClass): void {
  if (environment !== 'automated_test') {
    throw new Error(
      `Automated tests must run with ${KITCHENIQ_ENVIRONMENT_VARIABLE}=automated_test. Received: ${environment}`
    );
  }
}

export function loadAutomatedTestEnvironment(
  source: NodeJS.ProcessEnv = process.env
): EnvironmentClass {
  const environment = loadKitchenIqEnvironment(source);
  assertAutomatedTestEnvironment(environment);
  return environment;
}
