# Money Contract

F-XX establishes the value object used to represent a monetary amount with an explicit currency.

## Money

- `Money` is a value object containing a decimal amount and a `CurrencyCode`.
- `amount` is a canonical decimal string produced by the Foundation decimal parser.
- `currency` is a validated `CurrencyCode` and remains exact without trimming or normalization.
- A `Money` value is ordinary JSON-compatible data at runtime and survives `JSON.stringify`/`JSON.parse` without transformation.

## Construction and validation

- `createMoney(amount: unknown, currency: unknown): Money` throws for invalid input.
- `createMoney` returns a frozen object containing exactly `amount` and `currency`.
- `isMoney(value: unknown): value is Money` accepts only a plain object with exactly `amount` and `currency` and performs strict runtime validation.
- This primitive is intentionally distinct from `Quantity`, which is a decimal value bound to a canonical unit, and from `CurrencyCode`, which is only the currency identifier.

## Deferred concerns

F-XX does not define exchange-rate conversion, tax calculation, subunit rounding policy, ledger accounting, or payment processing.

The primitive remains intentionally minimal: the combination of a currency amount and a currency code for monetary value representation.
