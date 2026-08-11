import {
  createKnownValueState,
  createNotApplicableValueState,
  createUnknownValueState,
  isKnownValueState,
  isNotApplicableValueState,
  isUnknownValueState,
  isValueState,
  type ValueState,
  type ValueStateKind
} from '../../../src/foundation/value-state';

describe('Foundation value state', () => {
  test('creates and identifies the three authorized value states', () => {
    const known = createKnownValueState('abc');
    const unknown = createUnknownValueState();
    const notApplicable = createNotApplicableValueState();

    expect(isKnownValueState(known)).toBe(true);
    expect(isUnknownValueState(unknown)).toBe(true);
    expect(isNotApplicableValueState(notApplicable)).toBe(true);

    expect(isKnownValueState(unknown)).toBe(false);
    expect(isUnknownValueState(known)).toBe(false);
    expect(isNotApplicableValueState(known)).toBe(false);
  });

  test('accepts legitimate known values and rejects null and undefined', () => {
    expect(createKnownValueState(0).value).toBe(0);
    expect(createKnownValueState('').value).toBe('');
    expect(createKnownValueState(false).value).toBe(false);
    expect(createKnownValueState('0').value).toBe('0');

    expect(() => createKnownValueState(null as unknown as string)).toThrow();
    expect(() => createKnownValueState(undefined as unknown as string)).toThrow();
  });

  test('guards strict unknown and not applicable shape', () => {
    expect(isValueState({ status: 'unknown' })).toBe(true);
    expect(isValueState({ status: 'not_applicable' })).toBe(true);
    expect(isValueState({ status: 'unknown', value: null })).toBe(false);
    expect(isValueState({ status: 'unknown', value: 0 })).toBe(false);
    expect(isValueState({ status: 'unknown', value: undefined })).toBe(false);
    expect(isValueState({ status: 'not_applicable', value: null })).toBe(false);
    expect(isValueState({ status: 'not_applicable', value: 0 })).toBe(false);
    expect(isValueState({ status: 'not_applicable', value: undefined })).toBe(false);
  });

  test('preserves generic typing for known value states', () => {
    const state: ValueState<string> = createKnownValueState('abc');
    if (isKnownValueState(state)) {
      const narrowed: string = state.value;
      expect(narrowed).toBe('abc');
    }
  });

  test('exposes the authorized status values', () => {
    const statuses: ValueStateKind[] = ['known', 'unknown', 'not_applicable'];
    expect(statuses).toHaveLength(3);
  });

  test('round-trips canonical JSON for all three states', () => {
    const known = createKnownValueState('1.25');
    const unknown = createUnknownValueState();
    const notApplicable = createNotApplicableValueState();

    const knownJson = JSON.stringify(known);
    const unknownJson = JSON.stringify(unknown);
    const notApplicableJson = JSON.stringify(notApplicable);

    expect(knownJson).toBe('{"status":"known","value":"1.25"}');
    expect(unknownJson).toBe('{"status":"unknown"}');
    expect(notApplicableJson).toBe('{"status":"not_applicable"}');

    const parsedKnown = JSON.parse(knownJson);
    const parsedUnknown = JSON.parse(unknownJson);
    const parsedNotApplicable = JSON.parse(notApplicableJson);

    expect(parsedKnown.status).toBe('known');
    expect(parsedKnown.value).toBe('1.25');
    expect(typeof parsedKnown.value).toBe('string');
    expect(parsedUnknown.status).toBe('unknown');
    expect(parsedNotApplicable.status).toBe('not_applicable');
  });
});
