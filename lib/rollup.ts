/**
 * Rebuilds daily_rollup entirely from the event log
 * (architecture-and-ux-v1.0.md §2.4). The rollup is a cache, never an
 * authoritative source — dropping it and recomputing from events must
 * always produce identical state.
 */
import type { PoolClient } from "pg";

export interface RollupRow {
  logicalDay: string;
  eventCount: number;
  domainCounts: Record<string, number>;
}

/** Drops and recomputes daily_rollup from `events`. Caller controls the transaction. */
export async function rebuildDailyRollup(client: PoolClient): Promise<RollupRow[]> {
  await client.query("TRUNCATE daily_rollup");

  await client.query(`
    INSERT INTO daily_rollup (logical_day, event_count, domain_counts)
    SELECT
      logical_day,
      SUM(domain_count)::int AS event_count,
      COALESCE(
        jsonb_object_agg(domain, domain_count) FILTER (WHERE domain IS NOT NULL),
        '{}'::jsonb
      ) AS domain_counts
    FROM (
      SELECT logical_day, domain, COUNT(*) AS domain_count
      FROM events
      GROUP BY logical_day, domain
    ) per_domain
    GROUP BY logical_day
  `);

  const result = await client.query<{
    logical_day: string;
    event_count: number;
    domain_counts: Record<string, number>;
  }>(`SELECT logical_day, event_count, domain_counts FROM daily_rollup ORDER BY logical_day`);

  return result.rows.map((row) => ({
    logicalDay: row.logical_day,
    eventCount: row.event_count,
    domainCounts: row.domain_counts,
  }));
}
