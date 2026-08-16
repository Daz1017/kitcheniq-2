import { AsyncLocalStorage } from 'node:async_hooks';
import { createCorrelationId, type CorrelationId } from '../correlation';

const correlationStorage = new AsyncLocalStorage<CorrelationId>();

export function runWithCorrelation<T>(correlationId: CorrelationId, callback: () => T): T {
  return correlationStorage.run(correlationId, callback);
}

export function currentCorrelationId(): CorrelationId | undefined {
  return correlationStorage.getStore();
}

export function requireCorrelationContext(): CorrelationId {
  const existing = currentCorrelationId();
  if (existing) {
    return existing;
  }

  const fresh = createCorrelationId();
  return runWithCorrelation(fresh, () => fresh);
}
