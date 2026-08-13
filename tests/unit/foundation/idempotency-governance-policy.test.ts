import {
  IDEMPOTENCY_GOVERNANCE_POLICY,
  type IdempotencyBindingComponent,
  type IdempotencyGovernancePolicy
} from '../../../src/foundation/idempotency';
import { createIdempotencyKey } from '../../../src/foundation/idempotency/idempotency-key';

describe('Foundation idempotency governance policy', () => {
  test('exposes exactly five required binding components in canonical order', () => {
    expect(Object.keys(IDEMPOTENCY_GOVERNANCE_POLICY)).toEqual([
      'requiredBindingComponents',
      'materiallyDifferentRequestReuseRejected',
      'minimumReplayProtectionDays',
      'permanentExternalSourceUniquenessWhereAvailableRequired'
    ]);
    expect(IDEMPOTENCY_GOVERNANCE_POLICY.requiredBindingComponents).toEqual([
      'operation',
      'scope',
      'idempotency_key',
      'request_hash',
      'result_reference'
    ]);
    expect(IDEMPOTENCY_GOVERNANCE_POLICY.requiredBindingComponents).toHaveLength(5);
  });

  test('enforces exact canonical binding vocabulary and rejects duplicates', () => {
    const expected: readonly IdempotencyBindingComponent[] = [
      'operation',
      'scope',
      'idempotency_key',
      'request_hash',
      'result_reference'
    ];

    expect(IDEMPOTENCY_GOVERNANCE_POLICY.requiredBindingComponents).toEqual(expected);
    expect(new Set(IDEMPOTENCY_GOVERNANCE_POLICY.requiredBindingComponents).size)
      .toBe(expected.length);

    for (const component of expected) {
      expect(IDEMPOTENCY_GOVERNANCE_POLICY.requiredBindingComponents).toContain(component);
    }

    for (const forbidden of [
      'user',
      'timestamp',
      'route',
      'http_method',
      'currency',
      'entity',
      'module',
      'payload',
      'response_body'
    ]) {
      expect(IDEMPOTENCY_GOVERNANCE_POLICY.requiredBindingComponents).not.toContain(forbidden);
    }
  });

  test('requires material-difference rejection and 90-day minimum replay protection', () => {
    expect(IDEMPOTENCY_GOVERNANCE_POLICY.materiallyDifferentRequestReuseRejected).toBe(true);
    expect(IDEMPOTENCY_GOVERNANCE_POLICY.minimumReplayProtectionDays).toBe(90);
    expect(IDEMPOTENCY_GOVERNANCE_POLICY.minimumReplayProtectionDays).not.toBeGreaterThan(90);
    expect(IDEMPOTENCY_GOVERNANCE_POLICY.permanentExternalSourceUniquenessWhereAvailableRequired).toBe(true);
  });

  test('returns immutable read-only metadata and preserves ordinary JSON semantics', () => {
    expect(Object.isFrozen(IDEMPOTENCY_GOVERNANCE_POLICY)).toBe(true);
    expect(Object.isFrozen(IDEMPOTENCY_GOVERNANCE_POLICY.requiredBindingComponents)).toBe(true);

    expect(() => {
      (IDEMPOTENCY_GOVERNANCE_POLICY as unknown as {
        materiallyDifferentRequestReuseRejected: boolean;
      }).materiallyDifferentRequestReuseRejected = false;
    }).toThrow();

    const parsed: unknown = JSON.parse(
      JSON.stringify(IDEMPOTENCY_GOVERNANCE_POLICY)
    );

    expect(parsed).toEqual(IDEMPOTENCY_GOVERNANCE_POLICY);
    expect(Object.keys(parsed as object)).toEqual(
      Object.keys(IDEMPOTENCY_GOVERNANCE_POLICY)
    );
  });

  test('keeps the policy governance-only and defers runtime request validation details', () => {
    const policy: IdempotencyGovernancePolicy = IDEMPOTENCY_GOVERNANCE_POLICY;

    expect(policy.requiredBindingComponents).toEqual([
      'operation',
      'scope',
      'idempotency_key',
      'request_hash',
      'result_reference'
    ]);
    expect(policy.requiredBindingComponents).not.toContain('sha256');
    expect(policy.requiredBindingComponents).not.toContain('operation_id');
    expect(policy.requiredBindingComponents).not.toContain('tenant_id');
    expect(policy.requiredBindingComponents).not.toContain('response_reference');
    expect(policy.requiredBindingComponents).not.toContain('http_method');
  });

  test('leaves the existing F-17 idempotency key primitive unchanged', () => {
    const key = createIdempotencyKey('abc123');

    expect(key).toBe('abc123');
    expect(typeof key).toBe('string');
    expect(key).not.toBeUndefined();
  });
});
