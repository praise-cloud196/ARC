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
import { XP_TIER_VALUES, type XpTier } from "./calibration";
import { resolveEffectiveEvents } from "./effective-events";
import type { Domain } from "./domains";

const XP_EVENT_TYPES = new Set(["commitment.completed", "quest.step_completed"]);

function isXpTier(value: unknown): value is XpTier {
  return typeof value === "number" && value in XP_TIER_VALUES;
}

/** Total XP for one domain, computed from the full event log with corrections applied. */
export async function computeDomainXp(client: PoolClient, domain: Domain): Promise<number> {
  const events = await resolveEffectiveEvents(client);

  let xp = 0;
  for (const event of events) {
    if (event.domain !== domain) continue;
    if (!XP_EVENT_TYPES.has(event.type)) continue;

    const tier = event.payload.tier;
    if (!isXpTier(tier)) {
      throw new Error(`${event.type} event ${event.id} has no valid payload.tier (got ${JSON.stringify(tier)})`);
    }
    xp += XP_TIER_VALUES[tier];
  }

  return xp;
}
