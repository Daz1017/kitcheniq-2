# Currency Code Contract

F-XX establishes the open, opaque currency code primitive used for monetary denomination metadata.

## CurrencyCode

- `CurrencyCode` is a branded string primitive.
- Values are ordinary strings at runtime and must survive JSON stringify/parse without transformation.
- A valid value must be a string, non-empty, not whitespace-only, and must not include leading or trailing whitespace.
- Preservation is exact: no trimming, lowercasing, canonicalization, or normalization occurs.
- The currency code is intentionally open and does not impose a KitchenIQ naming grammar.

## Construction and validation

- `createCurrencyCode(value: unknown): CurrencyCode` throws for invalid input.
- `isCurrencyCode(value: unknown): value is CurrencyCode` performs strict runtime validation.
- This primitive is intentionally distinct from all identifier and classification primitives in the Foundation package.

## Deferred monetary concerns

F-XX does not define exchange rates, denomination precision, amount arithmetic, ledger semantics, payment processing, or legal tender rules.

The primitive remains intentionally minimal: a string code for a currency symbol or ISO-like identifier without imposing a global convention.
