import { OPERATIONAL_LOG_RETENTION_POLICY } from '../../../src/foundation/observability';

describe('Foundation operational log retention', () => {
  test('exposes exactly the searchable retention field', () => {
    expect(Object.keys(OPERATIONAL_LOG_RETENTION_POLICY)).toEqual([
      'searchableRetentionDays'
    ]);
    expect(Object.keys(OPERATIONAL_LOG_RETENTION_POLICY)).toHaveLength(1);
  });

  test('preserves searchable retention as exactly 30 days', () => {
    expect(OPERATIONAL_LOG_RETENTION_POLICY).toEqual({
      searchableRetentionDays: 30
    });
    expect(OPERATIONAL_LOG_RETENTION_POLICY.searchableRetentionDays).toBe(30);
    expect(typeof OPERATIONAL_LOG_RETENTION_POLICY.searchableRetentionDays)
      .toBe('number');
  });

  test('does not convert searchable retention to another unit', () => {
    expect(OPERATIONAL_LOG_RETENTION_POLICY.searchableRetentionDays).not.toBe(1);
    expect(OPERATIONAL_LOG_RETENTION_POLICY.searchableRetentionDays).not.toBe(720);
    expect(OPERATIONAL_LOG_RETENTION_POLICY.searchableRetentionDays).not.toBe(43_200);
  });

  test('returns runtime-immutable read-only metadata', () => {
    expect(Object.isFrozen(OPERATIONAL_LOG_RETENTION_POLICY)).toBe(true);
    expect(() => {
      (OPERATIONAL_LOG_RETENTION_POLICY as unknown as {
        searchableRetentionDays: number;
      }).searchableRetentionDays = 31;
    }).toThrow();
    expect(OPERATIONAL_LOG_RETENTION_POLICY.searchableRetentionDays).toBe(30);
  });

  test('preserves exact metadata through JSON serialization', () => {
    const parsed: unknown = JSON.parse(
      JSON.stringify(OPERATIONAL_LOG_RETENTION_POLICY)
    );

    expect(parsed).toEqual(OPERATIONAL_LOG_RETENTION_POLICY);
    expect(Object.keys(parsed as object)).toEqual(
      Object.keys(OPERATIONAL_LOG_RETENTION_POLICY)
    );
  });
});