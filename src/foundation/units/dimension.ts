export const DIMENSIONS = ['mass', 'volume', 'count'] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export function isDimension(value: unknown): value is Dimension {
  return typeof value === 'string' && (value === 'mass' || value === 'volume' || value === 'count');
}
