import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

export type RecoveryArtifact = Readonly<{
  name: string;
  sizeBytes: number;
  sha256: string;
  required: boolean;
}>;

export type RecoveryManifest = Readonly<{
  backup_set_id: string;
  created_at: string;
  source_environment: string;
  source_revision: string;
  backup_tool_version: string;
  database_version: string;
  artifacts: readonly RecoveryArtifact[];
  backup_method: 'logical_postgresql_dump';
}>;

export type RecoveryPreflightEvidence = Readonly<{
  recovery_point_type: 'discrete_backup' | 'pitr_or_equivalent';
  recovery_point_at?: string;
  pitr_or_equivalent_active?: boolean;
  source_environment: string;
  backup_set_id?: string;
  evidence_reference: string;
}>;

export type RestoreExerciseRecord = Readonly<{
  exercise_id: string;
  performed_at: string;
  source_backup_set: string;
  restore_target: string;
  started_at: string;
  completed_at: string;
  elapsed_seconds: number;
  validation_result: 'PASS' | 'FAIL';
  validated_requirements: readonly string[];
  operator_evidence_reference: string;
  evidence_level: 'local_tooling_validation';
}>;

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function verifyRecoveryManifest(
  manifest: RecoveryManifest,
  recoveryDirectory: string
): void {
  for (const artifact of manifest.artifacts) {
    const path = `${recoveryDirectory}/${artifact.name}`;
    if (!existsSync(path)) {
      throw new Error(`Recovery artifact is missing: ${artifact.name}`);
    }

    const stats = statSync(path);
    if (artifact.required && stats.size === 0) {
      throw new Error(`Recovery artifact is empty: ${artifact.name}`);
    }
    if (stats.size !== artifact.sizeBytes) {
      throw new Error(`Recovery artifact size mismatch: ${artifact.name}`);
    }
    if (sha256File(path) !== artifact.sha256) {
      throw new Error(`Recovery artifact checksum mismatch: ${artifact.name}`);
    }
  }
}

export function validateRecoveryPreflight(
  evidence: RecoveryPreflightEvidence,
  now: Date = new Date()
): void {
  if (!evidence.source_environment || !evidence.evidence_reference) {
    throw new Error('Recovery preflight evidence is incomplete.');
  }

  if (evidence.recovery_point_type === 'pitr_or_equivalent') {
    if (evidence.pitr_or_equivalent_active !== true) {
      throw new Error('PITR or equivalent recovery is not confirmed active.');
    }
    return;
  }

  if (!evidence.recovery_point_at || !evidence.backup_set_id) {
    throw new Error('Discrete recovery-point evidence requires a timestamp and backup set.');
  }

  const ageSeconds = (now.getTime() - Date.parse(evidence.recovery_point_at)) / 1000;
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds > 60 * 60) {
    throw new Error('Discrete recovery point exceeds the frozen one-hour RPO evidence window.');
  }
}
