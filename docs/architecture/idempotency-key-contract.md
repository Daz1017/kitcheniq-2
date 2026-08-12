# Idempotency Key Contract

FB-012 requires idempotency where protected operations, imports, integrations, or event consumers may be replayed. F-17 defines only the opaque `IdempotencyKey` primitive.

An idempotency key is caller-supplied, remains an ordinary string at runtime, and is not restricted to UUID format. Accepted values are preserved exactly. Primitive numeric input and coercion are prohibited, and the key itself is not a credential or proof that an operation is idempotent.

Key generation is the responsibility of the caller or owning contract. Operation binding, business-scope binding, request hashing, result-state handling, reuse conflict detection, persistence, retention, and replay protection are deferred. The eventual authoritative mechanism owns scope, request identity/hash, result state, 90-day replay protection, and permanent uniqueness rules where applicable.
