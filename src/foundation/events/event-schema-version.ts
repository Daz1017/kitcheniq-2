export type EventSchemaVersion = string & {
  readonly __eventSchemaVersionBrand: unique symbol;
};

export function createEventSchemaVersion(value: unknown): EventSchemaVersion {
  if (!isEventSchemaVersion(value)) {
    throw new Error('Event schema version must be a non-empty string without surrounding whitespace.');
  }

  return value;
}

export function isEventSchemaVersion(value: unknown): value is EventSchemaVersion {
  return typeof value === 'string'
    && value.length > 0
    && value.trim().length > 0
    && value === value.trim();
}
