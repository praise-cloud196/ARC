/**
 * XP (milestone-2-spec.md §1). Derived at read time from conduct events —
 * never stored as a running total (AGENTS.md hard rule 3).
 *
 * Sources: `commitment.completed` and `quest.step_completed`, each worth
 * `XP_TIER_VALUES[tier]` of the event's `payload.tier`. Nothing else awards
 * XP — specifically `mark.recorded` (Marks are a separate, higher currency,
 * PRD §14), `condition.logged`, `life.entry_logged`, `app.opened`, and
 * `day.reported` all award zero, and Attention-layer events (a different
 * table entirely) are never even visible here.
 *
 * AGENTS.md hard rule 5 / architecture doc §3: XP must stay removable —
 * nothing in momentum, rank, Marks, history, or the nightly report may
 * import this module. If you're tempted to import lib/xp.ts from one of
 * those, stop; the dependency is supposed to run the other way, if at all.
 */
import type { PoolClient } from "pg";
import { XP_TIER_VALUES, levelForXp, type XpTier } from "./calibration";
import {
  fetchRawEventRows,
  resolveEffectiveEvents,
  type EffectiveEvent,
  type RawEventRow,
} from "./effective-events";
import type { Domain } from "./domains";

const XP_EVENT_TYPES = new Set(["commitment.completed", "quest.step_completed"]);

function isXpTier(value: unknown): value is XpTier {
  return typeof value === "number" && value in XP_TIER_VALUES;
}

/** Pure — no I/O. See `computeDomainXp` below for what this computes and why. */
export function computeDomainXpFromEvents(events: EffectiveEvent[], domain: Domain): number {
  let xp = 0;
  for (const event of events) {
    if (event.domain !== domain) continue;
    if (!XP_EVENT_TYPES.has(event.type)) continue;

    const tier = event.payload.tier;
    // db/migrations/0005_valid_xp_tier.sql rejects this at write time now
    // (milestone-2.1-fixes.md item 2), so this is a defensive assertion
    // that should never fire, not a real read-time validation path.
    if (!isXpTier(tier)) {
      throw new Error(`${event.type} event ${event.id} has no valid payload.tier (got ${JSON.stringify(tier)})`);
    }
    xp += XP_TIER_VALUES[tier];
  }
  return xp;
}

/**
 * Total XP for one domain, computed from the full event log with corrections
 * applied. This is the *current* total — milestone-2.1-fixes.md item 1: it
 * can fall after a downward correction, and that's correct, honest
 * behaviour for a number labelled "current XP". `computeDomainLevel` below
 * is the one that must never fall.
 *
 * Fetches and folds the log itself — fine for a standalone caller, but a
 * caller that also needs other derived values from the same request should
 * fetch once (`fetchRawEventRows` + `resolveEffectiveEvents`) and call
 * `computeDomainXpFromEvents` directly instead (milestone-4-spec.md §1;
 * lib/identity.ts does this).
 */
export async function computeDomainXp(client: PoolClient, domain: Domain): Promise<number> {
  const events = resolveEffectiveEvents(await fetchRawEventRows(client));
  return computeDomainXpFromEvents(events, domain);
}

/**
 * Pure — no I/O. The domain's level as a high-water mark
 * (milestone-2.1-fixes.md item 1; AGENTS.md hard rule 12 — nothing built is
 * ever taken away, including by the user's own honesty in correcting a
 * mis-logged entry).
 *
 * Replays the *raw* rows — originals and corrections as separate rows,
 * re-sorted here by `recorded_at` (the true, gapless append order of an
 * immutable log; `occurred_at` is just a user-editable label and can't
 * serve this purpose; `fetchRawEventRows` makes no ordering guarantee)
 * rebuilding "what the domain's total XP was known to be at each point the
 * log grew" and tracking the max level that total ever implied.
 *
 * This is deliberately not "replay `resolveEffectiveEvents` output by
 * `occurred_at`": once corrections are folded into an effective value, that
 * value is fixed for the whole walk, so every prefix sum is non-decreasing
 * and the max is just the final total — identical to the bug this fixes.
 * The high point only exists in the log's real write history, which is why
 * this walks raw rows in `recorded_at` order instead.
 */
export function computeDomainLevelFromRows(rows: RawEventRow[], domain: Domain): number {
  const relevant = rows
    .filter((row) => {
      const bareType = row.type.endsWith(".corrected") ? row.type.slice(0, -".corrected".length) : row.type;
      return XP_EVENT_TYPES.has(bareType);
    })
    .sort((a, b) => a.recorded_at.getTime() - b.recorded_at.getTime());

  // Current known {tier, domain} per original event id, updated in place as
  // corrections for it are encountered further down the log. `totalXp`
  // tracks the running sum for `domain` incrementally rather than summing
  // `known` fresh on every row.
  const known = new Map<string, { tier: XpTier; domain: string | null }>();
  let totalXp = 0;
  let maxLevel = 1;

  for (const row of relevant) {
    const isCorrection = row.type.endsWith(".corrected");
    const originalId = isCorrection ? row.subject_id : row.id;
    if (!originalId) continue; // db/migrations/0002_attention_split.sql guarantees this can't happen

    const tier = row.payload.tier;
    // Defensive assertion, not real validation — see computeDomainXp's comment.
    if (!isXpTier(tier)) {
      throw new Error(`${row.type} event ${row.id} has no valid payload.tier (got ${JSON.stringify(tier)})`);
    }

    const previous = known.get(originalId);
    if (previous && previous.domain === domain) totalXp -= XP_TIER_VALUES[previous.tier];
    if (row.domain === domain) totalXp += XP_TIER_VALUES[tier];
    known.set(originalId, { tier, domain: row.domain });

    const level = levelForXp(totalXp);
    if (level > maxLevel) maxLevel = level;
  }

  return maxLevel;
}

/**
 * Fetches the log itself — fine for a standalone caller, but a caller that
 * also needs other derived values from the same request should fetch once
 * and call `computeDomainLevelFromRows` directly instead
 * (milestone-4-spec.md §1; lib/identity.ts does this).
 */
export async function computeDomainLevel(client: PoolClient, domain: Domain): Promise<number> {
  return computeDomainLevelFromRows(await fetchRawEventRows(client), domain);
}
