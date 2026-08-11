import { type Dimension } from './dimension';

export const CANONICAL_UNIT_CODES = ['g', 'mL', 'ea'] as const;

export type CanonicalUnitCode = (typeof CANONICAL_UNIT_CODES)[number];

export const CANONICAL_UNIT_DIMENSIONS: Record<CanonicalUnitCode, Dimension> = {
  g: 'mass',
  mL: 'volume',
  ea: 'count'
};

export function isCanonicalUnitCode(value: unknown): value is CanonicalUnitCode {
  return typeof value === 'string' && (value === 'g' || value === 'mL' || value === 'ea');
}

export function dimensionForCanonicalUnit(unit: CanonicalUnitCode): Dimension;
export function dimensionForCanonicalUnit(unit: unknown): Dimension;
export function dimensionForCanonicalUnit(unit: unknown): Dimension {
  if (!isCanonicalUnitCode(unit)) {
    throw new Error('Canonical unit must be one of: g, mL, ea.');
  }

  return CANONICAL_UNIT_DIMENSIONS[unit];
}
