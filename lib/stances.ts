/**
 * Stances (milestone-3-spec.md §4 — this is where AGENTS.md hard rule 10
 * finally gets implemented). `stances` is a direction table
 * (architecture-and-ux-v1.0.md §2.3): one row per behaviour, freely
 * editable; `stance.changed` in `attention_events` carries the history.
 *
 * The `not_now` filter is enforced here, at the query layer, not left to
 * callers to remember: `getActiveStances` is the only function most code
 * should ever call, and it structurally cannot return a `not_now` row.
 * `getAllStancesForManagement` is the one deliberate exception — the
 * stance-management screen itself, where `not_now` behaviours must still be
 * visible so they can be reactivated.
 *
 * Stances may only be changed at season boundaries (PRD §16); Season 01's
 * opening (the audit) is itself a boundary, so setting them here is
 * legitimate (milestone-3-spec.md §4). Enforcing that restriction in
 * general — rejecting a change mid-season — is milestone 7 scope, once
 * season boundaries are something the data layer can actually detect; it
 * isn't enforced here yet.
 */
import type { PoolClient } from "pg";
import { appendAttentionEvent, type AppendedAttentionEvent } from "./attention-events";
import { getTimezone } from "./logical-day";
import { retroactiveMarkStats } from "./marks";
import { AUDIT_MIN_RETROACTIVE_MARKS } from "./calibration";

export type StanceValue = "observing" | "reducing" | "abstaining" | "not_now";

export interface Stance {
  id: string;
  behaviour: string;
  stance: StanceValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetStanceInput {
  behaviour: string;
  stance: StanceValue;
  occurredAt?: Date;
  timezone?: string;
}

interface StanceRow {
  id: string;
  behaviour: string;
  stance: StanceValue;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: StanceRow): Stance {
  return {
    id: row.id,
    behaviour: row.behaviour,
    stance: row.stance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Gated on the retroactive-Marks minimum, same as lib/quests.ts's recordOutcome — see its comment. */
export async function setStance(client: PoolClient, input: SetStanceInput): Promise<AppendedAttentionEvent> {
  const stats = await retroactiveMarkStats(client);
  if (stats.count < AUDIT_MIN_RETROACTIVE_MARKS) {
    throw new Error(
      `Cannot set a stance before ${AUDIT_MIN_RETROACTIVE_MARKS} retroactive Marks are logged ` +
        `(have ${stats.count}).`
    );
  }

  const upserted = await client.query<{ id: string }>(
    `INSERT INTO stances (behaviour, stance) VALUES ($1, $2)
     ON CONFLICT (behaviour) DO UPDATE SET stance = excluded.stance, updated_at = clock_timestamp()
     RETURNING id`,
    [input.behaviour, input.stance]
  );
  const row = upserted.rows[0];
  if (!row) throw new Error("Failed to upsert stances row.");

  return appendAttentionEvent(client, {
    type: "stance.changed",
    occurredAt: input.occurredAt ?? new Date(),
    subjectId: row.id,
    payload: { behaviour: input.behaviour, stance: input.stance },
    timezone: input.timezone ?? getTimezone(),
  });
}

/** Every stance except `not_now` (AGENTS.md hard rule 10). The only function most code should call. */
export async function getActiveStances(client: PoolClient): Promise<Stance[]> {
  const result = await client.query<StanceRow>(
    `SELECT id, behaviour, stance, created_at, updated_at FROM stances WHERE stance <> 'not_now' ORDER BY behaviour`
  );
  return result.rows.map(mapRow);
}

/**
 * Every stance, `not_now` included. Reserved for the stance-management
 * screen itself — anything else must call `getActiveStances` instead
 * (AGENTS.md hard rule 10, milestone-3-spec.md §4: "the filter is at the
 * query layer... so a future surface cannot forget it").
 */
export async function getAllStancesForManagement(client: PoolClient): Promise<Stance[]> {
  const result = await client.query<StanceRow>(
    `SELECT id, behaviour, stance, created_at, updated_at FROM stances ORDER BY behaviour`
  );
  return result.rows.map(mapRow);
}
