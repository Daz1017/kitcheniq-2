import {
  MONETARY_TOTAL_PRECISION,
  MONETARY_TOTAL_SCALE,
  UNIT_COST_PRECISION,
  UNIT_COST_SCALE
} from '../decimal';

export const MONETARY_PRECISION_PROFILES = [
  'monetary_total',
  'unit_cost'
] as const;

export type MonetaryPrecisionProfile = (typeof MONETARY_PRECISION_PROFILES)[number];

export type MonetaryPrecisionMetadata = Readonly<{
  precision: number;
  scale: number;
}>;

const PRECISION_BY_PROFILE: Readonly<
  Record<MonetaryPrecisionProfile, MonetaryPrecisionMetadata>
> = Object.freeze({
  monetary_total: Object.freeze({
    precision: MONETARY_TOTAL_PRECISION,
    scale: MONETARY_TOTAL_SCALE
  }),
  unit_cost: Object.freeze({
    precision: UNIT_COST_PRECISION,
    scale: UNIT_COST_SCALE
  })
});

export function isMonetaryPrecisionProfile(
  value: unknown
): value is MonetaryPrecisionProfile {
  return typeof value === 'string'
    && (MONETARY_PRECISION_PROFILES as readonly string[]).includes(value);
}

export function precisionForMonetaryProfile(
  profile: MonetaryPrecisionProfile
): MonetaryPrecisionMetadata {
  return PRECISION_BY_PROFILE[profile];
}
