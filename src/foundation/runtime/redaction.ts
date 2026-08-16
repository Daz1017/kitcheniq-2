const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|passwd|secret|token|access_token|refresh_token|api_key|apikey|service_role|supabase_secret|supabase_key)/i;

export const REDACTED_VALUE = '[REDACTED]' as const;

export function redactSensitiveData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveData(entry)) as T;
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const clone: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(record)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        clone[key] = REDACTED_VALUE;
      } else {
        clone[key] = redactSensitiveData(nestedValue);
      }
    }
    return clone as T;
  }

  return value;
}
