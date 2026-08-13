export const OPERATIONAL_HEALTH_SIGNALS = [
  'error',
  'import_failure',
  'integration_failure',
  'event_backlog',
  'job_failure',
  'backup_failure'
] as const;

export type OperationalHealthSignal =
  (typeof OPERATIONAL_HEALTH_SIGNALS)[number];

export function isOperationalHealthSignal(
  value: unknown
): value is OperationalHealthSignal {
  return typeof value === 'string'
    && (OPERATIONAL_HEALTH_SIGNALS as readonly string[]).includes(value);
}