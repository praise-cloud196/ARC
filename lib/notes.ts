/**
 * Domain notes (milestone-3-spec.md §1): an unquantified domain
 * observation — *"I feel stronger"* (PRD §9). Domain-scoped, zero XP — a
 * peer of lib/metrics.ts by design, not a comment attached to a number.
 */
import type { Pool, PoolClient } from "pg";
import { appendEvent, type AppendedEvent } from "./events";
import { getTimezone } from "./logical-day";
import type { Domain } from "./domains";

type Queryable = Pool | PoolClient;

export interface RecordNoteInput {
  domain: Domain;
  note: string;
  occurredAt?: Date;
  timezone?: string;
}

export async function recordNote(client: Queryable, input: RecordNoteInput): Promise<AppendedEvent> {
  return appendEvent(client, {
    type: "note.recorded",
    occurredAt: input.occurredAt ?? new Date(),
    domain: input.domain,
    payload: { note: input.note },
    timezone: input.timezone ?? getTimezone(),
  });
}

/** Distinct domains (of DOMAINS, milestone-3-spec.md §2 step 1 — all four, not just SCORED_DOMAINS) with at least one note.recorded event. */
export async function domainsWithNotes(client: Queryable): Promise<Domain[]> {
  const result = await client.query<{ domain: Domain }>(
    `SELECT DISTINCT domain FROM events WHERE type = 'note.recorded' AND domain IS NOT NULL`
  );
  return result.rows.map((row) => row.domain);
}
