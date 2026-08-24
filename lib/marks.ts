/**
 * Marks (milestone-3-spec.md §3, PRD §14). `recordRetroactiveMark` is the
 * audit's step 2 — it requires an `occurredAt` because backdating is the
 * whole point, and it tags `payload.retroactive = true` so
 * `retroactiveMarkStats` (the audit-progress/starting-rank gate) counts only
 * these. `recordMark` is the ordinary, present-day version used after the
 * audit — same required note, same optional artifact, no retroactive flag,
 * `occurredAt` defaults to now. `events_mark_has_note`
 * (db/migrations/0006_baseline_audit.sql) enforces the note requirement for
 * both at the data layer, deliberately not distinguishing the two.
 */
import type { Pool, PoolClient } from "pg";
import { appendEvent, type AppendedEvent } from "./events";
import { fetchRawEventRows, resolveEffectiveEvents, type EffectiveEvent } from "./effective-events";
import { getTimezone } from "./logical-day";
import type { Domain } from "./domains";

type Queryable = Pool | PoolClient;

export interface RecordRetroactiveMarkInput {
  domain: Domain;
  /** The user's best estimate of when it actually happened — may be years ago. Required: this is what makes it retroactive. */
  occurredAt: Date;
  /** "What changed because of this?" (PRD §14) — required. */
  note: string;
  artifact?: string;
  timezone?: string;
}

export async function recordRetroactiveMark(
  client: Queryable,
  input: RecordRetroactiveMarkInput
): Promise<AppendedEvent> {
  const payload: Record<string, unknown> = { retroactive: true, note: input.note };
  if (input.artifact !== undefined) payload.artifact = input.artifact;

  return appendEvent(client, {
    type: "mark.recorded",
    occurredAt: input.occurredAt,
    domain: input.domain,
    payload,
    timezone: input.timezone ?? getTimezone(),
  });
}

export interface RecordMarkInput {
  domain: Domain;
  /** "What changed because of this?" (PRD §14) — required. */
  note: string;
  artifact?: string;
  occurredAt?: Date;
  timezone?: string;
}

/** Ordinary, present-day Mark — see this file's header comment for how it differs from `recordRetroactiveMark`. */
export async function recordMark(client: Queryable, input: RecordMarkInput): Promise<AppendedEvent> {
  const payload: Record<string, unknown> = { note: input.note };
  if (input.artifact !== undefined) payload.artifact = input.artifact;

  return appendEvent(client, {
    type: "mark.recorded",
    occurredAt: input.occurredAt ?? new Date(),
    domain: input.domain,
    payload,
    timezone: input.timezone ?? getTimezone(),
  });
}

/** Most recent Marks, newest first — for a simple confirmation list, not the full effective-event log. */
export async function listRecentMarks(client: Queryable, limit = 10): Promise<AppendedEvent[]> {
  const result = await client.query(
    `SELECT id, type, occurred_at, recorded_at, logical_day, timezone, domain, subject_id, payload, idempotency_key
     FROM events WHERE type = 'mark.recorded' ORDER BY recorded_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    logicalDay: row.logical_day,
    timezone: row.timezone,
    domain: row.domain,
    subjectId: row.subject_id,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
  }));
}

export interface RetroactiveMarkStats {
  count: number;
  domains: Domain[];
}

/** Pure — no I/O. See `retroactiveMarkStats` below. */
export function retroactiveMarkStatsFromEvents(events: EffectiveEvent[]): RetroactiveMarkStats {
  const domains = new Set<Domain>();
  let count = 0;

  for (const event of events) {
    if (event.type !== "mark.recorded") continue;
    if (event.payload.retroactive !== true) continue;
    count += 1;
    if (event.domain) domains.add(event.domain as Domain);
  }

  return { count, domains: [...domains] };
}

/**
 * Count and distinct domains of retroactive Marks, corrections applied —
 * milestone-3-spec.md §6's `retroMarks` / `retroDomains`, and the §3
 * minimum-3 gate. Folds the log itself (not a raw count query) because a
 * correction could change a Mark's domain or its `retroactive` flag, and
 * both must reflect the corrected value. A caller also needing other
 * derived values from the same request should fetch once and call
 * `retroactiveMarkStatsFromEvents` directly instead (milestone-4-spec.md §1).
 */
export async function retroactiveMarkStats(client: PoolClient): Promise<RetroactiveMarkStats> {
  const events = resolveEffectiveEvents(await fetchRawEventRows(client));
  return retroactiveMarkStatsFromEvents(events);
}
