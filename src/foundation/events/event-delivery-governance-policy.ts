export type EventDeliveryGuarantee = 'at_least_once';

export type EventDeliveryGovernancePolicy = Readonly<{
  transactionalOutboxOrEquivalentRequired: true;
  deliveryGuarantee: 'at_least_once';
}>;

export const EVENT_DELIVERY_GOVERNANCE_POLICY:
  EventDeliveryGovernancePolicy = Object.freeze({
    transactionalOutboxOrEquivalentRequired: true,
    deliveryGuarantee: 'at_least_once'
  });
