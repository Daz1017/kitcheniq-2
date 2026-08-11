# Identifier Contract

This document describes the Foundation identifier primitive used in KitchenIQ 2.0.

Key points:

- Default surrogate identifier: UUIDv4 (RFC 4122) using Node's `crypto.randomUUID()`.
- Validation: runtime check ensures canonical structure, version 4, and RFC variant bits.
- TypeScript types: branded `UUID` and `EntityId<EntityName>` for entity-specific IDs.
- IDs are ordinary JSON-serializable strings; branding is a TypeScript compile-time aid only.
- Mutable attributes (names, codes, display values) MUST NOT be used as relational identifiers.
- External/legacy identifier mapping is out of scope for this baseline.

Validation details:

- Regex used: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (case-insensitive).
- This enforces the UUID canonical layout, enforces version nibble `4`, and variant bits `8|9|a|b`.

Generation:

- Use `crypto.randomUUID()` to create UUIDv4 values.

Notes:

- No external UUID libraries are used.
- Database-level defaults/constraints, and mapping to external IDs are deferred to later work.
