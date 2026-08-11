# Foundation decimal contract

KitchenIQ Foundation decimals are authoritative decimal values represented as ordinary decimal strings at system boundaries.

- JavaScript floating-point numbers are not accepted as authoritative decimal input.
- Decimal inputs must be plain base-10 text such as `0`, `-1`, `0.25`, or `123456789.12345678`.
- Invalid or missing input never becomes zero, `NaN`, or `Infinity`.
- Arithmetic uses `big.js` behind the Foundation wrapper and preserves exact decimal results for addition, subtraction, and multiplication.
- Explicit rounding is available through `roundDecimalToScale`, which uses `ROUND_HALF_UP`.
- Intermediate arithmetic is not rounded automatically.
- Frozen Foundation precision and scale constants are exposed for monetary totals, unit costs, physical quantities, and ratio/rate/percent values.
- Division is intentionally deferred for a later checkpoint with an explicit precision policy.
- Money, quantity, unit, and business-formula semantics remain deferred.
