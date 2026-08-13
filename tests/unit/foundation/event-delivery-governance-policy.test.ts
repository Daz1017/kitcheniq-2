import {
  EVENT_DELIVERY_GOVERNANCE_POLICY,
  type EventDeliveryGovernancePolicy
} from '../../../src/foundation/events';

describe('Foundation event delivery governance policy', () => {
  test('exposes the canonical immutable policy shape', () => {
    expect(Object.keys(EVENT_DELIVERY_GOVERNANCE_POLICY)).toEqual([
      'transactionalOutboxOrEquivalentRequired',
      'deliveryGuarantee'
    ]);
    expect(Object.keys(EVENT_DELIVERY_GOVERNANCE_POLICY)).toHaveLength(2);
  });

  test('preserves the governing delivery semantics', () => {
    expect(EVENT_DELIVERY_GOVERNANCE_POLICY).toEqual({
      transactionalOutboxOrEquivalentRequired: true,
      deliveryGuarantee: 'at_least_once'
    });
  });

  test('keeps the rule set frozen and governance-only', () => {
    expect(Object.isFrozen(EVENT_DELIVERY_GOVERNANCE_POLICY)).toBe(true);

    expect(() => {
      (EVENT_DELIVERY_GOVERNANCE_POLICY as unknown as {
        transactionalOutboxOrEquivalentRequired: boolean;
      }).transactionalOutboxOrEquivalentRequired = false;
    }).toThrow();

    const parsed: unknown = JSON.parse(
      JSON.stringify(EVENT_DELIVERY_GOVERNANCE_POLICY)
    );

    expect(parsed).toEqual(EVENT_DELIVERY_GOVERNANCE_POLICY);
    expect(Object.keys(parsed as object)).toEqual(
      Object.keys(EVENT_DELIVERY_GOVERNANCE_POLICY)
    );
  });

  test('supports TypeScript typing without embedding runtime delivery logic', () => {
    const policy: EventDeliveryGovernancePolicy = EVENT_DELIVERY_GOVERNANCE_POLICY;

    expect(policy.transactionalOutboxOrEquivalentRequired).toBe(true);
    expect(policy.deliveryGuarantee).toBe('at_least_once');
    expect(policy).not.toHaveProperty('dispatcher');
    expect(policy).not.toHaveProperty('outbox');
    expect(policy).not.toHaveProperty('retrySchedule');
  });
});
