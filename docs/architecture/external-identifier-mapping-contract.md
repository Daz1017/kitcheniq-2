# External Identifier Mapping Contract

F-15 provides the source-namespaced opaque external reference. F-02 provides the KitchenIQ UUIDv4 entity identity. F-16 explicitly connects those two values in one immutable mapping reference.

The mapping is representation-only plain data with exactly `externalRef` and `kitchenIqId`. It performs no lookup, persistence, or external access.

TypeScript entity brands can distinguish target entity types at compile time, but those brands do not survive ordinary JSON serialization. Runtime validation can establish only that `kitchenIqId` is a valid UUIDv4; authoritative entity existence and entity-type validation belong to the owning application or persistence contract.

F-16 does not enforce global mapping uniqueness, provide reverse lookup, or create a registry. Persistence, reconciliation, provenance, migration execution, and integration execution are deferred.
