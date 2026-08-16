# F-41 Runtime Observability and Error Boundaries

F-41 provides runtime correlation propagation, structured operational logging, recursive redaction, and a safe boundary around the frozen F-03 error contract.

## Correlation

`AsyncLocalStorage` carries one valid F-03 `CorrelationId` through nested and concurrent asynchronous work. Create Location establishes one correlation for the complete invocation; the same value is passed to the F-39 audit and F-40 event/database command. The outbox worker enters the persisted event correlation before invoking a handler.

## Operational Logs

Operational severity is exactly `debug`, `info`, `warn`, or `error`. Every emitted record is one-line JSON and derives its environment from the frozen `KITCHENIQ_ENVIRONMENT` runtime value. Durable records are appended through the service-only operational-log sink; the internal store supplies the authoritative UUID and occurrence time. Search is service-only through the public search function and the table is not directly exposed.

Log details are recursively redacted by case-insensitive sensitive-key matching. Arrays and nested objects are copied, the original input is unchanged, and sensitive values become `[REDACTED]`. Log sink failures use a safe fallback message and do not change the protected operation's result.

Retention is exactly 30 days and runs daily through the F-41 `pg_cron` job. F-41 defines all six F-30 health signals: `error`, `import_failure`, `integration_failure`, `event_backlog`, `job_failure`, and `backup_failure`. It does not define automatic backlog thresholds, an external observability provider, or an external alert transport.

## Error Boundary

The boundary reuses F-03's frozen categories, safe projection, correlation field, and retryability. Valid Foundation errors are preserved. Unknown `Error`, string, and object throws become `internal.generic` with the generic safe user message. Stacks, raw messages, SQL, secrets, and dependency payloads are never returned or persisted. Boundary failures emit an operational record with `health_signal=error`.

## Separation and Scope

Audit, event, and operational-log persistence remain separate internal stores. F-41 does not replace F-39 provenance or F-40 event/outbox behavior. There is no automatic backlog threshold and no external observability or alerting integration. F-42 owns backup-health integration.
