import { CorrelationId } from '../correlation/correlation-id';

export type FoundationErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'idempotency'
  | 'integration_transient'
  | 'internal';

export interface FoundationErrorContract {
  readonly code: string;
  readonly category: FoundationErrorCategory;
  readonly userMessage: string;
  readonly correlationId: CorrelationId;
  readonly retryable: boolean;
}

export interface UserSafeError {
  readonly code: string;
  readonly category: FoundationErrorCategory;
  readonly userMessage: string;
  readonly correlationId: string;
  readonly retryable: boolean;
}

export function createFoundationError(
  code: string,
  category: FoundationErrorCategory,
  userMessage: string,
  correlationId: CorrelationId,
  retryable: boolean
): FoundationErrorContract {
  return { code, category, userMessage, correlationId, retryable };
}

export function toUserSafeError(
  error: FoundationErrorContract
): UserSafeError {
  return {
    code: error.code,
    category: error.category,
    userMessage: error.userMessage,
    correlationId: error.correlationId,
    retryable: error.retryable
  };
}

export function createInternalFoundationError(
  correlationId: CorrelationId
): FoundationErrorContract {
  return createFoundationError(
    'internal.generic',
    'internal',
    'An internal error occurred.',
    correlationId,
    false
  );
}
