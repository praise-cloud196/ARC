/**
 * Resolves `events` into effective, correction-applied form
 * (milestone-1.1-fixes.md items 2-3). For each original (non-`.corrected`)
 * event:
 *
 * - `occurredAt` / `domain` / `payload` reflect the latest correction that
 *   references it, if any — the same default-inherit-unless-overridden rule
 *   appendCorrection writes with (lib/events.ts), so this just reads back
 *   what was written rather than re-deciding anything.
 * - `logicalDay` is always recomputed from the effective `occurredAt` +
 *   `timezone`, never trusted from the stored `logical_day` column, so a
 *   bug in the day-boundary logic is recoverable by recomputing rather than
 *   by editing history.
 * - Correction events themselves never appear in the result — they exist
 *   only to be folded into the original they reference.
 * - An event whose effective payload has `voided: true`
 *   (design-revision-v2.md §7.2) is dropped from the result entirely by
 *   default — "a voided event contributes nothing anywhere
 *   resolveEffectiveEvents is consumed." Pass `{ includeVoided: true }` to
 *   see it anyway (still with `payload.voided` set); the only legitimate
 *   reason is a "show withdrawn" management view (§7.3) — everything else
 *   (XP, momentum, dormancy, rollups, the report, counts) wants the
 *   default. The original row is never removed either way; this only
 *   controls whether it appears in *this* fold's output.
 *
 * Split into `fetchRawEventRows` (the one DB round trip) and
 * `resolveEffectiveEvents` (a pure in-memory fold) since milestone-4-spec.md
 * §1: a caller needing several derived values from one request — the
 * morning screen needing per-domain XP, level high-water marks, marks
 * count, and tenure all at once (lib/identity.ts) — must fetch the raw rows
 * once and run every computation over that same in-memory array, not issue
 * a fresh query per value. lib/xp.ts's `computeDomainLevel` needs the *raw*
 * rows (unfolded, in recorded_at order) rather than this module's folded
 * output — see its own comment for why — so both shapes are exported, and
 * it tracks voided-ness itself rather than going through this function.
 *
 * Shared by lib/rollup.ts, lib/xp.ts, lib/dormancy.ts, lib/marks.ts, and
 * lib/identity.ts (and anything else that needs "what actually happened,
 * after corrections") so this resolution has exactly one implementation.
 * Attention-layer events never enter this: they live in the separate
 * `attention_events` table (lib/attention-events.ts) and this module never
 * queries it.
 */
import type { Pool, PoolClient } from "pg";
import { computeLogicalDay } from "./logical-day";
import type { EventType } from "./events";

type Queryable = Pool | PoolClient;

export interface EffectiveEvent {
  id: string;
  /** The original event's type — never a `.corrected` type. */
  type: EventType;
  occurredAt: Date;
  logicalDay: string;
  domain: string | null;
  /** The original event's `subject_id` (which row it refers to, e.g. a commitment) — corrections never carry their own, so this always reflects the original's. */
  subjectId: string | null;
  payload: Record<string, unknown>;
}

export interface ResolveEffectiveEventsOptions {
  /**
   * Include voided events in the result instead of dropping them (see this
   * module's header comment). Default false.
   */
  includeVoided?: boolean;
}

export interface RawEventRow {
  id: string;
  type: EventType;
  occurred_at: Date;
  timezone: string;
  domain: string | null;
  subject_id: string | null;
  payload: Record<string, unknown>;
  recorded_at: Date;
}

const CORRECTED_SUFFIX = ".corrected";

/** The one query: every row of `events`, unfolded. Callers needing more than one derived value fetch this once and pass the result to every pure computation that needs it. */
export async function fetchRawEventRows(client: Queryable): Promise<RawEventRow[]> {
  const { rows } = await client.query<RawEventRow>(
    `SELECT id, type, occurred_at, timezone, domain, subject_id, payload, recorded_at FROM events`
  );
  return rows;
}

/** Pure — no I/O. Folds corrections into their originals; see this module's header comment for the rules, including `options.includeVoided`. */
export function resolveEffectiveEvents(
  rows: RawEventRow[],
  options: ResolveEffectiveEventsOptions = {}
): EffectiveEvent[] {
  // Latest correction per (original event id, type it corrects).
  const latestCorrection = new Map<string, RawEventRow>();
  const originals: RawEventRow[] = [];

  for (const row of rows) {
    if (row.type.endsWith(CORRECTED_SUFFIX) && row.subject_id) {
      const correctedType = row.type.slice(0, -CORRECTED_SUFFIX.length);
      const key = `${row.subject_id}:${correctedType}`;
      const existing = latestCorrection.get(key);
      if (!existing || row.recorded_at > existing.recorded_at) {
        latestCorrection.set(key, row);
      }
    } else {
      originals.push(row);
    }
  }

  const resolved = originals.map((original) => {
    const correction = latestCorrection.get(`${original.id}:${original.type}`);
    const occurredAt = correction?.occurred_at ?? original.occurred_at;
    const timezone = correction?.timezone ?? original.timezone;
    const domain = correction?.domain ?? original.domain;
    const payload = correction ? { ...original.payload, ...correction.payload } : original.payload;

    return {
      id: original.id,
      type: original.type,
      occurredAt,
      logicalDay: computeLogicalDay(occurredAt, timezone),
      domain,
      subjectId: original.subject_id,
      payload,
    };
  });

  if (options.includeVoided) return resolved;
  return resolved.filter((event) => event.payload.voided !== true);
}

/** Convenience for callers that only need one derived value: fetch and fold in one call. */
export async function resolveEffectiveEventsFromDb(
  client: Queryable,
  options?: ResolveEffectiveEventsOptions
): Promise<EffectiveEvent[]> {
  return resolveEffectiveEvents(await fetchRawEventRows(client), options);
}
