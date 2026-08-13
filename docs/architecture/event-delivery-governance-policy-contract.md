# Event Delivery Governance Policy Contract

F-XX defines immutable Foundation metadata for asynchronous event delivery requirements. It is governance metadata only and does not implement delivery engines, persistence, consumer processing, retries, or dead-letter infrastructure.

## Required Governance

- A transactional outbox or equivalent durable publication mechanism is required.
- Delivery guarantee is exactly `at_least_once`.

The policy is exposed as `EVENT_DELIVERY_GOVERNANCE_POLICY`, is read-only and frozen at runtime, and contains no delivery execution state.

## Scope

F-XX does not implement the following:

- event envelopes
- persistence or queue infrastructure
- dispatchers or delivery worker implementations
- retry schedules and backoff strategies
- consumer handlers or callbacks
- dead-letter queue behavior or persistence semantics
- infrastructure provisioning
- provider-specific delivery or storage configuration
- Supabase or other platform access

It records governance requirements only. Future delivery architecture must evolve through explicit Foundation contracts. F-XX does not authorize implementation shortcuts or runtime delivery semantics that contradict the policy.
