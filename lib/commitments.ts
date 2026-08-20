/**
 * Commitments (milestone-4-spec.md §0.1, §3 — moved up from milestone 5,
 * since the Loop can't display or complete anything without them).
 * `commitments` is a direction table (architecture-and-ux-v1.0.md §2.3);
 * db/migrations/0007_commitments.sql's weekly-lock trigger is the real
 * enforcement of "immutable during the current week" (PRD §13,
 * AGENTS.md hard rule 9) — this module doesn't re-check it, the same way
 * lib/events.ts doesn't re-check the append-only triggers.
 */
import type { Pool, PoolClient } from "pg";
import { appendCorrection, appendEvent, type AppendedEvent } from "./events";
import { getTimezone } from "./logical-day";
import { addDays, startOfWeek } from "./day-math";
import type { Domain } from "./domains";
import {
  computeMomentum,
  MOMENTUM_CONDUCT_EVENT_TYPES,
  type MomentumCommitment,
  type MomentumCompletion,
  type MomentumResult,
} from "./momentum";
import { MOMENTUM_WINDOW_DAYS } from "./calibration";

type Queryable = Pool | PoolClient;

/** Commitments only exist for the three Commitment-bearing domains (PRD §8) — not `life`. */
export type CommitmentDomain = Exclude<Domain, "life">;

export type ResistanceLevel = "easy" | "normal" | "against_resistance";

export interface Commitment {
  id: string;
  domain: CommitmentDomain;
  label: string;
  tier: 1 | 2 | 3;
  weeklyTarget: number;
  weekStart: string;
  activeFrom: string;
  activeUntil: string | null;
}

interface CommitmentRow {
  id: string;
  domain: CommitmentDomain;
  label: string;
  tier: 1 | 2 | 3;
  weekly_target: number;
  week_start: string;
  active_from: string;
  active_until: string | null;
}

function mapRow(row: CommitmentRow): Commitment {
  return {
    id: row.id,
    domain: row.domain,
    label: row.label,
    tier: row.tier,
    weeklyTarget: row.weekly_target,
    weekStart: row.week_start,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
  };
}

export interface DeclareCommitmentInput {
  domain: CommitmentDomain;
  label: string;
  tier: 1 | 2 | 3;
  weeklyTarget: number;
  /** The Monday of the week this commitment is declared for — must already be a Monday (lib/day-math.ts's startOfWeek). */
  weekStart: string;
}

/** Declares one commitment for a week. Active for that whole week [weekStart, weekStart + 6]. */
export async function declareCommitment(client: Queryable, input: DeclareCommitmentInput): Promise<Commitment> {
  if (startOfWeek(input.weekStart) !== input.weekStart) {
    throw new Error(`weekStart must be a Monday; got ${input.weekStart}`);
  }

  const activeUntilResult = await client.query<{ active_until: string }>(
    `SELECT ($1::date + 6)::date AS active_until`,
    [input.weekStart]
  );
  const activeUntil = activeUntilResult.rows[0]?.active_until;
  if (!activeUntil) throw new Error("Failed to compute active_until.");

  const inserted = await client.query<CommitmentRow>(
    `INSERT INTO commitments (domain, label, tier, weekly_target, week_start, active_from, active_until)
     VALUES ($1, $2, $3, $4, $5, $5, $6)
     RETURNING id, domain, label, tier, weekly_target, week_start, active_from, active_until`,
    [input.domain, input.label, input.tier, input.weeklyTarget, input.weekStart, activeUntil]
  );
  const row = inserted.rows[0];
  if (!row) throw new Error("Failed to insert commitments row.");
  return mapRow(row);
}

/** Every commitment declared for the week starting `weekStart`. */
export async function getCommitmentsForWeek(client: Queryable, weekStart: string): Promise<Commitment[]> {
  const result = await client.query<CommitmentRow>(
    `SELECT id, domain, label, tier, weekly_target, week_start, active_from, active_until
     FROM commitments WHERE week_start = $1 ORDER BY domain, label`,
    [weekStart]
  );
  return result.rows.map(mapRow);
}

export interface CompleteCommitmentInput {
  commitmentId: string;
  occurredAt?: Date;
  timezone?: string;
}

/**
 * Writes `commitment.completed` for one instance of completing `commitmentId`
 * this week — `weeklyTarget` is a count, so a commitment can be completed
 * more than once. Resistance is deliberately not collected here: the tap
 * completes immediately (architecture-and-ux-v1.0.md §4.2), resistance is
 * patched in afterward via `patchCommitmentCompletion`.
 */
export async function completeCommitment(client: Queryable, input: CompleteCommitmentInput): Promise<AppendedEvent> {
  const commitmentResult = await client.query<{ domain: CommitmentDomain; tier: 1 | 2 | 3 }>(
    `SELECT domain, tier FROM commitments WHERE id = $1`,
    [input.commitmentId]
  );
  const commitment = commitmentResult.rows[0];
  if (!commitment) throw new Error(`No commitment found with id ${input.commitmentId}`);

  return appendEvent(client, {
    type: "commitment.completed",
    occurredAt: input.occurredAt ?? new Date(),
    domain: commitment.domain,
    subjectId: input.commitmentId,
    payload: { tier: commitment.tier },
    timezone: input.timezone ?? getTimezone(),
  });
}

export interface PatchCommitmentCompletionInput {
  completionEventId: string;
  resistance?: ResistanceLevel;
  /** Optional one-line note (architecture-and-ux-v1.0.md §4.2), behind a secondary tap. */
  note?: string;
  timezone?: string;
}

/** Patches resistance and/or a note onto an already-written completion, via a correction. */
export async function patchCommitmentCompletion(
  client: Queryable,
  input: PatchCommitmentCompletionInput
): Promise<AppendedEvent> {
  const payload: Record<string, unknown> = {};
  if (input.resistance !== undefined) payload.resistance = input.resistance;
  if (input.note !== undefined) payload.note = input.note;

  return appendCorrection(client, {
    correctsType: "commitment.completed",
    correctsEventId: input.completionEventId,
    payload,
    timezone: input.timezone,
  });
}

/** Count of commitment.completed events (corrections don't change the count — only ever patch resistance/note) for `commitmentId` within [activeFrom, activeUntil]. */
export async function countCompletions(client: Queryable, commitmentId: string): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM events WHERE type = 'commitment.completed' AND subject_id = $1`,
    [commitmentId]
  );
  return result.rows[0]?.count ?? 0;
}

/**
 * The DB-wiring lib/momentum.ts's own header comment deferred to "when
 * [the commitments table] exists" — it does now. Reads every commitment
 * whose active window overlaps the two 14-day windows computeMomentum
 * compares (milestone-2-spec.md §3.1), every commitment.completed in that
 * range, and every logical day with a MOMENTUM_CONDUCT_EVENT_TYPES event,
 * then calls the pure computeMomentum with the result.
 */
export async function computeCurrentMomentum(client: Queryable, asOfLogicalDay: string): Promise<MomentumResult> {
  const lookbackStart = addDays(asOfLogicalDay, -(2 * MOMENTUM_WINDOW_DAYS - 1));

  const commitmentsResult = await client.query<CommitmentRow>(
    `SELECT id, domain, label, tier, weekly_target, week_start, active_from, active_until
     FROM commitments
     WHERE active_from <= $1 AND (active_until IS NULL OR active_until >= $2)`,
    [asOfLogicalDay, lookbackStart]
  );
  const commitments: MomentumCommitment[] = commitmentsResult.rows.map((row) => ({
    id: row.id,
    weeklyTarget: row.weekly_target,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
  }));

  const completionsResult = await client.query<{ commitment_id: string; logical_day: string }>(
    `SELECT subject_id AS commitment_id, logical_day FROM events
     WHERE type = 'commitment.completed' AND logical_day >= $1 AND logical_day <= $2`,
    [lookbackStart, asOfLogicalDay]
  );
  const completions: MomentumCompletion[] = completionsResult.rows.map((row) => ({
    commitmentId: row.commitment_id,
    logicalDay: row.logical_day,
  }));

  const conductResult = await client.query<{ logical_day: string }>(
    `SELECT DISTINCT logical_day FROM events
     WHERE type = ANY($1) AND logical_day >= $2 AND logical_day <= $3`,
    [MOMENTUM_CONDUCT_EVENT_TYPES as unknown as string[], lookbackStart, asOfLogicalDay]
  );
  const conductLogicalDays = conductResult.rows.map((row) => row.logical_day);

  return computeMomentum({ asOfLogicalDay, commitments, completions, conductLogicalDays });
}
