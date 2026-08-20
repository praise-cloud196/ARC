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
 *
 * Shared by lib/rollup.ts and lib/xp.ts (and anything else that needs "what
 * actually happened, after corrections") so this resolution has exactly one
 * implementation. Attention-layer events never enter this: they live in the
 * separate `attention_events` table (lib/attention-events.ts) and this
 * module never queries it.
 */
import type { PoolClient } from "pg";
import { computeLogicalDay } from "./logical-day";
import type { EventType } from "./events";

export interface EffectiveEvent {
  id: string;
  /** The original event's type — never a `.corrected` type. */
  type: EventType;
  occurredAt: Date;
  logicalDay: string;
  domain: string | null;
  payload: Record<string, unknown>;
}

interface RawEventRow {
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

export async function resolveEffectiveEvents(client: PoolClient): Promise<EffectiveEvent[]> {
  const { rows } = await client.query<RawEventRow>(
    `SELECT id, type, occurred_at, timezone, domain, subject_id, payload, recorded_at FROM events`
  );

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

  return originals.map((original) => {
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
      payload,
    };
  });
}
