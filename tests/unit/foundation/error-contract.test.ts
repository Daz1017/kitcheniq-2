import {
  createFoundationError,
  createInternalFoundationError,
  FoundationErrorCategory,
  toUserSafeError
} from '../../../src/foundation/errors/error-contract';
import { createCorrelationId, isCorrelationId } from '../../../src/foundation/correlation/correlation-id';

describe('Foundation error contract', () => {
  test('all frozen categories exist', () => {
    const categories: FoundationErrorCategory[] = [
      'validation',
      'authentication',
      'authorization',
      'not_found',
      'conflict',
      'idempotency',
      'integration_transient',
      'internal'
    ];
    expect(categories).toHaveLength(8);
  });

  test('error contract can be created and serialized', () => {
    const correlationId = createCorrelationId();
    const error = createFoundationError(
      'validation.missing_field',
      'validation',
      'Required field is missing.',
      correlationId,
      false
    );

    const json = JSON.stringify(error);
    expect(json).toContain('validation.missing_field');
    expect(json).toContain('validation');
    expect(json).toContain('Required field is missing.');
    expect(json).toContain(correlationId);
    expect(json).toContain('false');
    expect(isCorrelationId(error.correlationId)).toBe(true);
  });

  test('retryable true and false are representable', () => {
    const correlationId = createCorrelationId();
    const retryableError = createFoundationError(
      'integration.transient_failure',
      'integration_transient',
      'A transient dependency error occurred.',
      correlationId,
      true
    );
    const nonRetryableError = createFoundationError(
      'validation.failed',
      'validation',
      'Validation failed.',
      correlationId,
      false
    );

    expect(retryableError.retryable).toBe(true);
    expect(nonRetryableError.retryable).toBe(false);
  });

  test('user-safe projection returns only public-safe fields', () => {
    const correlationId = createCorrelationId();
    const error = createFoundationError(
      'authorization.denied',
      'authorization',
      'Access is denied.',
      correlationId,
      false
    );
    const safeError = toUserSafeError(error);

    expect(safeError).toEqual({
      code: 'authorization.denied',
      category: 'authorization',
      userMessage: 'Access is denied.',
      correlationId,
      retryable: false
    });
    expect(isCorrelationId(safeError.correlationId)).toBe(true);
  });

  test('internal failures can produce a generic safe message', () => {
    const correlationId = createCorrelationId();
    const error = createInternalFoundationError(correlationId);
    const safeError = toUserSafeError(error);

    expect(safeError.userMessage).toBe('An internal error occurred.');
    expect(safeError.category).toBe('internal');
    expect(isCorrelationId(safeError.correlationId)).toBe(true);
  });
});
