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

afterAll(async () => {
  if (hasDb) {
    await getPool().end();
  }
});
