/**
 * Catch-up logging: completions can be logged/withdrawn for the last
 * CATCHUP_WINDOW_DAYS logical days. Real database, transaction always
 * rolled back; skipped when DATABASE_URL is unset.
 */
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "../lib/db";
import { completeCommitment, countCompletions, declareCommitment, voidCommitmentCompletion } from "../lib/commitments";
import { computeLogicalDay, getTimezone, instantInLogicalDay } from "../lib/logical-day";
import { addDays, startOfWeek } from "../lib/day-math";
import { CATCHUP_WINDOW_DAYS } from "../lib/calibration";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Catch-up logging", () => {
  it("instantInLogicalDay lands inside the requested logical day", () => {
    const tz = getTimezone();
    for (const day of ["2026-01-05", "2026-03-29", "2026-10-25"]) {
      expect(computeLogicalDay(instantInLogicalDay(day, tz), tz)).toBe(day);
    }
  });

  it("logs a completion onto an earlier day, recorded now, and it counts", async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const today = computeLogicalDay(new Date());
      const yesterday = addDays(today, -1);
      const c = await declareCommitment(client, {
        domain: "body", label: "Train", tier: 1, weeklyTarget: 1, weekStart: startOfWeek(yesterday),
      });

      const event = await completeCommitment(client, { commitmentId: c.id, logicalDay: yesterday });
      expect(event.logicalDay).toBe(yesterday);
      expect(event.recordedAt.getTime()).toBeGreaterThan(event.occurredAt.getTime());
      expect(await countCompletions(client, c.id)).toBe(1);

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("rejects days beyond the window, in the future, or outside the commitment's week", async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const today = computeLogicalDay(new Date());
      const c = await declareCommitment(client, {
        domain: "career", label: "Deep work", tier: 2, weeklyTarget: 1, weekStart: startOfWeek(today),
      });

      await expect(
        completeCommitment(client, { commitmentId: c.id, logicalDay: addDays(today, -(CATCHUP_WINDOW_DAYS + 1)) })
      ).rejects.toThrow(/catch-up window/);
      await expect(completeCommitment(client, { commitmentId: c.id, logicalDay: addDays(today, 1) })).rejects.toThrow(
        /catch-up window/
      );

      // Same week's commitment, but a day in the previous week (inside the window only if today is early in the week).
      const lastWeekDay = addDays(startOfWeek(today), -1);
      await expect(completeCommitment(client, { commitmentId: c.id, logicalDay: lastWeekDay })).rejects.toThrow(
        /outside this commitment's week|catch-up window/
      );

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("a catch-up completion can be withdrawn while its day is in the window", async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const today = computeLogicalDay(new Date());
      const yesterday = addDays(today, -1);
      const c = await declareCommitment(client, {
        domain: "attention", label: "Write", tier: 1, weeklyTarget: 1, weekStart: startOfWeek(yesterday),
      });
      const event = await completeCommitment(client, { commitmentId: c.id, logicalDay: yesterday });

      await voidCommitmentCompletion(client, { completionEventId: event.id });
      expect(await countCompletions(client, c.id)).toBe(0);

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });
});

afterAll(async () => {
  if (hasDb) await getPool().end();
});
