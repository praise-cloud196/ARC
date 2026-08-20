/**
 * Identity (milestone-2-spec.md §7). Composed for display from rank,
 * per-domain levels, count of Marks, and tenure. Nothing in Identity may
 * decrease (AGENTS.md hard rule 12) — that holds here because every input
 * already holds it individually: rank (lib/rank.ts), levels
 * (lib/calibration.ts's levelForXp, monotonic in XP which is
 * append-only-derived), Marks count (a count of immutable events), and
 * tenure (a distance from a fixed starting point that only grows).
 */
import type { PoolClient } from "pg";
import type { Rank } from "./calibration";
import { daysBetweenInclusive } from "./day-math";
import { SCORED_DOMAINS, type ScoredDomain } from "./domains";
import { computeLogicalDay, getTimezone } from "./logical-day";
import { getCurrentRank } from "./rank";
import { computeDomainLevel } from "./xp";

export interface Identity {
  rank: Rank;
  domainLevels: Record<ScoredDomain, number>;
  marksCount: number;
  /** Logical days since the first event in the log, inclusive of today (a first-day user has tenure 1). */
  tenureDays: number;
}

/** Composes the current Identity. `asOf` defaults to now; pass a fixed Date in tests. */
export async function computeIdentity(client: PoolClient, asOf: Date = new Date()): Promise<Identity> {
  const domainLevels = {} as Record<ScoredDomain, number>;
  for (const domain of SCORED_DOMAINS) {
    // computeDomainLevel, not levelForXp(computeDomainXp(...)) — the latter
    // would let a downward correction take away a level (milestone-2.1-fixes.md
    // item 1, AGENTS.md hard rule 12).
    domainLevels[domain] = await computeDomainLevel(client, domain);
  }

  // Marks are permanent and never revised away by a correction (only their
  // content can be corrected), so a plain count of original mark.recorded
  // events is the count of Marks — no correction resolution needed.
  const marksResult = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM events WHERE type = 'mark.recorded'`
  );
  const marksCount = marksResult.rows[0]?.count ?? 0;

  const firstEventResult = await client.query<{ first_occurred_at: Date | null }>(
    `SELECT min(occurred_at) AS first_occurred_at FROM events`
  );
  const firstOccurredAt = firstEventResult.rows[0]?.first_occurred_at ?? null;
  const timezone = getTimezone();
  const tenureDays = firstOccurredAt
    ? daysBetweenInclusive(
        computeLogicalDay(new Date(firstOccurredAt), timezone),
        computeLogicalDay(asOf, timezone)
      )
    : 0;

  return {
    rank: getCurrentRank(),
    domainLevels,
    marksCount,
    tenureDays,
  };
}
