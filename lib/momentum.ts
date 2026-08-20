/**
 * Momentum (milestone-2-spec.md §3). Resolves the PRD §10 table's
 * non-determinism ("Building" and "Strong" overlap; the first two weeks
 * have no prior period) into an exact state machine.
 *
 * This module is a pure function over already-fetched data, not a database
 * query. There is no `commitments` table yet — the architecture doc's own
 * milestone 5 ("Quests: commitments → undertakings → probes → outcomes")
 * comes after this one — so there is nothing to query. When it exists, the
 * wiring that reads commitments/completions/conduct-days out of the event
 * log and the commitments direction table and calls `computeMomentum` with
 * the result belongs there, not here. Keeping the arithmetic pure means it
 * doesn't have to wait for that table to be tested against the full edge
 * case table in milestone-2-spec.md §3.3.
 */
import {
  MOMENTUM_DORMANT_INACTIVITY_DAYS,
  MOMENTUM_STABLE_BAND,
  MOMENTUM_STRONG_COMPLETION_RATE,
  MOMENTUM_WINDOW_DAYS,
} from "./calibration";
import { addDays, daysBetweenInclusive } from "./day-math";

/**
 * Conduct for the Dormant check (milestone-2-spec.md §3.4). Explicitly
 * excludes `app.opened` / `day.reported` (self-instrumentation) and
 * everything in `attention_events` — opening the app is not activity, and
 * Attention data never feeds momentum (AGENTS.md hard rule 11).
 */
export const MOMENTUM_CONDUCT_EVENT_TYPES = [
  "commitment.completed",
  "quest.step_completed",
  "mark.recorded",
  "condition.logged",
  "life.entry_logged",
] as const;

export type MomentumState = "Dormant" | "Strong" | "Building" | "Slipping" | "Holding";

export interface MomentumCommitment {
  id: string;
  /** Times per week this commitment is expected to be completed. */
  weeklyTarget: number;
  /** Inclusive logical day ('YYYY-MM-DD') this commitment became active. */
  activeFrom: string;
  /** Inclusive logical day this commitment stopped being active, or null/undefined if still active. */
  activeUntil?: string | null;
}

export interface MomentumCompletion {
  commitmentId: string;
  /** Logical day ('YYYY-MM-DD') the completion counts toward. */
  logicalDay: string;
}

export interface MomentumInput {
  /** The logical day ('YYYY-MM-DD') momentum is being evaluated as of — typically today. */
  asOfLogicalDay: string;
  /**
   * Commitments relevant to the two windows being compared. During a
   * Recovery Phase (milestone-2-spec.md §3.3), pass only the reduced
   * commitment set — this function has no Recovery Phase logic of its own,
   * the caller controls it entirely by what it includes here.
   */
  commitments: MomentumCommitment[];
  completions: MomentumCompletion[];
  /**
   * Distinct logical days ('YYYY-MM-DD') on which any event in
   * MOMENTUM_CONDUCT_EVENT_TYPES occurred.
   */
  conductLogicalDays: string[];
}

export interface MomentumResult {
  state: MomentumState;
  /** Completion rate over the trailing MOMENTUM_WINDOW_DAYS, or null if undefined (no commitments in that window). */
  rateCurrent: number | null;
  /** Completion rate over the MOMENTUM_WINDOW_DAYS before that, or null if undefined. */
  ratePrior: number | null;
  /** rateCurrent - ratePrior, or null if either rate is undefined. */
  delta: number | null;
}

/** Clamped count of days [rangeStart, rangeEnd] a commitment active [activeFrom, activeUntil] overlaps. */
function daysActiveInWindow(
  commitment: MomentumCommitment,
  windowStart: string,
  windowEnd: string
): number {
  const overlapStart = commitment.activeFrom > windowStart ? commitment.activeFrom : windowStart;
  const activeUntil = commitment.activeUntil ?? windowEnd;
  const overlapEnd = activeUntil < windowEnd ? activeUntil : windowEnd;
  if (overlapStart > overlapEnd) return 0;
  return daysBetweenInclusive(overlapStart, overlapEnd);
}

/** Completion rate over [windowStart, windowEnd], or null if no commitments were expected in it (§3.1/§3.3). */
function completionRate(
  commitments: MomentumCommitment[],
  completions: MomentumCompletion[],
  windowStart: string,
  windowEnd: string
): number | null {
  let totalExpected = 0;
  let totalCompleted = 0;

  for (const commitment of commitments) {
    const daysActive = daysActiveInWindow(commitment, windowStart, windowEnd);
    if (daysActive <= 0) continue;

    // 7: days in a week — a calendar fact converting weeklyTarget into a
    // per-day rate, not a tunable value, so it doesn't belong in
    // lib/calibration.ts (AGENTS.md hard rule 4).
    const expected = commitment.weeklyTarget * (daysActive / 7);
    const completedRaw = completions.filter(
      (c) => c.commitmentId === commitment.id && c.logicalDay >= windowStart && c.logicalDay <= windowEnd
    ).length;

    totalExpected += expected;
    totalCompleted += Math.min(completedRaw, expected);
  }

  if (totalExpected === 0) return null;
  return totalCompleted / totalExpected;
}

export function computeMomentum(input: MomentumInput): MomentumResult {
  const currentEnd = input.asOfLogicalDay;
  const currentStart = addDays(currentEnd, -(MOMENTUM_WINDOW_DAYS - 1));
  const priorEnd = addDays(currentStart, -1);
  const priorStart = addDays(priorEnd, -(MOMENTUM_WINDOW_DAYS - 1));
  const dormantSince = addDays(currentEnd, -(MOMENTUM_DORMANT_INACTIVITY_DAYS - 1));

  const rateCurrent = completionRate(input.commitments, input.completions, currentStart, currentEnd);
  const ratePrior = completionRate(input.commitments, input.completions, priorStart, priorEnd);
  const delta = rateCurrent !== null && ratePrior !== null ? rateCurrent - ratePrior : null;

  const hasRecentConduct = input.conductLogicalDays.some(
    (day) => day >= dormantSince && day <= currentEnd
  );

  // Order matters (milestone-2-spec.md §3.2): checking Strong before
  // Slipping means a week at 95% following a week at 100% reads as Strong,
  // not Slipping — nothing built is taken away over a small dip (AGENTS.md
  // hard rule 12). Every §3.3 edge case (undefined rate/delta) falls
  // straight through to Holding via the null checks below, with no special
  // casing needed — that's also why Holding never becomes Slipping when
  // there are no commitments: delta is null, so row 4 never matches.
  let state: MomentumState;
  if (!hasRecentConduct) {
    state = "Dormant";
  } else if (rateCurrent !== null && rateCurrent >= MOMENTUM_STRONG_COMPLETION_RATE) {
    state = "Strong";
  } else if (delta !== null && delta > MOMENTUM_STABLE_BAND) {
    state = "Building";
  } else if (delta !== null && delta < -MOMENTUM_STABLE_BAND) {
    state = "Slipping";
  } else {
    state = "Holding";
  }

  return { state, rateCurrent, ratePrior, delta };
}
