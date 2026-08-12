export type EventType = string & {
  readonly __eventTypeBrand: unique symbol;
};

export function createEventType(value: unknown): EventType {
  if (!isEventType(value)) {
    throw new Error('Event type must be a non-empty string without surrounding whitespace.');
  }

  return value;
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string'
    && value.length > 0
    && value.trim().length > 0
    && value === value.trim();
}