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
import { retroactiveMarkStats } from "./marks";

export async function getCurrentRank(client: PoolClient): Promise<Rank> {
  const result = await client.query<{ payload: { startingRank: Rank } }>(
    `SELECT payload FROM events WHERE type = 'audit.completed' LIMIT 1`
  );
  return result.rows[0]?.payload.startingRank ?? DEFAULT_STARTING_RANK;
}

export interface ProposedStartingRank {
  rank: Rank;
  /** e.g. "Retroactive Marks in 3 domains, 7 total." — milestone-3-spec.md §6: legible, not mysterious. */
  explanation: string;
  retroDomains: number;
  retroMarks: number;
}

/**
 * milestone-3-spec.md §6's deterministic proposal rule, capped at
 * AUDIT_STARTING_RANK_CAP regardless of how many retroactive Marks qualify
 * — B/A/S can only be earned through season closes, never granted by
 * self-report.
 */
export async function computeProposedStartingRank(client: PoolClient): Promise<ProposedStartingRank> {
  const { count: retroMarks, domains } = await retroactiveMarkStats(client);
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

/** RANKS index — higher is better. Used to enforce "adjust down, never up" (milestone-3-spec.md §6). */
export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}
