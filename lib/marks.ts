/**
 * Retroactive Marks (milestone-3-spec.md §3) — the audit's step 2. General
 * (non-retroactive) Mark-writing is milestone 6 scope ("Marks and
 * evidence") and isn't built here; this module covers only what the audit
 * needs: writing a retroactive Mark and reading back the count/domains that
 * gate later audit steps and feed the starting-rank proposal (lib/rank.ts).
 */
import type { Pool, PoolClient } from "pg";
import { appendEvent, type AppendedEvent } from "./events";
import { fetchRawEventRows, resolveEffectiveEvents, type EffectiveEvent } from "./effective-events";
import { getTimezone } from "./logical-day";
import type { Domain } from "./domains";

type Queryable = Pool | PoolClient;

export interface RecordRetroactiveMarkInput {
  domain: Domain;
  /** The user's best estimate of when it actually happened — may be years ago. Required: this is what makes it retroactive. */
  occurredAt: Date;
  /** "What changed because of this?" (PRD §14) — required. */
  note: string;
  artifact?: string;
  timezone?: string;
}

export async function recordRetroactiveMark(
  client: Queryable,
  input: RecordRetroactiveMarkInput
): Promise<AppendedEvent> {
  const payload: Record<string, unknown> = { retroactive: true, note: input.note };
  if (input.artifact !== undefined) payload.artifact = input.artifact;

  return appendEvent(client, {
    type: "mark.recorded",
    occurredAt: input.occurredAt,
    domain: input.domain,
    payload,
    timezone: input.timezone ?? getTimezone(),
  });
}

export interface RetroactiveMarkStats {
  count: number;
  domains: Domain[];
}

/** Pure — no I/O. See `retroactiveMarkStats` below. */
export function retroactiveMarkStatsFromEvents(events: EffectiveEvent[]): RetroactiveMarkStats {
  const domains = new Set<Domain>();
  let count = 0;

  for (const event of events) {
    if (event.type !== "mark.recorded") continue;
    if (event.payload.retroactive !== true) continue;
    count += 1;
    if (event.domain) domains.add(event.domain as Domain);
  }

  return { count, domains: [...domains] };
}

/**
 * Count and distinct domains of retroactive Marks, corrections applied —
 * milestone-3-spec.md §6's `retroMarks` / `retroDomains`, and the §3
 * minimum-3 gate. Folds the log itself (not a raw count query) because a
 * correction could change a Mark's domain or its `retroactive` flag, and
 * both must reflect the corrected value. A caller also needing other
 * derived values from the same request should fetch once and call
 * `retroactiveMarkStatsFromEvents` directly instead (milestone-4-spec.md §1).
 */
export async function retroactiveMarkStats(client: PoolClient): Promise<RetroactiveMarkStats> {
  const events = resolveEffectiveEvents(await fetchRawEventRows(client));
  return retroactiveMarkStatsFromEvents(events);
}
