/**
 * Metrics (milestone-3-spec.md §1): a numeric body/other measurement.
 * `payload: { metric, value, unit }`. Domain-scoped, zero XP — enforced at
 * write time by db/migrations/0006_baseline_audit.sql's
 * events_metric_note_have_domain / events_valid_metric CHECKs, and
 * structurally by lib/xp.ts never reading this type at all.
 */
import type { Pool, PoolClient } from "pg";
import { appendEvent, type AppendedEvent } from "./events";
import { getTimezone } from "./logical-day";
import type { Domain } from "./domains";

type Queryable = Pool | PoolClient;

export interface RecordMetricInput {
  domain: Domain;
  metric: string;
  value: number;
  unit: string;
  occurredAt?: Date;
  timezone?: string;
}

export async function recordMetric(client: Queryable, input: RecordMetricInput): Promise<AppendedEvent> {
  return appendEvent(client, {
    type: "metric.recorded",
    occurredAt: input.occurredAt ?? new Date(),
    domain: input.domain,
    payload: { metric: input.metric, value: input.value, unit: input.unit },
    timezone: input.timezone ?? getTimezone(),
  });
}

/** Total count of metric.recorded events ever written, corrections included (each still counts once). */
export async function countMetrics(client: Queryable): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM events WHERE type = 'metric.recorded'`
  );
  return result.rows[0]?.count ?? 0;
}
