import { createMoney, isMoney } from '../../../src/foundation/money';

describe('Foundation money', () => {
  test('accepts valid decimal amounts and currency codes', () => {
    const values = [
      { amount: '0', currency: 'USD' },
      { amount: '10.50', currency: 'EUR' },
      { amount: '-1.25', currency: 'JPY' },
      { amount: '123.456', currency: 'GBP' }
    ];

    for (const value of values) {
      expect(createMoney(value.amount, value.currency)).toEqual({
        ...value,
        amount: value.amount === '10.50' ? '10.5' : value.amount
      });
      expect(isMoney(value)).toBe(true);
    }
  });

  test('preserves high precision without automatic rounding', () => {
    const money = createMoney('0.123456789123', 'USD');

    expect(money.amount).toBe('0.123456789123');
  });

  test('permits negative money values', () => {
    const money = createMoney('-2.5', 'USD');

    expect(money.amount).toBe('-2.5');
  });

  test('inherits the open exact CurrencyCode contract', () => {
    const lowerCase = createMoney('1.25', 'usd');
    const nonIsoShaped = createMoney('1.25', 'currency:test');
    const numericLooking = createMoney('1.25', '840');

    expect(lowerCase.currency).toBe('usd');
    expect(nonIsoShaped.currency).toBe('currency:test');
    expect(numericLooking.currency).toBe('840');
  });

  test('rejects invalid decimal amounts', () => {
    for (const amount of ['', ' ', ' 1.00', '1.00 ', 'abc', 'NaN']) {
      expect(isMoney({ amount, currency: 'USD' })).toBe(false);
      expect(() => createMoney(amount, 'USD')).toThrow();
    }
  });

  test('rejects invalid currency codes', () => {
    for (const currency of ['', ' ', ' usd', 'USD ']) {
      expect(isMoney({ amount: '10.00', currency })).toBe(false);
      expect(() => createMoney('10.00', currency)).toThrow();
    }
  });

  test('requires a plain object with exactly amount and currency', () => {
    expect(isMoney({ amount: '10.00', currency: 'USD', extra: true })).toBe(false);
    expect(isMoney(Object.create({ amount: '10.00', currency: 'USD' }))).toBe(false);

    const hiddenExtra = { amount: '10.00', currency: 'USD' };
    Object.defineProperty(hiddenExtra, 'extra', { value: true });
    expect(isMoney(hiddenExtra)).toBe(false);
  });

  test('rejects non-object and null values', () => {
    for (const value of [null, undefined, 123, 'USD', [], false]) {
      expect(isMoney(value)).toBe(false);
      if (value !== null && value !== undefined) {
        expect(() => createMoney(value as never, 'USD')).toThrow();
      }
    }
  });

  test('round-trips as a JSON object', () => {
    const money = createMoney('10.50', 'USD');
    const parsed: { money: unknown } = JSON.parse(JSON.stringify({ money }));

    expect(parsed.money).toEqual(money);
    expect(isMoney(parsed.money)).toBe(true);
  });
});
