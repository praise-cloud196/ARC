/**
 * Seasons — milestone 3 covers only opening Season 01 (milestone-3-spec.md
 * §2 step 6). The fuller open-declaration fields PRD §15 describes (what
 * matters most, domains receiving attention, main quests,
 * deliberately-ignored) and season close both belong to milestone 7's
 * actual Ritual/Season wizard — see db/migrations/0006_baseline_audit.sql's
 * comment on the `seasons` table for why those aren't built here.
 *
 * `seasons` is a direction table (architecture-and-ux-v1.0.md §2.3);
 * `season.opened`'s `subject_id` points at the row it created, same
 * convention as lib/quests.ts's `quest.created`.
 */
import type { PoolClient } from "pg";
import { appendEvent, type AppendedEvent } from "./events";
import { getTimezone } from "./logical-day";
import { retroactiveMarkStats } from "./marks";
import { AUDIT_MIN_RETROACTIVE_MARKS } from "./calibration";

export interface OpenSeasonInput {
  number: number;
  occurredAt?: Date;
  timezone?: string;
}

/** Gated on the retroactive-Marks minimum, same as lib/quests.ts's recordOutcome — see its comment. */
export async function openSeason(client: PoolClient, input: OpenSeasonInput): Promise<AppendedEvent> {
  const stats = await retroactiveMarkStats(client);
  if (stats.count < AUDIT_MIN_RETROACTIVE_MARKS) {
    throw new Error(
      `Cannot open a season before ${AUDIT_MIN_RETROACTIVE_MARKS} retroactive Marks are logged ` +
        `(have ${stats.count}).`
    );
  }

  const occurredAt = input.occurredAt ?? new Date();

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO seasons (number, opened_at) VALUES ($1, $2) RETURNING id`,
    [input.number, occurredAt.toISOString()]
  );
  const row = inserted.rows[0];
  if (!row) throw new Error("Failed to insert seasons row.");

  return appendEvent(client, {
    type: "season.opened",
    occurredAt,
    subjectId: row.id,
    payload: { number: input.number },
    timezone: input.timezone ?? getTimezone(),
  });
}
