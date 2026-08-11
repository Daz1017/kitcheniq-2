# Foundation Error Contract

This document describes the KitchenIQ Foundation error contract authorized by F-03.

## Correlation Identity

* Uses the existing UUIDv4 Foundation primitive.
* `CorrelationId` is a branded UUIDv4 type that remains an ordinary string at runtime.
* Correlation IDs are generated securely with `createCorrelationId()`.
* Correlation IDs are included in public-safe error data to support user/support workflows.

## Canonical Error Categories

The frozen categories are:

* `validation`
* `authentication`
* `authorization`
* `not_found`
* `conflict`
* `idempotency`
* `integration_transient`
* `internal`

These categories are the only ones implemented in F-03.

## Public Error Contract

A Foundation error contains:

* `code` — machine-readable error code
* `category` — one of the frozen Foundation categories
* `userMessage` — safe text for ordinary users
* `correlationId` — a Foundation correlation identifier
* `retryable` — whether retry may reasonably succeed

The contract is ordinary JSON-compatible data.

## Retryability Semantics

* `retryable: true` means a retry may reasonably succeed later.
* `retryable: false` means retry is not expected to resolve the failure.

## Public vs Internal Diagnostics

* Public-safe projection exposes only the defined contract fields.
* It must not expose stack traces, SQL, secrets, raw dependency payloads, or infrastructure diagnostics.
* Internal failures may surface a generic safe message such as `An internal error occurred.` with a correlation reference.

## Deferred Systems

F-03 does not implement logging, persistence, authentication, authorization enforcement, database schemas, Supabase integration, or module-specific error catalogs.
