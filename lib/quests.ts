/**
 * Quests — milestone 3 covers only kind `outcome` (milestone-3-spec.md §2
 * step 5, the three 2027 statements). Commitment/Undertaking/Probe are
 * milestone 5; this module and db/migrations/0006_baseline_audit.sql's
 * `quests` table both deliberately stop at what outcome needs.
 *
 * `quests` is a direction table (architecture-and-ux-v1.0.md §2.3): current
 * state, freely editable, no append-only trigger. `quest.created`'s
 * `subject_id` points at the row it created — the same convention
 * lib/attention-events.ts already established for `stance.changed` before
 * the `stances` table existed.
 */
import type { Pool, PoolClient } from "pg";
import { appendEvent, type AppendedEvent } from "./events";
import { getTimezone } from "./logical-day";
import { retroactiveMarkStats } from "./marks";
import { AUDIT_MIN_RETROACTIVE_MARKS } from "./calibration";

type Queryable = Pool | PoolClient;

export interface Outcome {
  id: string;
  statement: string;
  status: "active" | "achieved" | "abandoned";
  createdAt: Date;
}

export interface RecordOutcomeInput {
  statement: string;
  occurredAt?: Date;
  timezone?: string;
}

/**
 * Records one of the three 2027 statements as a top-level Outcome. Gated on
 * the retroactive-Marks minimum (milestone-3-spec.md §3 / §7 — "the user
 * cannot skip past this step"), the same guard lib/seasons.ts's
 * `openSeason` and lib/stances.ts's `setStance` apply, since all three
 * belong to audit steps after retroactive Marks.
 */
export async function recordOutcome(client: PoolClient, input: RecordOutcomeInput): Promise<AppendedEvent> {
  const stats = await retroactiveMarkStats(client);
  if (stats.count < AUDIT_MIN_RETROACTIVE_MARKS) {
    throw new Error(
      `Cannot record an Outcome before ${AUDIT_MIN_RETROACTIVE_MARKS} retroactive Marks are logged ` +
        `(have ${stats.count}).`
    );
  }

  const inserted = await client.query<{ id: string; created_at: Date }>(
    `INSERT INTO quests (kind, statement) VALUES ('outcome', $1) RETURNING id, created_at`,
    [input.statement]
  );
  const row = inserted.rows[0];
  if (!row) throw new Error("Failed to insert quests row.");

  return appendEvent(client, {
    type: "quest.created",
    occurredAt: input.occurredAt ?? new Date(),
    subjectId: row.id,
    payload: { kind: "outcome", statement: input.statement },
    timezone: input.timezone ?? getTimezone(),
  });
}

export async function listOutcomes(client: Queryable): Promise<Outcome[]> {
  const result = await client.query<{ id: string; statement: string; status: Outcome["status"]; created_at: Date }>(
    `SELECT id, statement, status, created_at FROM quests WHERE kind = 'outcome' ORDER BY created_at ASC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    statement: row.statement,
    status: row.status,
    createdAt: row.created_at,
  }));
}
