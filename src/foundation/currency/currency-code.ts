export type CurrencyCode = string & {
  readonly __currencyCodeBrand: unique symbol;
};

export function createCurrencyCode(value: unknown): CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new Error('Currency code must be a non-empty string without surrounding whitespace.');
  }

  return value;
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string'
    && value.length > 0
    && value.trim().length > 0
    && value === value.trim();
}
