/**
 * Metrics (milestone-3-spec.md §1): a numeric body/other measurement.
 * `payload: { metric, value, unit }`. Domain-scoped, zero XP — enforced at
 * write time by db/migrations/0006_baseline_audit.sql's
 * events_metric_note_have_domain / events_valid_metric CHECKs, and
 * structurally by lib/xp.ts never reading this type at all.
 */
import type { Pool, PoolClient } from "pg";
import { appendCorrection, appendEvent, type AppendedEvent } from "./events";
import { fetchRawEventRows, resolveEffectiveEvents } from "./effective-events";
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

/**
 * Count of metric.recorded events, corrections applied, voided ones
 * excluded (design-revision-v2.md §7.2 — "counts on the character sheet";
 * this feeds the audit's own progress display the same way).
 */
export async function countMetrics(client: Queryable): Promise<number> {
  const rows = await fetchRawEventRows(client);
  return resolveEffectiveEvents(rows).filter((e) => e.type === "metric.recorded").length;
}

export interface RecentMetric {
  id: string;
  domain: Domain | null;
  metric: string;
  value: number;
  unit: string;
  occurredAt: Date;
  logicalDay: string;
  voided: boolean;
}

/**
 * Most recent metrics, newest first, corrections applied — for the
 * /metrics list, not a full history view. `includeVoided` powers the
 * "show withdrawn" toggle (design-revision-v2.md §7.3).
 */
export async function listRecentMetrics(
  client: Queryable,
  limit = 10,
  includeVoided = false
): Promise<RecentMetric[]> {
  const rows = await fetchRawEventRows(client);
  const metrics = resolveEffectiveEvents(rows, { includeVoided })
    .filter((e) => e.type === "metric.recorded")
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);

  return metrics.map((e) => ({
    id: e.id,
    domain: e.domain as Domain | null,
    metric: typeof e.payload.metric === "string" ? e.payload.metric : "",
    value: typeof e.payload.value === "number" ? e.payload.value : 0,
    unit: typeof e.payload.unit === "string" ? e.payload.unit : "",
    occurredAt: e.occurredAt,
    logicalDay: e.logicalDay,
    voided: e.payload.voided === true,
  }));
}

export interface EditMetricInput {
  metricEventId: string;
  metric?: string;
  value?: number;
  unit?: string;
  timezone?: string;
}

/** Corrects a metric (design-revision-v2.md §7.1/§7.2) — a record, editable at any time, no same-day restriction. */
export async function editMetric(client: Queryable, input: EditMetricInput): Promise<AppendedEvent> {
  const payload: Record<string, unknown> = {};
  if (input.metric !== undefined) payload.metric = input.metric;
  if (input.value !== undefined) payload.value = input.value;
  if (input.unit !== undefined) payload.unit = input.unit;

  return appendCorrection(client, {
    correctsType: "metric.recorded",
    correctsEventId: input.metricEventId,
    payload,
    timezone: input.timezone,
  });
}

export interface VoidMetricInput {
  metricEventId: string;
  timezone?: string;
}

/** Withdraws a metric (design-revision-v2.md §7.1/§7.2) — a record, voidable at any time. The original is never removed. */
export async function voidMetric(client: Queryable, input: VoidMetricInput): Promise<AppendedEvent> {
  return appendCorrection(client, {
    correctsType: "metric.recorded",
    correctsEventId: input.metricEventId,
    payload: { voided: true },
    timezone: input.timezone,
  });
}
