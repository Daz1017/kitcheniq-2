# Event Type Contract

F-19 establishes the event-type identity field required by FB-011 for asynchronous events.

## EventType

- `EventType` is a distinct, open string primitive.
- F-19 defines representation and validation only; it does not establish a global event catalog.
- No naming grammar, separator rule, casing rule, namespace, or normalization is imposed.
- Valid text is non-empty, not whitespace-only, has no surrounding whitespace, and is preserved exactly.
- Concrete event types belong to their future owning contracts.

`EventType` is distinct from `EventId`, `IdempotencyKey`, and `PrivilegedOperationClass`. It remains an ordinary JSON string after serialization.

## Deferred event concerns

F-19 does not create Module 1-11 event names, a schema-version primitive, producer identity, business scope, occurrence time, correlation identity, causation identity, payload contract, event envelope, outbox, persistence, or delivery behavior. At-least-once delivery remains the controlling future model.