/**
 * The event log write path (architecture-and-ux-v1.0.md §2.1-2.2, §2.6).
 *
 * Every user action that represents conduct must write an event before any
 * projection is updated, in the same transaction (AGENTS.md hard rule 2) —
 * callers are responsible for passing a client that is already inside that
 * transaction when a projection write follows.
 */
import type { Pool, PoolClient } from "pg";
import { computeLogicalDay } from "./logical-day";

export const EVENT_TYPES = [
  "commitment.completed",
  "commitment.missed",
  "condition.logged",
  "mark.recorded",
  "stance.changed",
  "attention.event_logged",
  "life.entry_logged",
  "day.reported",
  "app.opened",
  "quest.created",
  "quest.step_completed",
  "quest.abandoned",
  "probe.resolved",
  "outcome.achieved",
  "season.opened",
  "season.closed",
  "recovery.started",
  "return.detected",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

type Queryable = Pool | PoolClient;

export interface NewEvent {
  type: EventType;
  /** When it happened in the world. Defaults to now. */
  occurredAt?: Date;
  domain?: string | null;
  subjectId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  /** Overrides the configured timezone for logical_day computation (tests only). */
  timezone?: string;
}

export interface AppendedEvent {
  id: string;
  type: EventType;
  occurredAt: Date;
  recordedAt: Date;
  logicalDay: string;
  domain: string | null;
  subjectId: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
}

const SELECT_COLUMNS =
  "id, type, occurred_at, recorded_at, logical_day, domain, subject_id, payload, idempotency_key";

function mapRow(row: Record<string, unknown>): AppendedEvent {
  return {
    id: row.id as string,
    type: row.type as EventType,
    occurredAt: row.occurred_at as Date,
    recordedAt: row.recorded_at as Date,
    logicalDay: row.logical_day as string,
    domain: (row.domain as string | null) ?? null,
    subjectId: (row.subject_id as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    idempotencyKey: (row.idempotency_key as string | null) ?? null,
  };
}

/**
 * Appends a conduct event to the log. If `idempotencyKey` collides with an
 * existing event, the existing event is returned instead of writing a
 * duplicate — double taps on a phone are the normal case (§2.6).
 */
export async function appendEvent(client: Queryable, event: NewEvent): Promise<AppendedEvent> {
  const occurredAt = event.occurredAt ?? new Date();
  const logicalDay = computeLogicalDay(occurredAt, event.timezone);
  const payload = event.payload ?? {};
  const idempotencyKey = event.idempotencyKey ?? null;

  const inserted = await client.query(
    `INSERT INTO events (type, occurred_at, logical_day, domain, subject_id, payload, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${SELECT_COLUMNS}`,
    [
      event.type,
      occurredAt.toISOString(),
      logicalDay,
      event.domain ?? null,
      event.subjectId ?? null,
      JSON.stringify(payload),
      idempotencyKey,
    ]
  );

  if (inserted.rows.length > 0) {
    return mapRow(inserted.rows[0]);
  }

  // Idempotency conflict: return the event already recorded under this key.
  const existing = await client.query(
    `SELECT ${SELECT_COLUMNS} FROM events WHERE idempotency_key = $1`,
    [idempotencyKey]
  );
  return mapRow(existing.rows[0]);
}
