# Event Producer Contract

F-20 establishes the open, opaque producer identity primitive required for asynchronous event emission.

## EventProducer

- `EventProducer` is a branded string primitive.
- Values are ordinary strings at runtime and must survive JSON stringify/parse without transformation.
- A valid value must be a string, non-empty, not whitespace-only, and must not include leading or trailing whitespace.
- Preservation is exact: no trimming, lowercasing, canonicalization, or normalization occurs.
- The producer name is intentionally open and not a regulated KitchenIQ catalog.

## Construction and validation

- `createEventProducer(value: unknown): EventProducer` throws for invalid input.
- `isEventProducer(value: unknown): value is EventProducer` performs strict runtime validation.
- This primitive is intentionally distinct from `EventId`, `EventType`, and all Module 1–11 identity primitives.

## Deferred event concerns

F-20 does not define a producer registry, event schema version, envelope, payload, outbox, dispatcher, retry logic, consumer model, or delivery semantics.

The primitive remains intentionally minimal: a string identity for the emitting system, without imposing a naming grammar or global catalog.
