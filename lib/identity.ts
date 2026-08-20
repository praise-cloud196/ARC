/**
 * Identity (milestone-2-spec.md §7). Composed for display from rank,
 * per-domain levels, count of Marks, and tenure. Nothing in Identity may
 * decrease (AGENTS.md hard rule 12) — that holds here because every input
 * already holds it individually: rank (lib/rank.ts), levels
 * (lib/calibration.ts's levelForXp, monotonic in XP which is
 * append-only-derived), Marks count (a count of immutable events), and
 * tenure (a distance from a fixed starting point that only grows).
 *
 * milestone-4-spec.md §1: this is the concrete case that motivated the
 * fetch-once split in lib/effective-events.ts — before, this issued one
 * query per scored domain (computeDomainLevel) plus another for tenure
 * (resolveEffectiveEvents) plus one for rank (getCurrentRank) plus one for
 * marks count, all to render a single result the morning screen calls on
 * every render. Now: one `fetchRawEventRows`, and every value below is
 * computed from that same in-memory array.
 */
import type { PoolClient } from "pg";
import type { Rank } from "./calibration";
import { daysBetweenInclusive } from "./day-math";
import { SCORED_DOMAINS, type ScoredDomain } from "./domains";
import { fetchRawEventRows, resolveEffectiveEvents } from "./effective-events";
import { computeLogicalDay, getTimezone } from "./logical-day";
import { deriveCurrentRankFromRows } from "./rank";
import { computeDomainLevelFromRows } from "./xp";

export interface Identity {
  rank: Rank;
  domainLevels: Record<ScoredDomain, number>;
  marksCount: number;
  /** Logical days since the first event in the log, inclusive of today (a first-day user has tenure 1). */
  tenureDays: number;
}

/** Composes the current Identity. `asOf` defaults to now; pass a fixed Date in tests. */
export async function computeIdentity(client: PoolClient, asOf: Date = new Date()): Promise<Identity> {
  const rows = await fetchRawEventRows(client);
  const effectiveEvents = resolveEffectiveEvents(rows);

  const domainLevels = {} as Record<ScoredDomain, number>;
  for (const domain of SCORED_DOMAINS) {
    // computeDomainLevelFromRows, not levelForXp(computeDomainXpFromEvents(...))
    // — the latter would let a downward correction take away a level
    // (milestone-2.1-fixes.md item 1, AGENTS.md hard rule 12).
    domainLevels[domain] = computeDomainLevelFromRows(rows, domain);
  }

  // Marks are permanent and never revised away by a correction (only their
  // content can be corrected), so a plain count of original mark.recorded
  // events is the count of Marks — no correction resolution needed.
  let marksCount = 0;
  for (const event of effectiveEvents) {
    if (event.type === "mark.recorded") marksCount += 1;
  }

  // min(occurred_at), excluding retroactive Marks (milestone-3-spec.md §3 —
  // occurred_at "may be years ago" for those, by design). Every other event
  // type's occurred_at is expected to sit close to real time, so this is a
  // targeted exclusion, not a switch to recorded_at: tenure should mean
  // "how long has this log been growing," and a 2019 achievement backdated
  // during onboarding must not make tenure read as seven years.
  let firstOccurredAt: Date | null = null;
  for (const event of effectiveEvents) {
    if (event.type === "mark.recorded" && event.payload.retroactive === true) continue;
    if (firstOccurredAt === null || event.occurredAt < firstOccurredAt) firstOccurredAt = event.occurredAt;
  }

  const timezone = getTimezone();
  const tenureDays = firstOccurredAt
    ? daysBetweenInclusive(computeLogicalDay(firstOccurredAt, timezone), computeLogicalDay(asOf, timezone))
    : 0;

  return {
    rank: deriveCurrentRankFromRows(rows),
    domainLevels,
    marksCount,
    tenureDays,
  };
}
