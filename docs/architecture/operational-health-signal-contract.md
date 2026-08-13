# Operational Health Signal Contract

F-30 defines the minimum operational-health concern classes required by Foundation observability. It is a classification vocabulary only and exposes ordinary JSON string values.

## Canonical Signals

Exactly these six values are defined:

- `error`
- `import_failure`
- `integration_failure`
- `event_backlog`
- `job_failure`
- `backup_failure`

`error` represents the required operational exposure of errors at this classification level only. It is an operational-health signal class, not a log-severity taxonomy. `import_failure`, `integration_failure`, `job_failure`, and `backup_failure` identify operational failure classes. `event_backlog` identifies backlog health requiring operational visibility; it does not imply that every backlog condition is itself a failed event.

`isOperationalHealthSignal` accepts only the six exact lowercase values. It rejects alternate spellings, uppercase forms, and non-string values without normalization. Signal values survive ordinary JSON stringify/parse unchanged.

## Scope

F-30 does not implement detection, measurement, logging, alerting, escalation, thresholds, dashboards, incident management, remediation, metrics, tracing, health-state vocabulary, structured records, event-backlog measurement, backup monitoring, provider selection, database persistence, or Module 1-11 behavior.

No severity vocabulary is defined. `debug`, `info`, `warning`, `warn`, `critical`, and `fatal` are not F-30 concepts, and no `LogSeverity` is introduced. No health status model, alert destinations, escalation levels, trigger conditions, or operational thresholds are defined.

F-30 does not create `OperationalLogRecord`, `HealthSignalRecord`, or `ObservabilityEvent`, and does not define timestamp, message, severity, correlation, environment, service, module, or metadata fields. Correlation composition remains outside this primitive. F-18 through F-21 event primitives remain unchanged.

Future architecture may introduce additional observability concepts only through controlled Foundation evolution. F-30 must not be treated as permission for modules to invent incompatible observability classifications.