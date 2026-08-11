# Foundation value-state contract

KitchenIQ Foundation value states model whether a value is known, unknown, or not applicable.

- Exactly three states are authorized: `known`, `unknown`, and `not_applicable`.
- A `known` state carries an actual value; `null` and `undefined` are rejected.
- Known zero is distinct from unknown.
- `unknown` means unknown or not supplied.
- `not_applicable` is semantically distinct from `unknown`.
- `unknown` and `not_applicable` contain no fabricated `value`.
- No automatic fallback or substitution occurs.
- Calculation propagation is deferred.
- Database representation is deferred.
- Money, Quantity, and Module-specific statuses are deferred.
