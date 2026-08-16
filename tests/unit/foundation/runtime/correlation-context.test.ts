import { createCorrelationId } from '../../../../src/foundation/correlation';
import {
  currentCorrelationId,
  runWithCorrelation
} from '../../../../src/foundation/runtime/correlation-context';

describe('runtime correlation context', () => {
  test('creates and preserves a valid correlation id for nested async work', async () => {
    const correlationId = createCorrelationId();
    const result = await runWithCorrelation(correlationId, async () => {
      const nested = await Promise.resolve();
      void nested;
      return currentCorrelationId();
    });
    expect(result).toBe(correlationId);
  });

  test('keeps concurrent correlation values isolated', async () => {
    const first = createCorrelationId();
    const second = createCorrelationId();

    const observed: Array<string | undefined> = [];

    await Promise.all([
      runWithCorrelation(first, async () => {
        observed.push(currentCorrelationId());
        await Promise.resolve();
        observed.push(currentCorrelationId());
      }),
      runWithCorrelation(second, async () => {
        observed.push(currentCorrelationId());
        await Promise.resolve();
        observed.push(currentCorrelationId());
      })
    ]);

    expect(observed).toHaveLength(4);
    expect(observed.filter((value) => value === first)).toHaveLength(2);
    expect(observed.filter((value) => value === second)).toHaveLength(2);
  });

  test('returns undefined outside of a correlation', () => {
    expect(currentCorrelationId()).toBeUndefined();
  });
});
