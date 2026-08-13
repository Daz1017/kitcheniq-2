export type IdempotencyBindingComponent =
  | 'operation'
  | 'scope'
  | 'idempotency_key'
  | 'request_hash'
  | 'result_reference';

export type IdempotencyGovernancePolicy = Readonly<{
  requiredBindingComponents: readonly [
    'operation',
    'scope',
    'idempotency_key',
    'request_hash',
    'result_reference'
  ];
  materiallyDifferentRequestReuseRejected: true;
  minimumReplayProtectionDays: 90;
  permanentExternalSourceUniquenessWhereAvailableRequired: true;
}>;

const REQUIRED_BINDING_COMPONENTS: readonly [
  'operation',
  'scope',
  'idempotency_key',
  'request_hash',
  'result_reference'
] = Object.freeze([
  'operation',
  'scope',
  'idempotency_key',
  'request_hash',
  'result_reference'
]);

export const IDEMPOTENCY_GOVERNANCE_POLICY: IdempotencyGovernancePolicy =
  Object.freeze({
    requiredBindingComponents: REQUIRED_BINDING_COMPONENTS,
    materiallyDifferentRequestReuseRejected: true,
    minimumReplayProtectionDays: 90,
    permanentExternalSourceUniquenessWhereAvailableRequired: true
  });
