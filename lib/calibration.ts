/**
 * All calibration constants for ARC (architecture-and-ux-v1.0.md §2.8).
 *
 * AGENTS.md hard rule 4: no numeric literal governing system behaviour may
 * appear outside this file. XP values, level costs, momentum thresholds,
 * dormancy, tenure, clock semantics — everything here, nowhere else.
 *
 * Values marked PROVISIONAL are placeholders per PRD-v1.0.md §26 and are
 * expected to change once four weeks of real usage data exist. They must
 * still live only here when that happens.
 */

// --- Time (architecture-and-ux-v1.0.md §2.5) --------------------------------

/**
 * Logical day boundary, in local hours. A session ending before this hour
 * belongs to the day that is ending, not the one beginning — the user's
 * sessions regularly run past midnight and into early morning
 * (milestone-1.1-fixes.md item 4b), so 04:00 was too early.
 *
 * This governs day-bucketing, which momentum is computed from, so it lives
 * here rather than in lib/logical-day.ts (AGENTS.md hard rule 4).
 */
export const LOGICAL_DAY_BOUNDARY_HOUR = 6;

// --- XP (PRD-v1.0.md §10) — PROVISIONAL ------------------------------------

export const XP_TIER_VALUES = {
  1: 10, // routine, up to ~30 min
  2: 25, // substantial, ~30-90 min
  3: 50, // demanding, 90+ min or genuinely hard
} as const;

export type XpTier = keyof typeof XP_TIER_VALUES;

// --- Domain levels (PRD-v1.0.md §10) — PROVISIONAL -------------------------

export const LEVEL_COST_BASE = 100;
export const LEVEL_COST_INCREMENT = 50;

/** Cumulative XP required to reach `level` in a domain. */
export function levelCost(level: number): number {
  return LEVEL_COST_BASE + LEVEL_COST_INCREMENT * (level - 1);
}

// --- Dormancy (philosophy-and-mechanics-v0.2.md §6) -------------------------

/** Days without domain activity before it enters the dormant display state. */
export const DOMAIN_DORMANCY_DAYS = 21;

// --- Momentum (PRD-v1.0.md §10) — thresholds PROVISIONAL -------------------

export const MOMENTUM_WINDOW_DAYS = 14;
export const MOMENTUM_STRONG_COMPLETION_RATE = 0.8; // >= this and stable/improving -> Strong
export const MOMENTUM_HOLDING_COMPLETION_RATE = 0.5; // 0.5-0.8 and stable -> Holding
export const MOMENTUM_DORMANT_INACTIVITY_DAYS = 7; // no activity for this long -> Dormant

// --- Rank (PRD-v1.0.md §10) — tenure minimum PROVISIONAL -------------------

export const RANK_MIN_TENURE_SEASONS = 1;
export const RANK_MIN_NEW_MARK_DOMAINS = 2;
export const RANK_MAX_DORMANT_DOMAINS_AT_CLOSE = 1;

// --- Seasons (PRD-v1.0.md §15) — length band PROVISIONAL -------------------

export const SEASON_MIN_WEEKS = 6;
export const SEASON_MAX_WEEKS = 12;
export const SEASON_CLOSE_PROMPT_WEEKS = [8, 12] as const;

// --- Return protocol (PRD-v1.0.md §19) --------------------------------------

export const RETURN_GAP_THRESHOLD_DAYS = 14;

// --- Recovery phase (PRD-v1.0.md §19) ---------------------------------------

export const RECOVERY_PHASE_MAX_WEEKS = 2;
export const RECOVERY_PHASE_MIN_COMMITMENTS = 1;
export const RECOVERY_PHASE_MAX_COMMITMENTS = 2;
