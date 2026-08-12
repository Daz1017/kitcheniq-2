# Event ID Contract

F-18 establishes the immutable identity primitive required by FB-011 for cross-module asynchronous events.

## EventId

- `EventId` is `EntityId<'event'>` from the frozen F-02 identifier implementation.
- Generation uses F-02 secure UUIDv4 generation.
- Construction and runtime guards reuse F-02 UUIDv4 validation.
- An EventId is an ordinary canonical UUIDv4 string at runtime and survives normal JSON serialization.
- A retry or redelivery of the same persisted event retains its EventId; delivery does not create a replacement identity.

EventId is distinct from `CorrelationId`, which traces related request or workflow activity, and from `IdempotencyKey`, which is an opaque caller-supplied replay key.

## Deferred event concerns

F-18 does not create an event envelope. Event type, schema version, producer, applicable organization or location scope, occurrence time, causation identity, and validated payload remain deferred. Transactional outbox, persistence, delivery, retries, consumers, and deduplication also remain deferred.

The future delivery model is at least once. Exactly-once delivery must not be assumed.