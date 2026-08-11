export type ValueStateKind = 'known' | 'unknown' | 'not_applicable';

export interface KnownValueState<T = unknown> {
  readonly status: 'known';
  readonly value: T;
}

export interface UnknownValueState {
  readonly status: 'unknown';
}

export interface NotApplicableValueState {
  readonly status: 'not_applicable';
}

export type ValueState<T = unknown> =
  | KnownValueState<T>
  | UnknownValueState
  | NotApplicableValueState;

export function createKnownValueState<T>(value: T): KnownValueState<T> {
  if (value === null || value === undefined) {
    throw new Error('Known value state requires a non-null value.');
  }

  return { status: 'known', value };
}

export function createUnknownValueState(): UnknownValueState {
  return { status: 'unknown' };
}

export function createNotApplicableValueState(): NotApplicableValueState {
  return { status: 'not_applicable' };
}

export function isKnownValueState<T>(value: ValueState<T>): value is KnownValueState<T>;
export function isKnownValueState(value: unknown): value is KnownValueState;
export function isKnownValueState(value: unknown): value is KnownValueState {
  return isValueState(value) && value.status === 'known';
}

export function isUnknownValueState(value: unknown): value is UnknownValueState {
  return isValueState(value) && value.status === 'unknown';
}

export function isNotApplicableValueState(value: unknown): value is NotApplicableValueState {
  return isValueState(value) && value.status === 'not_applicable';
}

export function isValueState(value: unknown): value is ValueState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.status === 'known') {
    return candidate.value !== null && candidate.value !== undefined;
  }

  if (candidate.status === 'unknown' || candidate.status === 'not_applicable') {
    return !('value' in candidate);
  }

  return false;
}
