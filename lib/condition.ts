/**
 * Condition (milestone-2-spec.md §4). Two 3-point scales, logged by one tap
 * each, via `condition.logged`. Never scored, never aggregated into a
 * number, never labelled good or bad in any copy.
 *
 * At most one condition per logical day. A second write for the same day
 * is a correction, not a duplicate — `logCondition` finds the day's
 * existing entry (if any) and corrects it instead of inserting a second
 * one. This is an application-level rule, not a database constraint: a
 * unique index on `logical_day` would conflict with `logical_day` being a
 * recomputable write-time cache rather than a source of truth
 * (milestone-1.1-fixes.md item 3) — it's a rule about what `logCondition`
 * does with a lookup match, not an invariant the row shape can enforce.
 */
import type { Pool, PoolClient } from "pg";
import { appendCorrection, appendEvent, type AppendedEvent } from "./events";
import { computeLogicalDay, getTimezone } from "./logical-day";

type Queryable = Pool | PoolClient;

export type SleepLevel = "short" | "normal" | "long";
export type EnergyLevel = "low" | "normal" | "high";

export interface Condition {
  sleep: SleepLevel;
  energy: EnergyLevel;
}

export interface LogConditionInput extends Condition {
  occurredAt?: Date;
  timezone?: string;
}

/** Logs today's condition, or corrects today's existing entry if one was already logged. */
export async function logCondition(client: Queryable, input: LogConditionInput): Promise<AppendedEvent> {
  const occurredAt = input.occurredAt ?? new Date();
  const timezone = input.timezone ?? getTimezone();
  const logicalDay = computeLogicalDay(occurredAt, timezone);

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM events WHERE type = 'condition.logged' AND logical_day = $1 LIMIT 1`,
    [logicalDay]
  );
  const existingId = existing.rows[0]?.id;

  const payload: Record<string, unknown> = { sleep: input.sleep, energy: input.energy };

  if (existingId) {
    return appendCorrection(client, {
      correctsType: "condition.logged",
      correctsEventId: existingId,
      occurredAt,
      payload,
      timezone,
    });
  }

  return appendEvent(client, {
    type: "condition.logged",
    occurredAt,
    payload,
    timezone,
  });
}

/** The effective condition for `logicalDay` ('YYYY-MM-DD'), or null if none was logged. */
export async function getCondition(client: Queryable, logicalDay: string): Promise<Condition | null> {
  const result = await client.query<{ payload: Condition }>(
    `SELECT payload FROM events
     WHERE (type = 'condition.logged' AND logical_day = $1)
        OR (type = 'condition.logged.corrected' AND subject_id IN (
              SELECT id FROM events WHERE type = 'condition.logged' AND logical_day = $1
            ))
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [logicalDay]
  );

  const row = result.rows[0];
  return row ? row.payload : null;
}
