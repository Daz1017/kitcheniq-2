# Non-Monetary Precision Profile Contract

F-25 defines the two non-monetary precision profile names and their approved precision and scale metadata.

## Profiles

- `physical_quantity` uses precision `20` and scale `8`.
- `ratio_rate_percent` uses precision `18` and scale `8`.

The profile names are exposed through the readonly `NON_MONETARY_PRECISION_PROFILES` tuple. `precisionForNonMonetaryProfile` returns immutable metadata and reuses the frozen F-04 decimal precision and scale exports.

## Validation

`isNonMonetaryPrecisionProfile` accepts only the two exact profile strings. It rejects aliases, normalization attempts, and all non-string values.

## Scope

This primitive only describes approved precision and scale metadata. It does not perform calculations, ratio math, rate math, percentage math, rounding, quantity mutation, unit conversion, database work, SQL, RLS, persistence, module-field mapping, or Module 1-11 logic.

Exactly these two profile names are defined:

- `physical_quantity`
- `ratio_rate_percent`
