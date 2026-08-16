import { createInternalFoundationError, toUserSafeError, type FoundationErrorContract } from '../errors';
import { type UserSafeError } from '../errors/error-contract';
import { type CorrelationId } from '../correlation';
import { currentCorrelationId, requireCorrelationContext, runWithCorrelation } from './correlation-context';
import { appendOperationalLog, logError, type OperationalLogSink } from './logger';

export type ErrorBoundaryResult<T> = T | UserSafeError;

export async function executeWithFoundationErrorBoundary<T>(
  operation: () => Promise<T> | T,
  context: Readonly<{ component: string; message?: string; details?: Record<string, unknown>; sink?: OperationalLogSink }> = { component: 'foundation.error_boundary' }
): Promise<ErrorBoundaryResult<T>> {
  const correlationId = currentCorrelationId() ?? requireCorrelationContext();

  try {
    return await runWithCorrelation(correlationId, async () => operation());
  } catch (error: unknown) {
    const safeCorrelationId = currentCorrelationId() ?? correlationId;
    const frozenError = normalizeFoundationError(error, safeCorrelationId);

    const logContext = {
      component: context.component,
      message: context.message ?? 'Unhandled server operation failed',
      correlationId: safeCorrelationId,
      healthSignal: 'error',
      errorCode: frozenError.code,
      errorCategory: frozenError.category,
      retryable: frozenError.retryable,
      details: { ...(context.details ?? {}), errorKind: error instanceof Error ? error.name : typeof error }
    } as const;
    if (context.sink) {
      try {
        await appendOperationalLog(logContext, context.sink);
      } catch {
        logError(logContext);
      }
    } else {
      logError(logContext);
    }

    return toUserSafeError(frozenError);
  }
}

function normalizeFoundationError(error: unknown, correlationId: CorrelationId): FoundationErrorContract {
  if (isFoundationErrorContract(error)) {
    return error;
  }

  const generic = createInternalFoundationError(correlationId);
  return {
    ...generic,
    code: generic.code,
    category: generic.category,
    retryable: generic.retryable,
    correlationId
  };
}

function isFoundationErrorContract(value: unknown): value is FoundationErrorContract {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<FoundationErrorContract>;
  return typeof candidate.code === 'string'
    && typeof candidate.userMessage === 'string'
    && typeof candidate.correlationId === 'string'
    && typeof candidate.retryable === 'boolean'
    && (candidate.category === 'validation'
      || candidate.category === 'authentication'
      || candidate.category === 'authorization'
      || candidate.category === 'not_found'
      || candidate.category === 'conflict'
      || candidate.category === 'idempotency'
      || candidate.category === 'integration_transient'
      || candidate.category === 'internal');
}
