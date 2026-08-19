/**
 * The event log write path (architecture-and-ux-v1.0.md §2.1-2.2, §2.6).
 *
 * Every user action that represents conduct must write an event before any
 * projection is updated, in the same transaction (AGENTS.md hard rule 2) —
 * callers are responsible for passing a client that is already inside that
 * transaction when a projection write follows.
 *
 * The Attention layer's events live in a separate table
 * (lib/attention-events.ts), never here — see architecture-and-ux-v1.0.md
 * §2.7 and milestone-1.1-fixes.md item 1.
 */
import type { Pool, PoolClient } from "pg";
import { computeLogicalDay, getTimezone } from "./logical-day";

/** Event types whose values can be corrected (milestone-1.1-fixes.md item 2). */
export const CORRECTABLE_EVENT_TYPES = [
  "commitment.completed",
  "condition.logged",
  "mark.recorded",
  "life.entry_logged",
] as const;

export type CorrectableEventType = (typeof CORRECTABLE_EVENT_TYPES)[number];

export const EVENT_TYPES = [
  "commitment.completed",
  "commitment.completed.corrected",
  "commitment.missed",
  "condition.logged",
  "condition.logged.corrected",
  "mark.recorded",
  "mark.recorded.corrected",
  "stance.changed",
  "life.entry_logged",
  "life.entry_logged.corrected",
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

/**
 * Self-instrumentation events (PRD §22): the app recording its own use.
 * Never counted toward the Loop, the nightly report, XP, or momentum
 * (milestone-1.1-fixes.md item 4) — kept only for the day-60 usage report.
 */
export const INSTRUMENTATION_EVENT_TYPES = ["app.opened", "day.reported"] as const;

type Queryable = Pool | PoolClient;

export interface NewEvent {
  type: EventType;
  /** When it happened in the world. Defaults to now. */
  occurredAt?: Date;
  domain?: string | null;
  subjectId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  /** Overrides the configured timezone. Recorded on the row (tests only in practice). */
  timezone?: string;
}

export interface AppendedEvent {
  id: string;
  type: EventType;
  occurredAt: Date;
  recordedAt: Date;
  logicalDay: string;
  timezone: string;
  domain: string | null;
  subjectId: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
}

/** A correction of a previously-written event (milestone-1.1-fixes.md item 2). */
export interface NewCorrection {
  /** The type of the event being corrected (not the `.corrected` type itself). */
  correctsType: CorrectableEventType;
  /** id of the event this correction applies to. */
  correctsEventId: string;
  occurredAt?: Date;
  domain?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  timezone?: string;
}

const SELECT_COLUMNS =
  "id, type, occurred_at, recorded_at, logical_day, timezone, domain, subject_id, payload, idempotency_key";

function mapRow(row: Record<string, unknown>): AppendedEvent {
  return {
    id: row.id as string,
    type: row.type as EventType,
    occurredAt: row.occurred_at as Date,
    recordedAt: row.recorded_at as Date,
    logicalDay: row.logical_day as string,
    timezone: row.timezone as string,
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
  const timezone = event.timezone ?? getTimezone();
  const logicalDay = computeLogicalDay(occurredAt, timezone);
  const payload = event.payload ?? {};
  const idempotencyKey = event.idempotencyKey ?? null;

  const inserted = await client.query(
    `INSERT INTO events (type, occurred_at, logical_day, timezone, domain, subject_id, payload, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${SELECT_COLUMNS}`,
    [
      event.type,
      occurredAt.toISOString(),
      logicalDay,
      timezone,
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

/**
 * Appends a correction. Never mutates the original event — the original is
 * never removed; readers and rollups apply corrections by treating the
 * latest correction for a given event as superseding it
 * (milestone-1.1-fixes.md item 2).
 *
 * `occurredAt`, `domain`, and `timezone` default to the original event's own
 * values rather than to "now" / null: a correction is normally fixing a
 * value in `payload` (a wrong tier, a typo'd note), not relitigating when or
 * under which domain the thing happened. A caller correcting those too may
 * still override them explicitly.
 */
export async function appendCorrection(
  client: Queryable,
  correction: NewCorrection
): Promise<AppendedEvent> {
  const original = await client.query<{
    occurred_at: Date;
    domain: string | null;
    timezone: string;
  }>(`SELECT occurred_at, domain, timezone FROM events WHERE id = $1 AND type = $2`, [
    correction.correctsEventId,
    correction.correctsType,
  ]);
  const originalRow = original.rows[0];
  if (!originalRow) {
    throw new Error(
      `No ${correction.correctsType} event found with id ${correction.correctsEventId}`
    );
  }

  return appendEvent(client, {
    type: `${correction.correctsType}.corrected` as EventType,
    occurredAt: correction.occurredAt ?? originalRow.occurred_at,
    domain: correction.domain !== undefined ? correction.domain : originalRow.domain,
    subjectId: correction.correctsEventId,
    payload: correction.payload,
    idempotencyKey: correction.idempotencyKey,
    timezone: correction.timezone ?? originalRow.timezone,
  });
}
