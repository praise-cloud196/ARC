/**
 * The Attention layer's event log (architecture-and-ux-v1.0.md §2.7).
 *
 * Structurally separate from lib/events.ts / `events`: this module has no
 * way to write into the general event log, and nothing here ever reads a
 * `domain`, so inclusion in a domain-keyed aggregate that feeds the Loop,
 * the nightly report, XP, momentum, or rank is structurally impossible
 * rather than dependent on remembering to exclude a type
 * (milestone-1.1-fixes.md item 1).
 *
 * `stance.changed` lives here too, not in `events`: stances exist only for
 * behaviours the user is trying to reduce (philosophy §10), so a stance
 * change is Attention-layer data, and counting it as conduct could keep the
 * character out of the Dormant state without any real conduct having
 * occurred (milestone-1.2-fixes.md item 2).
 */
import type { Pool, PoolClient } from "pg";
import { computeLogicalDay, getTimezone } from "./logical-day";

/** Event types whose values can be corrected. */
export const CORRECTABLE_ATTENTION_EVENT_TYPES = ["attention.event_logged", "stance.changed"] as const;

export type CorrectableAttentionEventType = (typeof CORRECTABLE_ATTENTION_EVENT_TYPES)[number];

export const ATTENTION_EVENT_TYPES = [
  "attention.event_logged",
  "attention.event_logged.corrected",
  "stance.changed",
  "stance.changed.corrected",
] as const;

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

/** A correction of a previously-written Attention event. */
export interface NewAttentionCorrection {
  /** The type of the event being corrected (not the `.corrected` type itself). */
  correctsType: CorrectableAttentionEventType;
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
 * Appends a correction. Never mutates the original event — the original is
 * never removed; readers apply corrections by treating the latest
 * correction for a given event as superseding it.
 *
 * `occurredAt` and `timezone` default to the original event's own values
 * rather than to "now": a correction is normally fixing a value in
 * `payload`, not relitigating when the thing happened. A caller correcting
 * that too may still override it explicitly. `payload` is shallow-merged
 * over the original's, so a correction only needs to name the field it's
 * fixing rather than restate the whole object.
 */
export async function appendAttentionCorrection(
  client: Queryable,
  correction: NewAttentionCorrection
): Promise<AppendedAttentionEvent> {
  const original = await client.query<{
    occurred_at: Date;
    timezone: string;
    payload: Record<string, unknown>;
  }>(`SELECT occurred_at, timezone, payload FROM attention_events WHERE id = $1 AND type = $2`, [
    correction.correctsEventId,
    correction.correctsType,
  ]);
  const originalRow = original.rows[0];
  if (!originalRow) {
    throw new Error(
      `No ${correction.correctsType} event found with id ${correction.correctsEventId}`
    );
  }

  return appendAttentionEvent(client, {
    type: `${correction.correctsType}.corrected` as AttentionEventType,
    occurredAt: correction.occurredAt ?? originalRow.occurred_at,
    subjectId: correction.correctsEventId,
    payload: { ...originalRow.payload, ...correction.payload },
    idempotencyKey: correction.idempotencyKey,
    timezone: correction.timezone ?? originalRow.timezone,
  });
}
