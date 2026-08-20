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

// --- Domain levels (PRD-v1.0.md §10, milestone-2-spec.md §2) — PROVISIONAL -

export const LEVEL_COST_BASE = 100;
export const LEVEL_COST_INCREMENT = 50;

/**
 * The XP cost *of* `level` — i.e. how much XP it takes to advance from
 * `level - 1` to `level`. Not cumulative: milestone-2-spec.md §2 flagged the
 * previous name/doc here (`levelCost`, documented as "cumulative XP
 * required to reach level n") as ambiguous and probably wrong — it would
 * have put level 10 at 550 XP, reachable in about a week. Use
 * `xpToReachLevel` for the cumulative figure.
 */
export function xpCostOfLevel(level: number): number {
  return LEVEL_COST_BASE + LEVEL_COST_INCREMENT * (level - 1);
}

/** Cumulative XP required to reach `level` (i.e. to have just completed level - 1). Level 1 requires 0. */
export function xpToReachLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpCostOfLevel(l);
  }
  return total;
}

/**
 * The level `xp` total XP puts a domain at. This is a pure function of the
 * number given to it — it does not itself guarantee AGENTS.md hard rule 12
 * ("levels never decrease"). A correction can legitimately lower a domain's
 * *current* XP (milestone-2.1-fixes.md item 1), so `levelForXp(currentXp)`
 * is the wrong way to display a domain's level; `lib/xp.ts`'s
 * `computeDomainLevel` replays the log to find the high-water mark instead,
 * calling this at each step. Call this directly only where a possibly-lower
 * current level is genuinely what's wanted (`computeDomainLevel` itself).
 */
export function levelForXp(xp: number): number {
  let level = 1;
  while (xpToReachLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

// --- Dormancy (philosophy-and-mechanics-v0.2.md §6) -------------------------

/** Days without domain activity before it enters the dormant display state. */
export const DOMAIN_DORMANCY_DAYS = 21;

// --- Momentum (PRD-v1.0.md §10, milestone-2-spec.md §3) — PROVISIONAL ------

export const MOMENTUM_WINDOW_DAYS = 14;
export const MOMENTUM_STRONG_COMPLETION_RATE = 0.8; // >= this -> Strong (checked before Slipping — see lib/momentum.ts)
export const MOMENTUM_DORMANT_INACTIVITY_DAYS = 7; // no conduct for this long -> Dormant
/** delta magnitude within this band counts as stable (-> Holding), not Building/Slipping. */
export const MOMENTUM_STABLE_BAND = 0.05;

// --- Rank (PRD-v1.0.md §10) — tenure minimum PROVISIONAL -------------------

export const RANKS = ["E", "D", "C", "B", "A", "S"] as const;
export type Rank = (typeof RANKS)[number];

/**
 * Rank before the baseline audit (milestone 3) has run and written a real
 * starting rank. milestone-2-spec.md §6: "Starting rank comes from the
 * baseline audit; until then, read it from config" — this is that config.
 */
export const DEFAULT_STARTING_RANK: Rank = "E";

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
