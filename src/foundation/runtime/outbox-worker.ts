import { createClient } from '@supabase/supabase-js';
import { type SupabaseServerConfig } from './supabase-server-config';

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
  options: Readonly<{ batchSize?: number; leaseSeconds?: number }> = {}
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
      await handler(event);
      const completion = await client.rpc('mark_event_delivered', {
        p_event_id: event.event_id,
        p_claim_token: event.claim_token
      });
      if (completion.error || completion.data !== true) {
        throw completion.error ?? new Error('Outbox event acknowledgement was rejected.');
      }
    } catch (error) {
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