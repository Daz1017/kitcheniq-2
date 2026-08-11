# Foundation

This package provides shared Foundation infrastructure used across KitchenIQ 2.0 modules.

It includes:

* `CorrelationId` as a UUIDv4-based identifier primitive for request tracing and diagnostics.
* `FoundationErrorContract` as the stable error contract that includes `code`, `category`, `userMessage`, `correlationId`, and `retryable`.
* Foundation decimal primitives for authoritative decimal parsing, exact arithmetic, and explicit half-up rounding.
* Foundation value-state primitives for representing `known`, `unknown`, and `not_applicable` without fallback behavior.
* Foundation dimension and canonical base-unit primitives for the frozen unit substrate (`mass`, `volume`, `count`; `g`, `mL`, `ea`).
* Foundation quantity primitives for canonical decimal quantities over the frozen unit substrate.
* Foundation business-scope primitives for immutable organization and location scope representation.

Foundation owns the shared primitives and contracts in `src/foundation` and exposes them for other modules to consume.
