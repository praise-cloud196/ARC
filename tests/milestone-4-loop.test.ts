/**
 * docs/milestone-4-spec.md. Same pattern as tests/character-model.test.ts —
 * real database, transaction always rolled back. Skipped automatically when
 * DATABASE_URL is unset.
 */
import { afterAll, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { getPool } from "../lib/db";
import { appendEvent } from "../lib/events";
import { computeIdentity } from "../lib/identity";
import { completeAudit } from "../lib/audit";
import { recordRetroactiveMark } from "../lib/marks";
import {
  completeCommitment,
  countCompletions,
  declareCommitment,
  patchCommitmentCompletion,
} from "../lib/commitments";
import { runBoundaryJob } from "../lib/boundary-job";
import { selectLoopState } from "../lib/loop";
import { startOfWeek } from "../lib/day-math";

const hasDb = Boolean(process.env.DATABASE_URL);

/** Counts calls to client.query for the duration of `fn`, restoring the original method after. */
async function countQueries(client: PoolClient, fn: () => Promise<void>): Promise<number> {
  const original = client.query.bind(client);
  let count = 0;
  // Test-only instrumentation: client.query is heavily overloaded, hence the cast.
  (client as unknown as { query: unknown }).query = (...args: Parameters<typeof original>) => {
    count += 1;
    return (original as (...a: Parameters<typeof original>) => unknown)(...args);
  };
  try {
    await fn();
  } finally {
    client.query = original;
  }
  return count;
}

describe.skipIf(!hasDb)("computeIdentity issues one query per call (milestone-4-spec.md §1)", () => {
  it("stays at exactly one query with a rich, multi-domain event log", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Enough data to exercise every branch computeIdentity touches: three
      // scored domains' worth of completions and a correction (levels),
      // several Marks including a retroactive one (marks count, tenure
      // exclusion), and a completed audit (rank).
      for (let i = 0; i < 6; i++) {
        await appendEvent(client, {
          type: "commitment.completed",
          occurredAt: new Date(`2026-05-0${(i % 9) + 1}T10:00:00-05:00`),
          domain: (["career", "body", "attention"] as const)[i % 3],
          payload: { tier: 2 },
        });
      }
      await recordRetroactiveMark(client, {
        domain: "career",
        occurredAt: new Date("2020-01-01T10:00:00-05:00"),
        note: "Old achievement.",
      });
      await recordRetroactiveMark(client, {
        domain: "body",
        occurredAt: new Date("2020-01-02T10:00:00-05:00"),
        note: "Another one.",
      });
      await recordRetroactiveMark(client, {
        domain: "attention",
        occurredAt: new Date("2020-01-03T10:00:00-05:00"),
        note: "A third.",
      });
      await completeAudit(client, { startingRank: "E", occurredAt: new Date("2026-05-01T09:00:00-05:00") });

      const asOf = new Date("2026-05-10T00:00:00-05:00");
      let identity: Awaited<ReturnType<typeof computeIdentity>> | undefined;
      const queryCount = await countQueries(client, async () => {
        identity = await computeIdentity(client, asOf);
      });

      expect(queryCount).toBe(1);
      expect(identity).toBeDefined();
      expect(identity!.marksCount).toBe(3);
      expect(identity!.domainLevels.career).toBeGreaterThanOrEqual(1);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Commitments (milestone-4-spec.md §3)", () => {
  it("completes a commitment, then patches resistance and a note via correction", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = startOfWeek("2026-06-01"); // a Monday
      const commitment = await declareCommitment(client, {
        domain: "body",
        label: "Train",
        tier: 2,
        weeklyTarget: 3,
        weekStart,
      });

      const completion = await completeCommitment(client, {
        commitmentId: commitment.id,
        occurredAt: new Date(`${weekStart}T10:00:00-05:00`),
      });
      expect(completion.payload).toEqual({ tier: 2 });
      expect(completion.payload.resistance).toBeUndefined();

      const patched = await patchCommitmentCompletion(client, {
        completionEventId: completion.id,
        resistance: "against_resistance",
        note: "Harder than expected.",
      });
      expect(patched.payload).toEqual({
        tier: 2,
        resistance: "against_resistance",
        note: "Harder than expected.",
      });

      expect(await countCompletions(client, commitment.id)).toBe(1);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("rejects an invalid resistance value at write time", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = startOfWeek("2026-06-01");
      const commitment = await declareCommitment(client, {
        domain: "career",
        label: "Ship it",
        tier: 1,
        weeklyTarget: 1,
        weekStart,
      });
      const completion = await completeCommitment(client, { commitmentId: commitment.id });
      await expect(
        patchCommitmentCompletion(client, { completionEventId: completion.id, resistance: "extreme" as never })
      ).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Weekly lock, enforced at the data layer (milestone-4-spec.md §3)", () => {
  it("rejects a raw UPDATE to declaration fields for the commitment's current week", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // The trigger compares against date_trunc('week', CURRENT_DATE) in
      // the database's own session time, so week_start must be computed
      // the same way for this test to reliably land "this week".
      const currentWeekResult = await client.query<{ week_start: string }>(
        `SELECT date_trunc('week', CURRENT_DATE)::date AS week_start`
      );
      const weekStart = currentWeekResult.rows[0]?.week_start;
      if (!weekStart) throw new Error("Could not determine current week.");

      const commitment = await declareCommitment(client, {
        domain: "attention",
        label: "Original label",
        tier: 1,
        weeklyTarget: 2,
        weekStart,
      });

      // A failed statement aborts the whole transaction until ROLLBACK, so
      // the expected-to-fail UPDATE runs inside its own SAVEPOINT — that
      // way the transaction is still usable for the assertion afterward.
      await client.query("SAVEPOINT before_bad_update");
      await expect(
        client.query(`UPDATE commitments SET label = 'Changed label' WHERE id = $1`, [commitment.id])
      ).rejects.toThrow();
      await client.query("ROLLBACK TO SAVEPOINT before_bad_update");

      // A field the trigger doesn't protect stays editable even this week.
      await expect(
        client.query(`UPDATE commitments SET active_until = active_until WHERE id = $1`, [commitment.id])
      ).resolves.toBeDefined();
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("allows editing declaration fields for a commitment whose week is not current", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const pastWeekStart = "2020-01-06"; // a long-past Monday
      const commitment = await declareCommitment(client, {
        domain: "career",
        label: "Old label",
        tier: 1,
        weeklyTarget: 1,
        weekStart: pastWeekStart,
      });

      await expect(
        client.query(`UPDATE commitments SET label = 'New label' WHERE id = $1`, [commitment.id])
      ).resolves.toBeDefined();
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Boundary job (milestone-4-spec.md §6)", () => {
  // 45s, not the file default 20s: this test drives 9 sequential
  // runBoundaryJob calls (each several round trips) against a remote Neon
  // database to simulate a full week — genuinely more round trips than the
  // rest of the suite, not a flaky test.
  it("writes commitment.missed only for commitments that fell short, across a simulated week", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = "2026-07-06"; // a Monday
      const met = await declareCommitment(client, {
        domain: "body",
        label: "Met target",
        tier: 1,
        weeklyTarget: 2,
        weekStart,
      });
      const missed = await declareCommitment(client, {
        domain: "career",
        label: "Missed target",
        tier: 1,
        weeklyTarget: 3,
        weekStart,
      });

      // "met" completed twice (meets its target of 2); "missed" completed once (short of 3).
      await completeCommitment(client, { commitmentId: met.id, occurredAt: new Date(`${weekStart}T10:00:00-05:00`) });
      await completeCommitment(client, {
        commitmentId: met.id,
        occurredAt: new Date("2026-07-08T10:00:00-05:00"),
      });
      await completeCommitment(client, {
        commitmentId: missed.id,
        occurredAt: new Date("2026-07-07T10:00:00-05:00"),
      });

      // Simulate the boundary crossing for each of the week's 7 days; only
      // the day after the week's last day (active_until = 2026-07-12)
      // should evaluate and write anything.
      let allMissed: string[] = [];
      for (let i = 0; i < 8; i++) {
        const asOf = `2026-07-${String(6 + i).padStart(2, "0")}`;
        const result = await runBoundaryJob(client, asOf);
        allMissed = allMissed.concat(result.missedCommitmentIds);
      }

      expect(allMissed).toEqual([missed.id]);

      const missedEvents = await client.query(`SELECT subject_id, payload FROM events WHERE type = 'commitment.missed'`);
      expect(missedEvents.rows).toHaveLength(1);
      expect(missedEvents.rows[0]?.subject_id).toBe(missed.id);
      expect(missedEvents.rows[0]?.payload).toEqual({ completed: 1, target: 3 });

      // Re-running the boundary job for the same closing day re-detects the
      // same under-target commitment (that's expected — it's still under
      // target), but the idempotency key means no *duplicate row* gets
      // written. That's the actual invariant: one commitment.missed event
      // per commitment per week, no matter how many times the job runs.
      const rerun = await runBoundaryJob(client, "2026-07-13");
      expect(rerun.missedCommitmentIds).toEqual([missed.id]);
      const missedEventsAfterRerun = await client.query(`SELECT count(*)::int AS count FROM events WHERE type = 'commitment.missed'`);
      expect(missedEventsAfterRerun.rows[0]?.count).toBe(1);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  }, 45000);
});

describe("Today's state selection (milestone-4-spec.md §5)", () => {
  it("selects morning, day, and night by clock hour relative to the boundary and display hour", () => {
    const tz = "UTC";
    const displayHour = 20;
    expect(selectLoopState(new Date("2026-01-01T05:00:00Z"), tz, displayHour)).toBe("night"); // before boundary
    expect(selectLoopState(new Date("2026-01-01T06:30:00Z"), tz, displayHour)).toBe("morning");
    expect(selectLoopState(new Date("2026-01-01T12:00:00Z"), tz, displayHour)).toBe("day");
    expect(selectLoopState(new Date("2026-01-01T21:00:00Z"), tz, displayHour)).toBe("night");
  });
});

afterAll(async () => {
  if (hasDb) {
    await getPool().end();
  }
});
