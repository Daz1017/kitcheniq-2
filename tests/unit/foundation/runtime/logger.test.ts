import { createCorrelationId } from '../../../../src/foundation/correlation';
import {
  appendOperationalLog,
  emitOperationalLog,
  logDebug,
  logError,
  logInfo,
  logWarn,
  type OperationalLogContext
} from '../../../../src/foundation/runtime/logger';
import { runWithCorrelation } from '../../../../src/foundation/runtime/correlation-context';

describe('operational logger', () => {
  const correlationId = createCorrelationId();
  const context: Omit<OperationalLogContext, 'severity'> = {
    component: 'test.logger',
    message: 'structured message',
    details: {
      nested: { token: 'secret', safe: 'value' },
      list: [{ password: 'hidden' }]
    }
  };

  beforeEach(() => {
    process.env.KITCHENIQ_ENVIRONMENT = 'automated_test';
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    ['debug', logDebug],
    ['info', logInfo],
    ['warn', logWarn],
    ['error', logError]
  ])('emits exact %s vocabulary as one-line JSON', (severity, log) => {
    runWithCorrelation(correlationId, () => log(context));

    const output = (process.stdout.write as jest.Mock).mock.calls[0][0] as string;
    expect(output.endsWith('\n')).toBe(true);
    expect(output.split('\n')).toHaveLength(2);
    expect(JSON.parse(output)).toMatchObject({
      severity,
      correlation_id: correlationId,
      environment: 'automated_test',
      details: {
        nested: { token: '[REDACTED]', safe: 'value' },
        list: [{ password: '[REDACTED]' }]
      }
    });
  });

  test('requires and uses the active correlation', () => {
    expect(() => emitOperationalLog(context)).toThrow('Correlation context is required');
    const record = runWithCorrelation(correlationId, () => emitOperationalLog(context));
    expect(record.correlation_id).toBe(correlationId);
    expect(record.environment).toBe('automated_test');
  });

  test('durable append receives sanitized authoritative context', async () => {
    const sink = jest.fn(async (received) => ({
      id: '123e4567-e89b-42d3-a456-426614174080',
      occurred_at: '2026-01-01T00:00:00.000Z',
      severity: received.severity!,
      correlation_id: received.correlationId!,
      environment: received.environment!,
      component: received.component,
      message: received.message,
      health_signal: received.healthSignal ?? null,
      error_code: received.errorCode ?? null,
      error_category: received.errorCategory ?? null,
      retryable: received.retryable ?? null,
      details: received.details ?? {}
    }));

    await runWithCorrelation(correlationId, () => appendOperationalLog({ ...context, details: { secret: 'do-not-persist' } }, sink));

    expect(sink).toHaveBeenCalledWith(expect.objectContaining({
      correlationId,
      environment: 'automated_test',
      details: { secret: '[REDACTED]' }
    }));
    expect(JSON.stringify(sink.mock.calls[0][0])).not.toContain('do-not-persist');
  });

  test('uses a safe fallback when stdout fails', () => {
    (process.stdout.write as jest.Mock).mockImplementation(() => {
      throw new Error('raw sink failure');
    });

    runWithCorrelation(correlationId, () => emitOperationalLog(context));

    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('Operational log sink failed.'));
    expect((process.stderr.write as jest.Mock).mock.calls[0][0]).not.toContain('raw sink failure');
  });
});
