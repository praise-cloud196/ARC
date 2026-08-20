/**
 * Rank (milestone-2-spec.md §6). Milestone 2 stores and displays the
 * current rank only — rank never changes here; promotion is evaluated at
 * season close (milestone 7), which doesn't exist yet either. Starting
 * rank comes from the baseline audit (milestone 3); until that exists too,
 * this reads the config default. Once milestone 3 ships a real place to
 * persist the audited starting rank, this function is where that gets
 * wired in — nothing outside this module should need to change.
 *
 * Rank never decreases, under any condition (AGENTS.md hard rule 12).
 */
import { DEFAULT_STARTING_RANK, type Rank } from "./calibration";

export function getCurrentRank(): Rank {
  return DEFAULT_STARTING_RANK;
}
