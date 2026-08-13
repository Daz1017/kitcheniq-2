# Event Schema Version Contract

F-21 establishes the open, opaque schema version primitive required for event serialization metadata.

## EventSchemaVersion

- `EventSchemaVersion` is a branded string primitive.
- Values are ordinary strings at runtime and must survive JSON stringify/parse without transformation.
- A valid value must be a string, non-empty, not whitespace-only, and must not include leading or trailing whitespace.
- Preservation is exact: no trimming, lowercasing, canonicalization, or normalization occurs.
- The schema version is intentionally open and does not impose a KitchenIQ naming grammar.

## Construction and validation

- `createEventSchemaVersion(value: unknown): EventSchemaVersion` throws for invalid input.
- `isEventSchemaVersion(value: unknown): value is EventSchemaVersion` performs strict runtime validation.
- This primitive is intentionally distinct from `EventId`, `EventType`, `EventProducer`, and all Module 1–11 identity primitives.

## Deferred event concerns

F-21 does not define a schema registry, version policy, envelope, payload validation, outbox, dispatch, consumer model, or delivery semantics.

The primitive remains intentionally minimal: a string version identifier for an event schema representation without imposing a global convention.
