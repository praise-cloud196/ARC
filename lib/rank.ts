/**
 * Rank. `getCurrentRank` reads the audited starting rank (milestone 3) once
 * it exists, falling back to DEFAULT_STARTING_RANK before the audit
 * completes — the wiring milestone-2-spec.md §6's original comment here
 * promised. Rank never changes beyond that in milestone 3: promotion is
 * evaluated at season close (milestone 7), which doesn't exist yet.
 *
 * Rank never decreases, under any condition (AGENTS.md hard rule 12) — that
 * holds for `getCurrentRank` because `audit.completed` is written once
 * (db/migrations/0006_baseline_audit.sql) and nothing in milestone 3 can
 * overwrite it; a decrease would require a future milestone to introduce
 * one, not this module.
 */
import type { PoolClient } from "pg";
import {
  AUDIT_RANK_C_MIN_DOMAINS,
  AUDIT_RANK_C_MIN_MARKS,
  AUDIT_RANK_D_MIN_DOMAINS,
  AUDIT_RANK_D_MIN_MARKS,
  AUDIT_STARTING_RANK_CAP,
  DEFAULT_STARTING_RANK,
  RANKS,
  type Rank,
} from "./calibration";
import { fetchRawEventRows, resolveEffectiveEvents, type EffectiveEvent, type RawEventRow } from "./effective-events";
import { retroactiveMarkStatsFromEvents } from "./marks";

/** Pure — no I/O. See `getCurrentRank` below. */
export function deriveCurrentRankFromRows(rows: RawEventRow[]): Rank {
  for (const row of rows) {
    if (row.type === "audit.completed") return (row.payload as { startingRank: Rank }).startingRank;
  }
  return DEFAULT_STARTING_RANK;
}

/**
 * Fetches the log itself — fine for a standalone caller, but a caller also
 * needing other derived values from the same request should fetch once and
 * call `deriveCurrentRankFromRows` directly instead (milestone-4-spec.md §1;
 * lib/identity.ts does this).
 */
export async function getCurrentRank(client: PoolClient): Promise<Rank> {
  return deriveCurrentRankFromRows(await fetchRawEventRows(client));
}

export interface ProposedStartingRank {
  rank: Rank;
  /** e.g. "Retroactive Marks in 3 domains, 7 total." — milestone-3-spec.md §6: legible, not mysterious. */
  explanation: string;
  retroDomains: number;
  retroMarks: number;
}

/**
 * Pure — no I/O. milestone-3-spec.md §6's deterministic proposal rule,
 * capped at AUDIT_STARTING_RANK_CAP regardless of how many retroactive
 * Marks qualify — B/A/S can only be earned through season closes, never
 * granted by self-report.
 */
export function computeProposedStartingRankFromEvents(events: EffectiveEvent[]): ProposedStartingRank {
  const { count: retroMarks, domains } = retroactiveMarkStatsFromEvents(events);
  const retroDomains = domains.length;

  let rank: Rank;
  if (retroDomains >= AUDIT_RANK_C_MIN_DOMAINS && retroMarks >= AUDIT_RANK_C_MIN_MARKS) {
    rank = AUDIT_STARTING_RANK_CAP;
  } else if (retroDomains >= AUDIT_RANK_D_MIN_DOMAINS && retroMarks >= AUDIT_RANK_D_MIN_MARKS) {
    rank = "D";
  } else {
    rank = "E";
  }

  return {
    rank,
    explanation: `Retroactive Marks in ${retroDomains} domain${retroDomains === 1 ? "" : "s"}, ${retroMarks} total.`,
    retroDomains,
    retroMarks,
  };
}

/** Fetches and folds the log itself; see `computeProposedStartingRankFromEvents` for the pure version. */
export async function computeProposedStartingRank(client: PoolClient): Promise<ProposedStartingRank> {
  const events = resolveEffectiveEvents(await fetchRawEventRows(client));
  return computeProposedStartingRankFromEvents(events);
}

/** RANKS index — higher is better. Used to enforce "adjust down, never up" (milestone-3-spec.md §6). */
export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}
