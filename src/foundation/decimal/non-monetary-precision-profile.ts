import {
  PHYSICAL_QUANTITY_PRECISION,
  PHYSICAL_QUANTITY_SCALE,
  RATIO_RATE_PERCENT_PRECISION,
  RATIO_RATE_PERCENT_SCALE
} from './precision';

export const NON_MONETARY_PRECISION_PROFILES = [
  'physical_quantity',
  'ratio_rate_percent'
] as const;

export type NonMonetaryPrecisionProfile =
  (typeof NON_MONETARY_PRECISION_PROFILES)[number];

export type NonMonetaryPrecisionMetadata = Readonly<{
  precision: number;
  scale: number;
}>;

const PRECISION_BY_PROFILE: Readonly<
  Record<NonMonetaryPrecisionProfile, NonMonetaryPrecisionMetadata>
> = Object.freeze({
  physical_quantity: Object.freeze({
    precision: PHYSICAL_QUANTITY_PRECISION,
    scale: PHYSICAL_QUANTITY_SCALE
  }),
  ratio_rate_percent: Object.freeze({
    precision: RATIO_RATE_PERCENT_PRECISION,
    scale: RATIO_RATE_PERCENT_SCALE
  })
});

export function isNonMonetaryPrecisionProfile(
  value: unknown
): value is NonMonetaryPrecisionProfile {
  return typeof value === 'string'
    && (NON_MONETARY_PRECISION_PROFILES as readonly string[]).includes(value);
}

export function precisionForNonMonetaryProfile(
  profile: NonMonetaryPrecisionProfile
): NonMonetaryPrecisionMetadata {
  return PRECISION_BY_PROFILE[profile];
}
