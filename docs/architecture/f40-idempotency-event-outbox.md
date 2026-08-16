# F-40 Idempotency, Events, and Outbox

F-40 adds internal PostgreSQL persistence for idempotency records, immutable event envelopes, and a transactional outbox. These tables remain in the private database boundary and are not exposed through the Data API.

Create Location is the Foundation proof command. Its binding is the exact operation, organization scope, F-17 idempotency key, and a SHA-256 hash of the command-specific canonical request `{"organizationId":"..."}`. Same-binding replays return the persisted location result without a second mutation, audit, event, or outbox row. A different hash is rejected, and idempotency records are retained indefinitely, exceeding the 90-day replay-protection floor.

The successful transaction writes the location, F-39 audit record, immutable `foundation.location.created` event, one outbox row, and completed result reference atomically. The event stores the same CorrelationId as the audit and uses the idempotency record as its causation reference. Event payloads contain only location and organization identifiers.

Outbox delivery is at least once, not exactly once. Service-only claim, acknowledge, and release boundaries use row locks, `SKIP LOCKED`, UUID claim tokens, and bounded leases. Expired claims are reclaimable; a handler failure leaves work available for redelivery. `processOutboxBatch` is a server-only TypeScript worker abstraction and does not define module handlers or consumer deduplication.

F-40 does not add a universal canonicalization standard, result/entity registry, broker, webhook delivery, retry/backoff taxonomy, dead-letter policy, or Module event catalog. Future consumers own idempotent side effects for duplicate delivery.