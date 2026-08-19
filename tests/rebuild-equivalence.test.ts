/**
 * AGENTS.md testing requirement: dropping all rollups and recomputing from
 * events must produce identical state. Runs against a real database inside
 * a transaction that is always rolled back, so it never touches real data.
 *
 * Requires DATABASE_URL (see .env.local.example) and a migrated schema
 * (`npm run migrate`). Skipped automatically when DATABASE_URL is unset.
 */
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "../lib/db";
import { appendCorrection, appendEvent } from "../lib/events";
import { rebuildDailyRollup } from "../lib/rollup";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("rebuild equivalence", () => {
  it("recomputes identical daily_rollup state from events alone", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: new Date("2026-01-05T10:00:00-05:00"),
        domain: "body",
        payload: { tier: 1 },
      });
      await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: new Date("2026-01-05T20:00:00-05:00"),
        domain: "body",
        payload: { tier: 2 },
      });
      await appendEvent(client, {
        type: "app.opened",
        occurredAt: new Date("2026-01-06T09:00:00-05:00"),
      });
      await appendEvent(client, {
        type: "mark.recorded",
        occurredAt: new Date("2026-01-06T09:30:00-05:00"),
        domain: "career",
        payload: { note: "Shipped the thing." },
      });

      const first = await rebuildDailyRollup(client);
      const second = await rebuildDailyRollup(client);

      expect(second).toEqual(first);
      expect(first.length).toBeGreaterThan(0);

      const jan5 = first.find((row) => row.logicalDay === "2026-01-05");
      expect(jan5).toEqual({
        logicalDay: "2026-01-05",
        eventCount: 2,
        domainCounts: { body: 2 },
        instrumentationCount: 0,
      });

      const jan6 = first.find((row) => row.logicalDay === "2026-01-06");
      expect(jan6).toEqual({
        logicalDay: "2026-01-06",
        eventCount: 1,
        domainCounts: { career: 1 },
        instrumentationCount: 1,
      });

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("applies the latest correction instead of the original, without double-counting", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const original = await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: new Date("2026-02-10T10:00:00-05:00"),
        domain: "body",
        payload: { tier: 1 },
      });

      const beforeCorrection = await rebuildDailyRollup(client);
      const dayBefore = beforeCorrection.find((row) => row.logicalDay === "2026-02-10");
      expect(dayBefore).toEqual({
        logicalDay: "2026-02-10",
        eventCount: 1,
        domainCounts: { body: 1 },
        instrumentationCount: 0,
      });

      // Wrong domain logged; correct it. A second, earlier-timestamped
      // correction is also written to confirm the *latest* one wins.
      await appendCorrection(client, {
        correctsType: "commitment.completed",
        correctsEventId: original.id,
        domain: "mind",
        payload: { tier: 1 },
      });
      await appendCorrection(client, {
        correctsType: "commitment.completed",
        correctsEventId: original.id,
        domain: "career",
        payload: { tier: 1 },
      });

      const afterCorrection = await rebuildDailyRollup(client);
      const dayAfter = afterCorrection.find((row) => row.logicalDay === "2026-02-10");

      // One conduct event, under the latest correction's domain — never two.
      expect(dayAfter).toEqual({
        logicalDay: "2026-02-10",
        eventCount: 1,
        domainCounts: { career: 1 },
        instrumentationCount: 0,
      });

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

afterAll(async () => {
  if (hasDb) {
    await getPool().end();
  }
});
