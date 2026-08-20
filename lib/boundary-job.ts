/**
 * The boundary job (milestone-4-spec.md §6) — "the only scheduled job in
 * the product" (AGENTS.md hard rule 8). Runs once per logical day, at the
 * boundary: writes `commitment.missed` for every commitment whose week just
 * ended without meeting its weekly_target, then rebuilds daily_rollup.
 * Nothing else runs on a timer, and nothing sends anything.
 *
 * "Written by the boundary job, never by the user" (milestone-4-spec.md
 * §3) — `commitment.missed` is never written from the completion path
 * (lib/commitments.ts).
 *
 * A commitment's week ends exactly once (`active_until` is a fixed date set
 * at declaration), so filtering by `active_until = <the day that just
 * ended>` naturally fires this exactly once per commitment, on the correct
 * day, with no separate "is this the end of the week" check needed.
 * Idempotency-keyed so re-running the job for a day already processed
 * writes nothing twice.
 */
import type { PoolClient } from "pg";
import { appendEvent } from "./events";
import { addDays } from "./day-math";
import { countCompletions, type CommitmentDomain } from "./commitments";
import { rebuildDailyRollup, type RollupRow } from "./rollup";

export interface BoundaryJobResult {
  /** Logical day whose boundary just closed — the day commitment.missed is evaluated for. */
  closedLogicalDay: string;
  missedCommitmentIds: string[];
  rollup: RollupRow[];
}

/** `asOfLogicalDay` is the day beginning as the boundary is crossed — the day being closed out is the one before it. */
export async function runBoundaryJob(client: PoolClient, asOfLogicalDay: string): Promise<BoundaryJobResult> {
  const closedLogicalDay = addDays(asOfLogicalDay, -1);

  const endingCommitments = await client.query<{
    id: string;
    domain: CommitmentDomain;
    weekly_target: number;
  }>(`SELECT id, domain, weekly_target FROM commitments WHERE active_until = $1`, [closedLogicalDay]);

  const missedCommitmentIds: string[] = [];
  for (const commitment of endingCommitments.rows) {
    const completed = await countCompletions(client, commitment.id);
    if (completed >= commitment.weekly_target) continue;

    await appendEvent(client, {
      type: "commitment.missed",
      occurredAt: new Date(`${closedLogicalDay}T23:59:59.999Z`),
      domain: commitment.domain,
      subjectId: commitment.id,
      payload: { completed, target: commitment.weekly_target },
      idempotencyKey: `boundary:${commitment.id}:${closedLogicalDay}`,
    });
    missedCommitmentIds.push(commitment.id);
  }

  const rollup = await rebuildDailyRollup(client);

  return { closedLogicalDay, missedCommitmentIds, rollup };
}
