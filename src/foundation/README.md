# Foundation

This package provides shared Foundation infrastructure used across KitchenIQ 2.0 modules.

It includes:

* `CorrelationId` as a UUIDv4-based identifier primitive for request tracing and diagnostics.
* `FoundationErrorContract` as the stable error contract that includes `code`, `category`, `userMessage`, `correlationId`, and `retryable`.

Foundation owns the shared primitives and contracts in `src/foundation` and exposes them for other modules to consume.
