# Monetary Precision Profile Contract

F-24 defines the two frozen monetary precision profile names and their approved precision and scale metadata.

## Profiles

- `monetary_total` uses precision `19` and scale `4`.
- `unit_cost` uses precision `20` and scale `8`.

The profile names are exposed through the readonly `MONETARY_PRECISION_PROFILES` tuple. `precisionForMonetaryProfile` returns the corresponding metadata and reuses the frozen F-04 decimal precision and scale exports.

## Scope

This primitive only describes approved precision and scale metadata. It does not perform rounding, arithmetic, mutation, persistence, SQL or database mapping, module-field mapping, currency conversion, or profile expansion.

Exactly these two profile names are defined:

- `monetary_total`
- `unit_cost`
