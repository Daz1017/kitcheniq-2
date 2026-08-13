export type OperationalLogRetentionPolicy = Readonly<{
  searchableRetentionDays: 30;
}>;

export const OPERATIONAL_LOG_RETENTION_POLICY:
  OperationalLogRetentionPolicy = Object.freeze({
    searchableRetentionDays: 30
  });