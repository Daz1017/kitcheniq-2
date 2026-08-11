import Big from 'big.js';

Big.strict = true;

export type DecimalString = string;

const DECIMAL_PATTERN = /^[-+]?((\d+)(\.\d+)?|\.\d+)$/;

function serializeBigValue(value: Big): string {
  if (value.c.length === 1 && value.c[0] === 0) {
    return '0';
  }

  const raw = value.toString();
  const scientificMatch = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!scientificMatch) {
    return raw;
  }

  const [, sign, whole, fractional = '', exponentValue] = scientificMatch;
  const exponent = Number.parseInt(exponentValue, 10);
  const digits = `${whole}${fractional}`;
  const decimalPointIndex = whole.length + exponent;

  if (decimalPointIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalPointIndex - digits.length)}`;
  }

  if (decimalPointIndex <= 0) {
    return `${sign}0.${'0'.repeat(-decimalPointIndex)}${digits}`;
  }

  return `${sign}${digits.slice(0, decimalPointIndex)}.${digits.slice(decimalPointIndex)}`;
}

function normalizeDecimalText(value: string): string {
  if (value.length === 0 || /\s/.test(value)) {
    throw new Error('Invalid decimal input.');
  }

  if (!DECIMAL_PATTERN.test(value)) {
    throw new Error('Invalid decimal input.');
  }

  const normalizedValue = new Big(value);
  const normalized = serializeBigValue(normalizedValue);
  if (normalized === 'NaN' || normalized === 'Infinity' || normalized === '-Infinity') {
    throw new Error('Invalid decimal input.');
  }

  return normalized === '-0' ? '0' : normalized;
}

export function parseDecimal(value: unknown): DecimalString {
  if (typeof value !== 'string') {
    throw new Error('Decimal input must be a string.');
  }

  return normalizeDecimalText(value);
}

export function isDecimal(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    parseDecimal(value);
    return true;
  } catch {
    return false;
  }
}

export function addDecimal(a: DecimalString | string, b: DecimalString | string): DecimalString {
  const left = parseDecimal(a);
  const right = parseDecimal(b);
  return serializeBigValue(new Big(left).plus(right));
}

export function subtractDecimal(a: DecimalString | string, b: DecimalString | string): DecimalString {
  const left = parseDecimal(a);
  const right = parseDecimal(b);
  return serializeBigValue(new Big(left).minus(right));
}

export function multiplyDecimal(a: DecimalString | string, b: DecimalString | string): DecimalString {
  const left = parseDecimal(a);
  const right = parseDecimal(b);
  return serializeBigValue(new Big(left).times(right));
}

export function roundDecimalToScale(value: DecimalString | string, scale: number): DecimalString {
  const parsed = parseDecimal(value);
  if (!Number.isInteger(scale) || scale < 0) {
    throw new Error('Scale must be a non-negative integer.');
  }

  return new Big(parsed).toFixed(scale, Big.roundHalfUp).toString();
}
