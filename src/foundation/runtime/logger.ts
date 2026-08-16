import { type CorrelationId } from '../correlation';
import { type EnvironmentClass } from '../environment';
import { type FoundationErrorCategory } from '../errors';
import { type OperationalHealthSignal } from '../observability';
import { createClient } from '@supabase/supabase-js';
import { loadKitchenIqEnvironment } from './environment-loader';
import { currentCorrelationId } from './correlation-context';
import { redactSensitiveData, REDACTED_VALUE } from './redaction';
import { type SupabaseServerConfig } from './supabase-server-config';

export type OperationalLogSeverity = 'debug' | 'info' | 'warn' | 'error';

export type OperationalLogContext = Readonly<{
  component: string;
  message: string;
  correlationId?: CorrelationId;
  healthSignal?: OperationalHealthSignal | null;
  errorCode?: string | null;
  errorCategory?: FoundationErrorCategory | null;
  retryable?: boolean | null;
  details?: Record<string, unknown>;
  environment?: EnvironmentClass;
  severity?: OperationalLogSeverity;
}>;

export type PersistedOperationalLog = Readonly<{
  id: string;
  occurred_at: string;
  severity: OperationalLogSeverity;
  correlation_id: string;
  environment: EnvironmentClass;
  component: string;
  message: string;
  health_signal: OperationalHealthSignal | null;
  error_code: string | null;
  error_category: FoundationErrorCategory | null;
  retryable: boolean | null;
  details: Record<string, unknown>;
}>;

export type OperationalLogSink = (context: OperationalLogContext) => Promise<PersistedOperationalLog>;

const OPERATIONAL_LOG_SEVERITY_VALUES = new Set<OperationalLogSeverity>(['debug', 'info', 'warn', 'error']);

export function sanitizeOperationalLogContext(
  context: OperationalLogContext
): Required<Pick<OperationalLogContext, 'severity' | 'environment' | 'correlationId'>> & OperationalLogContext {
  const normalizedSeverity = context.severity && OPERATIONAL_LOG_SEVERITY_VALUES.has(context.severity)
    ? context.severity
    : 'info';

  const correlationId = context.correlationId ?? currentCorrelationId() ?? (() => {
    throw new Error('Correlation context is required for operational logging.');
  })();

  const environment = context.environment ?? loadKitchenIqEnvironment();

  return {
    ...context,
    severity: normalizedSeverity,
    environment,
    correlationId,
    details: context.details ? redactSensitiveData(context.details) : {}
  };
}

export function emitOperationalLog(context: OperationalLogContext): PersistedOperationalLog {
  const sanitized = sanitizeOperationalLogContext(context);
  const record: PersistedOperationalLog = {
    id: '00000000-0000-0000-0000-000000000000',
    occurred_at: new Date().toISOString(),
    severity: sanitized.severity,
    correlation_id: sanitized.correlationId,
    environment: sanitized.environment,
    component: sanitized.component,
    message: sanitized.message,
    health_signal: sanitized.healthSignal ?? null,
    error_code: sanitized.errorCode ?? null,
    error_category: sanitized.errorCategory ?? null,
    retryable: sanitized.retryable ?? null,
    details: sanitized.details ?? {}
  };

  const json = JSON.stringify({
    ...record,
    details: record.details,
    correlation_id: record.correlation_id,
    health_signal: record.health_signal,
    error_code: record.error_code,
    error_category: record.error_category,
    output: 'foundation_operational_log'
  });

  try {
    process.stdout.write(`${json}\n`);
  } catch {
    try {
      process.stderr.write('{"output":"foundation_operational_log","severity":"error","message":"Operational log sink failed."}\n');
    } catch {
      // Logging must not change the outcome of the protected operation.
    }
  }
  return record;
}

export async function appendOperationalLog(
  context: OperationalLogContext,
  sink: OperationalLogSink
): Promise<PersistedOperationalLog> {
  const sanitized = sanitizeOperationalLogContext(context);
  const record = await sink(sanitized);
  emitOperationalLog({ ...sanitized, environment: record.environment });
  return record;
}

export function createSupabaseOperationalLogSink(config: SupabaseServerConfig): OperationalLogSink {
  const client = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  return async (context) => {
    const sanitized = sanitizeOperationalLogContext(context);
    const { data, error } = await client.rpc('append_operational_log', {
      p_severity: sanitized.severity,
      p_correlation_id: sanitized.correlationId,
      p_environment: sanitized.environment,
      p_component: sanitized.component,
      p_message: sanitized.message,
      p_health_signal: sanitized.healthSignal ?? null,
      p_error_code: sanitized.errorCode ?? null,
      p_error_category: sanitized.errorCategory ?? null,
      p_retryable: sanitized.retryable ?? null,
      p_details: sanitized.details ?? {}
    });
    if (error || typeof data !== 'string') {
      throw error ?? new Error('Operational log append was rejected.');
    }

    return {
      id: data,
      occurred_at: new Date().toISOString(),
      severity: sanitized.severity,
      correlation_id: sanitized.correlationId,
      environment: sanitized.environment,
      component: sanitized.component,
      message: sanitized.message,
      health_signal: sanitized.healthSignal ?? null,
      error_code: sanitized.errorCode ?? null,
      error_category: sanitized.errorCategory ?? null,
      retryable: sanitized.retryable ?? null,
      details: sanitized.details ?? {}
    };
  };
}

export function logDebug(context: Omit<OperationalLogContext, 'severity'>): PersistedOperationalLog {
  return emitOperationalLog({ ...context, severity: 'debug' });
}

export function logInfo(context: Omit<OperationalLogContext, 'severity'>): PersistedOperationalLog {
  return emitOperationalLog({ ...context, severity: 'info' });
}

export function logWarn(context: Omit<OperationalLogContext, 'severity'>): PersistedOperationalLog {
  return emitOperationalLog({ ...context, severity: 'warn' });
}

export function logError(context: Omit<OperationalLogContext, 'severity'>): PersistedOperationalLog {
  return emitOperationalLog({ ...context, severity: 'error' });
}

export function emitOperationalHealthSignal(
  healthSignal: OperationalHealthSignal,
  context: Omit<OperationalLogContext, 'severity' | 'healthSignal'>
): PersistedOperationalLog {
  return emitOperationalLog({ ...context, severity: 'info', healthSignal });
}

export function redactOperationalValue(value: unknown): unknown {
  return value === REDACTED_VALUE ? REDACTED_VALUE : redactSensitiveData(value);
}
