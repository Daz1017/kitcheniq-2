import { createClient } from '@supabase/supabase-js';
import { type SupabaseServerConfig } from './supabase-server-config';
import { runWithCorrelation } from './correlation-context';
import { appendOperationalLog, type OperationalLogSink } from './logger';

export type OutboxEvent = Readonly<{
  event_id: string;
  claim_token: string;
  event_type: string;
  schema_version: string;
  producer: string;
  correlation_id: string;
  causation_id: string;
  payload: Record<string, unknown>;
}>;

export type OutboxEventHandler = (event: OutboxEvent) => Promise<void> | void;

export async function processOutboxBatch(
  config: SupabaseServerConfig,
  handler: OutboxEventHandler,
  options: Readonly<{ batchSize?: number; leaseSeconds?: number; operationalLogSink?: OperationalLogSink }> = {}
): Promise<number> {
  const client = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await client.rpc('claim_event_outbox', {
    p_limit: options.batchSize ?? 10,
    p_lease_seconds: options.leaseSeconds ?? 30
  });
  if (error) {
    throw error;
  }

  const events = (data ?? []) as OutboxEvent[];
  for (const event of events) {
    try {
      await runWithCorrelation(event.correlation_id as never, () => handler(event));
      const completion = await client.rpc('mark_event_delivered', {
        p_event_id: event.event_id,
        p_claim_token: event.claim_token
      });
      if (completion.error || completion.data !== true) {
        throw completion.error ?? new Error('Outbox event acknowledgement was rejected.');
      }
    } catch (error) {
      const sink = options.operationalLogSink;
      if (sink) {
        try {
          await appendOperationalLog({
            severity: 'error',
            component: 'foundation.outbox_worker',
            message: 'Outbox handler failed.',
            correlationId: event.correlation_id as never,
            healthSignal: 'job_failure',
            details: {
              eventId: event.event_id,
              eventType: event.event_type,
              schemaVersion: event.schema_version,
              producer: event.producer
            }
          }, sink);
        } catch {
          // Preserve the original handler failure and F-40 release semantics.
        }
      }
      await client.rpc('release_event_claim', {
        p_event_id: event.event_id,
        p_claim_token: event.claim_token,
        p_last_error: 'Outbox handler failed.'
      });
      throw error;
    }
  }

  return events.length;
}