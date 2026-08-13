export const AUDIT_RETENTION_PROFILES = [
  'financial_security',
  'protected_operational'
] as const;

export type AuditRetentionProfile = (typeof AUDIT_RETENTION_PROFILES)[number];

export type AuditRetentionMetadata = Readonly<{
  years: number;
}>;

const RETENTION_BY_PROFILE: Readonly<
  Record<AuditRetentionProfile, AuditRetentionMetadata>
> = Object.freeze({
  financial_security: Object.freeze({ years: 7 }),
  protected_operational: Object.freeze({ years: 2 })
});

export function isAuditRetentionProfile(
  value: unknown
): value is AuditRetentionProfile {
  return typeof value === 'string'
    && (AUDIT_RETENTION_PROFILES as readonly string[]).includes(value);
}

export function retentionForAuditProfile(
  profile: AuditRetentionProfile
): AuditRetentionMetadata {
  return RETENTION_BY_PROFILE[profile];
}
