import {
  createFoundationError,
  createInternalFoundationError
} from '../../../../src/foundation/errors';
import { createCorrelationId } from '../../../../src/foundation/correlation';
import { executeWithFoundationErrorBoundary } from '../../../../src/foundation/runtime/error-boundary';
import { runWithCorrelation } from '../../../../src/foundation/runtime/correlation-context';

function expectSafeProjection(value: unknown, correlationId: string) {
  expect(value).toEqual(expect.objectContaining({ correlationId }));
  expect(value).not.toHaveProperty('stack');
  expect(JSON.stringify(value)).not.toContain('raw-internal');
}

describe('Foundation error boundary', () => {
  beforeEach(() => {
    process.env.KITCHENIQ_ENVIRONMENT = 'automated_test';
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('preserves a frozen Foundation error safely', async () => {
    const correlationId = createCorrelationId();
    const frozen = createFoundationError('authorization.denied', 'authorization', 'Access is denied.', correlationId, false);

    const result = await runWithCorrelation(correlationId, () => executeWithFoundationErrorBoundary(() => { throw frozen; }));

    expect(result).toEqual(frozen);
    expectSafeProjection(result, correlationId);
  });

  test.each([
    new Error('raw-internal error message'),
    'raw-internal thrown string',
    { message: 'raw-internal object message', secret: 'raw-internal secret' }
  ])('converts unknown thrown values to a generic safe internal result', async (thrown) => {
    const correlationId = createCorrelationId();
    const result = await runWithCorrelation(correlationId, () => executeWithFoundationErrorBoundary(() => { throw thrown; }));

    expect(result).toEqual({
      ...createInternalFoundationError(correlationId),
      correlationId
    });
    expectSafeProjection(result, correlationId);
    expect((process.stdout.write as jest.Mock).mock.calls.some(([line]) => String(line).includes('"health_signal":"error"'))).toBe(true);
  });

  test('preserves frozen retryability in a known error', async () => {
    const correlationId = createCorrelationId();
    const frozen = createFoundationError('integration.transient_failure', 'integration_transient', 'Try again later.', correlationId, true);

    const result = await runWithCorrelation(correlationId, () => executeWithFoundationErrorBoundary(() => Promise.reject(frozen)));

    expect(result).toEqual(frozen);
    expect((result as { retryable: boolean }).retryable).toBe(true);
  });
});
