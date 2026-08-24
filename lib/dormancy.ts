/**
 * Domain dormancy (milestone-2-spec.md §5). A domain with no conduct in it
 * for `DOMAIN_DORMANCY_DAYS` enters a dormant display state — a fact
 * rendered, not a consequence applied: no XP loss, no level loss, no
 * penalty of any kind (AGENTS.md hard rule 12).
 *
 * Distinct from momentum's whole-character Dormant state
 * (`MOMENTUM_DORMANT_INACTIVITY_DAYS`, 7 days, lib/momentum.ts): this is
 * per-domain and uses a different, longer window (21 days). Both are
 * calibration constants and must not be conflated
 * (milestone-2-spec.md §5).
 */
import type { PoolClient } from "pg";
import { DOMAIN_DORMANCY_DAYS } from "./calibration";
import { daysBetween } from "./day-math";
import { fetchRawEventRows, resolveEffectiveEvents, type EffectiveEvent } from "./effective-events";
import type { Domain } from "./domains";

// Only these event types ever carry a domain, so only they can count as
// "conduct in that domain". `commitment.missed` is deliberately excluded —
// a miss is an absence, not conduct, matching momentum's Dormant check
// (lib/momentum.ts) which counts only positive conduct too.
const DOMAIN_CONDUCT_EVENT_TYPES = new Set(["commitment.completed", "quest.step_completed", "mark.recorded"]);

/**
 * Pure — no I/O. See `lastConductLogicalDay` below. `events` is expected
 * to come from resolveEffectiveEvents's default (voided-excluding)
 * behaviour (design-revision-v2.md §7.2, which names dormancy explicitly),
 * so a voided completion or Mark never reaches this loop — a mistake
 * shouldn't reset a domain's dormancy clock any more than it should earn
 * XP.
 */
export function lastConductLogicalDayFromEvents(events: EffectiveEvent[], domain: Domain): string | null {
  let latest: string | null = null;
  for (const event of events) {
    if (event.domain !== domain) continue;
    if (!DOMAIN_CONDUCT_EVENT_TYPES.has(event.type)) continue;
    if (latest === null || event.logicalDay > latest) {
      latest = event.logicalDay;
    }
  }
  return latest;
}

/**
 * The most recent logical day with conduct in `domain`, or null if there
 * has never been any. Fetches and folds the log itself — a caller also
 * needing other derived values from the same request should fetch once and
 * call `lastConductLogicalDayFromEvents` directly instead
 * (milestone-4-spec.md §1).
 */
export async function lastConductLogicalDay(client: PoolClient, domain: Domain): Promise<string | null> {
  const events = resolveEffectiveEvents(await fetchRawEventRows(client));
  return lastConductLogicalDayFromEvents(events, domain);
}

/** Whether `domain` is dormant as of `asOfLogicalDay`, given the domain's last conduct day (or null if it never had any). */
export function isDormant(lastConductDay: string | null, asOfLogicalDay: string): boolean {
  if (lastConductDay === null) return false;
  return daysBetween(lastConductDay, asOfLogicalDay) >= DOMAIN_DORMANCY_DAYS;
}
