# Idempotency Governance Policy Contract

## Purpose

This contract defines the Foundation-level governance metadata for idempotent operations without implementing runtime execution, persistence, request hashing, or replay behavior.

## Authoritative binding

The authoritative idempotency governance policy binds the following components:

* operation
* scope
* idempotency_key
* request_hash
* result_reference

The binding is metadata-only. The runtime representation of each component remains deferred unless a future checkpoint defines it explicitly.

## Reuse rejection semantics

The policy requires that reuse of the same idempotency key for a materially different request be rejected. The policy does not define how a request is compared at runtime, and it does not include a payload-comparison or canonicalization implementation.

## Replay protection

The minimum replay protection period is 90 days. This is a minimum retention requirement and not a maximum retention period. The policy does not encode the requirement as a TTL, expiration timestamp, or duration engine.

## External-source uniqueness

Where an external source provides a durable identifier, externally identified financial and import records require permanent uniqueness protection. The qualifier "where available" and "where source permits" is preserved; the policy does not assume every external source exposes a durable identifier.

## Deferred decisions

The following remain deferred by F-33 and are intentionally excluded from this primitive:

* canonical request representation
* hashing algorithm
* operation vocabulary or operation catalog
* concrete runtime scope schema
* result reference representation
* replay response behavior
* persistence and storage behavior
* middleware and execution wrapper behavior
* migration, RLS, or database uniqueness constraints
* Supabase or provider access

## Guardrails

This Foundation primitive is governance metadata only. It does not define idempotent request execution, request processing, persistence, cleanup, event composition, or module-specific idempotency policy.
