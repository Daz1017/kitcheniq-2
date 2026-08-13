import {
  OPERATIONAL_HEALTH_SIGNALS,
  isOperationalHealthSignal,
  type OperationalHealthSignal
} from '../../../src/foundation/observability';

describe('Foundation operational health signals', () => {
  test('exposes exactly six unique canonical signal classes', () => {
    expect(OPERATIONAL_HEALTH_SIGNALS).toEqual([
      'error',
      'import_failure',
      'integration_failure',
      'event_backlog',
      'job_failure',
      'backup_failure'
    ]);
    expect(OPERATIONAL_HEALTH_SIGNALS).toHaveLength(6);
    expect(new Set(OPERATIONAL_HEALTH_SIGNALS).size).toBe(6);
  });

  test('accepts every canonical operational health signal', () => {
    for (const signal of OPERATIONAL_HEALTH_SIGNALS) {
      expect(isOperationalHealthSignal(signal)).toBe(true);
    }
  });

  test('rejects alternate spellings without normalization', () => {
    for (const signal of [
      'errors',
      'import',
      'integration',
      'event-backlog',
      'job',
      'backup',
      'backup_error',
      'ERROR'
    ]) {
      expect(isOperationalHealthSignal(signal)).toBe(false);
    }
  });

  test('rejects non-string values', () => {
    for (const signal of [null, undefined, 0, false, {}, []]) {
      expect(isOperationalHealthSignal(signal)).toBe(false);
    }
  });

  test('narrows unknown values to the signal class type', () => {
    const value: unknown = 'event_backlog';

    expect(isOperationalHealthSignal(value)).toBe(true);
    if (isOperationalHealthSignal(value)) {
      const signal: OperationalHealthSignal = value;
      expect(signal).toBe('event_backlog');
    }
  });

  test('round-trips signal classes through ordinary JSON strings', () => {
    for (const signal of OPERATIONAL_HEALTH_SIGNALS) {
      const parsed: unknown = JSON.parse(JSON.stringify(signal));

      expect(parsed).toBe(signal);
      expect(typeof parsed).toBe('string');
      expect(isOperationalHealthSignal(parsed)).toBe(true);
    }
  });

  test('does not define severity, threshold, alert, status, or record metadata', () => {
    const signalKeys = Object.keys(OPERATIONAL_HEALTH_SIGNALS);

    expect(signalKeys).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(signalKeys).not.toContain('severity');
    expect(signalKeys).not.toContain('threshold');
    expect(signalKeys).not.toContain('alertDestination');
    expect(signalKeys).not.toContain('healthStatus');
    expect(signalKeys).not.toContain('timestamp');
    expect(signalKeys).not.toContain('correlationId');
  });
});