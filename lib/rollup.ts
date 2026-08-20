/**
 * Rebuilds daily_rollup entirely from the event log
 * (architecture-and-ux-v1.0.md §2.4). The rollup is a cache, never an
 * authoritative source — dropping it and recomputing from events alone must
 * always produce identical state.
 *
 * Correction resolution and logical_day recomputation happen in
 * lib/effective-events.ts (shared with lib/xp.ts); this module's own job is
 * just bucketing the result by day and separating conduct from
 * self-instrumentation (`app.opened` / `day.reported`, PRD §22) into
 * `instrumentation_count` — neither the Loop, the nightly report, XP, nor
 * momentum may read from that count (milestone-1.1-fixes.md item 4).
 *
 * Attention-layer events never enter this computation at all: they live in
 * the separate `attention_events` table (lib/attention-events.ts) and
 * lib/effective-events.ts never queries it.
 */
import type { PoolClient } from "pg";
import { INSTRUMENTATION_EVENT_TYPES } from "./events";
import { resolveEffectiveEventsFromDb } from "./effective-events";

export interface RollupRow {
  logicalDay: string;
  eventCount: number;
  domainCounts: Record<string, number>;
  instrumentationCount: number;
}

const INSTRUMENTATION_TYPES = new Set<string>(INSTRUMENTATION_EVENT_TYPES);

interface DayBucket {
  eventCount: number;
  domainCounts: Record<string, number>;
  instrumentationCount: number;
}

/** Drops and recomputes daily_rollup from `events`. Caller controls the transaction. */
export async function rebuildDailyRollup(client: PoolClient): Promise<RollupRow[]> {
  const effectiveEvents = await resolveEffectiveEventsFromDb(client);

  const days = new Map<string, DayBucket>();
  const bucketFor = (day: string): DayBucket => {
    let bucket = days.get(day);
    if (!bucket) {
      bucket = { eventCount: 0, domainCounts: {}, instrumentationCount: 0 };
      days.set(day, bucket);
    }
    return bucket;
  };

  for (const event of effectiveEvents) {
    const bucket = bucketFor(event.logicalDay);

    if (INSTRUMENTATION_TYPES.has(event.type)) {
      bucket.instrumentationCount += 1;
    } else {
      bucket.eventCount += 1;
      if (event.domain) {
        bucket.domainCounts[event.domain] = (bucket.domainCounts[event.domain] ?? 0) + 1;
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
