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

export interface RecentMetric {
  id: string;
  domain: Domain | null;
  metric: string;
  value: number;
  unit: string;
  occurredAt: Date;
}

/** Most recent metrics, newest first — for a simple confirmation list, not a full history view. */
export async function listRecentMetrics(client: Queryable, limit = 10): Promise<RecentMetric[]> {
  const result = await client.query<{
    id: string;
    domain: Domain | null;
    payload: { metric: string; value: number; unit: string };
    occurred_at: Date;
  }>(
    `SELECT id, domain, payload, occurred_at FROM events
     WHERE type = 'metric.recorded' ORDER BY recorded_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    domain: row.domain,
    metric: row.payload.metric,
    value: row.payload.value,
    unit: row.payload.unit,
    occurredAt: row.occurred_at,
  }));
}
