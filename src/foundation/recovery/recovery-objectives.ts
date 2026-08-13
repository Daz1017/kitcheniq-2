export const RECOVERY_OBJECTIVE_KINDS = ['rpo', 'rto'] as const;

export type RecoveryObjectiveKind = (typeof RECOVERY_OBJECTIVE_KINDS)[number];

export type RecoveryObjectiveMetadata = Readonly<{
  maximumHours: number;
}>;

const RECOVERY_OBJECTIVES: Readonly<
  Record<RecoveryObjectiveKind, RecoveryObjectiveMetadata>
> = Object.freeze({
  rpo: Object.freeze({ maximumHours: 1 }),
  rto: Object.freeze({ maximumHours: 4 })
});

export function isRecoveryObjectiveKind(
  value: unknown
): value is RecoveryObjectiveKind {
  return typeof value === 'string'
    && (RECOVERY_OBJECTIVE_KINDS as readonly string[]).includes(value);
}

export function recoveryObjectiveFor(
  kind: RecoveryObjectiveKind
): RecoveryObjectiveMetadata {
  return RECOVERY_OBJECTIVES[kind];
}