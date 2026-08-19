/**
 * Rebuilds daily_rollup entirely from the event log
 * (architecture-and-ux-v1.0.md §2.4). The rollup is a cache, never an
 * authoritative source — dropping it and recomputing from events alone must
 * always produce identical state.
 *
 * Three things happen here that a plain "group events by their stored
 * logical_day" query would not (milestone-1.1-fixes.md items 2-4):
 *
 * 1. `logical_day` is recomputed from each event's `occurred_at` + stored
 *    `timezone`, never trusted from the stored `logical_day` column. That
 *    column is a write-time cache; a bug in the day-boundary logic is
 *    recoverable by re-running rebuild rather than by editing history.
 * 2. Corrections are applied: for an event with a later `*.corrected` event
 *    referencing it, the correction's occurred_at/domain/timezone (which
 *    appendCorrection defaults from the original — see lib/events.ts) are
 *    used in place of the original's, and the correction contributes no
 *    separate row of its own.
 * 3. `app.opened` / `day.reported` (self-instrumentation, PRD §22) are kept
 *    out of `event_count` / `domain_counts` entirely, in their own
 *    `instrumentation_count` — neither the Loop, the nightly report, XP,
 *    nor momentum may read from it.
 *
 * Attention-layer events never enter this computation at all: they live in
 * the separate `attention_events` table (lib/attention-events.ts) and this
 * module never queries it.
 */
import type { PoolClient } from "pg";
import { computeLogicalDay } from "./logical-day";
import { INSTRUMENTATION_EVENT_TYPES, type EventType } from "./events";

export interface RollupRow {
  logicalDay: string;
  eventCount: number;
  domainCounts: Record<string, number>;
  instrumentationCount: number;
}

interface EventRow {
  id: string;
  type: EventType;
  occurred_at: Date;
  timezone: string;
  domain: string | null;
  recorded_at: Date;
}

const CORRECTED_SUFFIX = ".corrected";
const INSTRUMENTATION_TYPES = new Set<string>(INSTRUMENTATION_EVENT_TYPES);

interface DayBucket {
  eventCount: number;
  domainCounts: Record<string, number>;
  instrumentationCount: number;
}

/** Drops and recomputes daily_rollup from `events`. Caller controls the transaction. */
export async function rebuildDailyRollup(client: PoolClient): Promise<RollupRow[]> {
  const { rows } = await client.query<
    EventRow & { subject_id: string | null }
  >(`SELECT id, type, occurred_at, timezone, domain, subject_id, recorded_at FROM events`);

  // Latest correction per (original event id, type it corrects).
  const latestCorrection = new Map<string, EventRow>();
  const originals: EventRow[] = [];

  for (const row of rows) {
    if (row.type.endsWith(CORRECTED_SUFFIX) && row.subject_id) {
      const correctedType = row.type.slice(0, -CORRECTED_SUFFIX.length);
      const key = `${row.subject_id}:${correctedType}`;
      const existing = latestCorrection.get(key);
      if (!existing || row.recorded_at > existing.recorded_at) {
        latestCorrection.set(key, row);
      }
    } else {
      originals.push(row);
    }
  }

  const days = new Map<string, DayBucket>();
  const bucketFor = (day: string): DayBucket => {
    let bucket = days.get(day);
    if (!bucket) {
      bucket = { eventCount: 0, domainCounts: {}, instrumentationCount: 0 };
      days.set(day, bucket);
    }
    return bucket;
  };

  for (const original of originals) {
    const correction = latestCorrection.get(`${original.id}:${original.type}`);
    const effective = correction ?? original;
    const logicalDay = computeLogicalDay(effective.occurred_at, effective.timezone);
    const bucket = bucketFor(logicalDay);

    if (INSTRUMENTATION_TYPES.has(original.type)) {
      bucket.instrumentationCount += 1;
    } else {
      bucket.eventCount += 1;
      if (effective.domain) {
        bucket.domainCounts[effective.domain] = (bucket.domainCounts[effective.domain] ?? 0) + 1;
      }
    }
  }

  await client.query("TRUNCATE daily_rollup");

  for (const [logicalDay, bucket] of days) {
    await client.query(
      `INSERT INTO daily_rollup (logical_day, event_count, domain_counts, instrumentation_count)
       VALUES ($1, $2, $3, $4)`,
      [logicalDay, bucket.eventCount, JSON.stringify(bucket.domainCounts), bucket.instrumentationCount]
    );
  }

  const result = await client.query<{
    logical_day: string;
    event_count: number;
    domain_counts: Record<string, number>;
    instrumentation_count: number;
  }>(
    `SELECT logical_day, event_count, domain_counts, instrumentation_count
     FROM daily_rollup ORDER BY logical_day`
  );

  return result.rows.map((row) => ({
    logicalDay: row.logical_day,
    eventCount: row.event_count,
    domainCounts: row.domain_counts,
    instrumentationCount: row.instrumentation_count,
  }));
}
