/**
 * The Attention layer's event log (architecture-and-ux-v1.0.md §2.7).
 *
 * Structurally separate from lib/events.ts / `events`: this module has no
 * way to write into the general event log, and nothing here ever reads a
 * `domain`, so inclusion in a domain-keyed aggregate that feeds the Loop,
 * the nightly report, XP, momentum, or rank is structurally impossible
 * rather than dependent on remembering to exclude a type
 * (milestone-1.1-fixes.md item 1).
 */
import type { Pool, PoolClient } from "pg";
import { computeLogicalDay, getTimezone } from "./logical-day";

export const ATTENTION_EVENT_TYPES = ["attention.event_logged", "attention.event_logged.corrected"] as const;

export type AttentionEventType = (typeof ATTENTION_EVENT_TYPES)[number];

type Queryable = Pool | PoolClient;

export interface NewAttentionEvent {
  type: AttentionEventType;
  occurredAt?: Date;
  /** The stance (behaviour) this event belongs to. */
  subjectId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  timezone?: string;
}

export interface AppendedAttentionEvent {
  id: string;
  type: AttentionEventType;
  occurredAt: Date;
  recordedAt: Date;
  logicalDay: string;
  timezone: string;
  subjectId: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
}

export interface NewAttentionCorrection {
  correctsEventId: string;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  timezone?: string;
}

const SELECT_COLUMNS =
  "id, type, occurred_at, recorded_at, logical_day, timezone, subject_id, payload, idempotency_key";

function mapRow(row: Record<string, unknown>): AppendedAttentionEvent {
  return {
    id: row.id as string,
    type: row.type as AttentionEventType,
    occurredAt: row.occurred_at as Date,
    recordedAt: row.recorded_at as Date,
    logicalDay: row.logical_day as string,
    timezone: row.timezone as string,
    subjectId: (row.subject_id as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    idempotencyKey: (row.idempotency_key as string | null) ?? null,
  };
}

/** Appends an Attention-layer event. Same idempotency behaviour as appendEvent (§2.6). */
export async function appendAttentionEvent(
  client: Queryable,
  event: NewAttentionEvent
): Promise<AppendedAttentionEvent> {
  const occurredAt = event.occurredAt ?? new Date();
  const timezone = event.timezone ?? getTimezone();
  const logicalDay = computeLogicalDay(occurredAt, timezone);
  const payload = event.payload ?? {};
  const idempotencyKey = event.idempotencyKey ?? null;

  const inserted = await client.query(
    `INSERT INTO attention_events (type, occurred_at, logical_day, timezone, subject_id, payload, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${SELECT_COLUMNS}`,
    [
      event.type,
      occurredAt.toISOString(),
      logicalDay,
      timezone,
      event.subjectId ?? null,
      JSON.stringify(payload),
      idempotencyKey,
    ]
  );

  if (inserted.rows.length > 0) {
    return mapRow(inserted.rows[0]);
  }

  const existing = await client.query(
    `SELECT ${SELECT_COLUMNS} FROM attention_events WHERE idempotency_key = $1`,
    [idempotencyKey]
  );
  return mapRow(existing.rows[0]);
}

/**
 * Appends a correction to a previously-logged Attention event. The original
 * is never removed. `occurredAt` and `timezone` default to the original
 * event's own values unless explicitly overridden — see appendCorrection in
 * lib/events.ts for why.
 */
export async function appendAttentionCorrection(
  client: Queryable,
  correction: NewAttentionCorrection
): Promise<AppendedAttentionEvent> {
  const original = await client.query<{ occurred_at: Date; timezone: string }>(
    `SELECT occurred_at, timezone FROM attention_events WHERE id = $1 AND type = 'attention.event_logged'`,
    [correction.correctsEventId]
  );
  const originalRow = original.rows[0];
  if (!originalRow) {
    throw new Error(`No attention.event_logged event found with id ${correction.correctsEventId}`);
  }

  return appendAttentionEvent(client, {
    type: "attention.event_logged.corrected",
    occurredAt: correction.occurredAt ?? originalRow.occurred_at,
    subjectId: correction.correctsEventId,
    payload: correction.payload,
    idempotencyKey: correction.idempotencyKey,
    timezone: correction.timezone ?? originalRow.timezone,
  });
}
