import {
  parseDecimal,
  isDecimal
} from '../decimal';
import type { DecimalString } from '../decimal/decimal';

import {
  type CurrencyCode,
  createCurrencyCode,
  isCurrencyCode
} from '../currency';

export type Money = Readonly<{
  amount: DecimalString;
  currency: CurrencyCode;
}>;

export function createMoney(
  amount: unknown,
  currency: unknown
): Money {
  return Object.freeze({
    amount: parseDecimal(amount),
    currency: createCurrencyCode(currency)
  });
}

export function isMoney(value: unknown): value is Money {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (Object.getPrototypeOf(candidate) !== Object.prototype
    && Object.getPrototypeOf(candidate) !== null) {
    return false;
  }

  const keys = Reflect.ownKeys(candidate);
  if (keys.length !== 2 || !keys.includes('amount') || !keys.includes('currency')) {
    return false;
  }

  return isDecimal(candidate.amount) && isCurrencyCode(candidate.currency);
}
