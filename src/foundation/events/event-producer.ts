export type EventProducer = string & {
  readonly __eventProducerBrand: unique symbol;
};

export function createEventProducer(value: unknown): EventProducer {
  if (!isEventProducer(value)) {
    throw new Error('Event producer must be a non-empty string without surrounding whitespace.');
  }

  return value;
}

export function isEventProducer(value: unknown): value is EventProducer {
  return typeof value === 'string'
    && value.length > 0
    && value.trim().length > 0
    && value === value.trim();
}
