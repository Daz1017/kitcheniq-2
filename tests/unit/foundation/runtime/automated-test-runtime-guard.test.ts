import { loadAutomatedTestEnvironment } from '../../../../src/foundation/runtime/environment-loader';

describe('automated test runtime guard', () => {
  test('normal test execution resolves automated_test environment', () => {
    expect(loadAutomatedTestEnvironment(process.env)).toBe('automated_test');
  });
});
