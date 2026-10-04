/**
 * docs/milestone-6-spec.md — the Reference type on Marks. Same pattern as
 * tests/milestone-5-quests.test.ts: real database, one transaction per
 * test, always rolled back. Skipped automatically when DATABASE_URL is
 * unset.
 */
import { afterAll, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { getPool } from "../lib/db";
import { recordMark, recordRetroactiveMark, editMark, listRecentMarks } from "../lib/marks";
import { achieveOutcome, completeUndertaking, createUndertaking, recordOutcome } from "../lib/quests";
import { AUDIT_MIN_RETROACTIVE_MARKS } from "../lib/calibration";

const hasDb = Boolean(process.env.DATABASE_URL);

/** milestone-3-spec.md §3/§7: recordOutcome is gated on the retroactive-Marks minimum. */
async function clearOutcomeGate(client: PoolClient) {
  for (let i = 0; i < AUDIT_MIN_RETROACTIVE_MARKS; i++) {
    await recordRetroactiveMark(client, {
      domain: "career",
      occurredAt: new Date(`2020-01-0${i + 1}T10:00:00-05:00`),
      note: `Fixture mark ${i}.`,
    });
  }
}

describe.skipIf(!hasDb)("Reference (docs/milestone-6-spec.md)", () => {
  it("a Mark with no reference is Completed; one with a reference is Documented", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const plain = await recordMark(client, { domain: "attention", note: "Finished the draft." });
      const documented = await recordMark(client, {
        domain: "attention",
        note: "Shipped the pricing page.",
        reference: { label: "Pricing page", url: "https://example.com/pricing" },
      });

      const list = await listRecentMarks(client, 10);
      const plainRow = list.find((m) => m.id === plain.id);
      const documentedRow = list.find((m) => m.id === documented.id);

      expect(plainRow?.state).toBe("completed");
      expect(plainRow?.reference).toBeNull();

      expect(documentedRow?.state).toBe("documented");
      expect(documentedRow?.reference).toEqual({ label: "Pricing page", url: "https://example.com/pricing" });

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("editing a Mark to add a reference moves it from Completed to Documented", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const mark = await recordMark(client, { domain: "body", note: "Hit a new bench PR." });
      let list = await listRecentMarks(client, 10);
      expect(list.find((m) => m.id === mark.id)?.state).toBe("completed");

      await editMark(client, {
        markEventId: mark.id,
        reference: { label: "Training log", url: "https://example.com/log" },
      });

      list = await listRecentMarks(client, 10);
      const row = list.find((m) => m.id === mark.id);
      expect(row?.state).toBe("documented");
      expect(row?.reference).toEqual({ label: "Training log", url: "https://example.com/log" });
      // The note survives the correction untouched (appendCorrection merges forward).
      expect(row?.note).toBe("Hit a new bench PR.");

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("the database rejects a reference with only a label or only a url", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await expect(
        client.query(
          `INSERT INTO events (type, occurred_at, logical_day, timezone, domain, payload)
           VALUES ('mark.recorded', now(), '2026-01-01', 'UTC', 'career',
                   '{"note": "x", "reference": {"label": "only label"}}'::jsonb)`
        )
      ).rejects.toThrow();

      await expect(
        client.query(
          `INSERT INTO events (type, occurred_at, logical_day, timezone, domain, payload)
           VALUES ('mark.recorded', now(), '2026-01-01', 'UTC', 'career',
                   '{"note": "x", "reference": {"url": "https://example.com"}}'::jsonb)`
        )
      ).rejects.toThrow();

      await expect(
        client.query(
          `INSERT INTO events (type, occurred_at, logical_day, timezone, domain, payload)
           VALUES ('mark.recorded', now(), '2026-01-01', 'UTC', 'career',
                   '{"note": "x", "reference": {"label": "", "url": "https://example.com"}}'::jsonb)`
        )
      ).rejects.toThrow();

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("a well-formed reference is accepted at the database layer", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await expect(
        client.query(
          `INSERT INTO events (type, occurred_at, logical_day, timezone, domain, payload)
           VALUES ('mark.recorded', now(), '2026-01-01', 'UTC', 'career',
                   '{"note": "x", "reference": {"label": "Doc", "url": "https://example.com"}}'::jsonb)`
        )
      ).resolves.toBeDefined();

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("an Outcome achieved with a reference carries it onto the generated Mark", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await clearOutcomeGate(client);

      const created = await recordOutcome(client, { statement: "Build a stable, independent future." });
      const outcomeId = created.subjectId as string;

      await achieveOutcome(client, {
        outcomeId,
        domain: "career",
        note: "It happened.",
        reference: { label: "Announcement", url: "https://example.com/announcement" },
      });

      const list = await listRecentMarks(client, 10);
      const generated = list.find((m) => m.note === "It happened.");
      expect(generated?.state).toBe("documented");
      expect(generated?.reference).toEqual({ label: "Announcement", url: "https://example.com/announcement" });

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("completing an Undertaking without a note writes no Mark, so reference is moot", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const created = await createUndertaking(client, { statement: "Ship the v2 pricing page" });
      const undertakingId = created.subjectId as string;

      await completeUndertaking(client, { undertakingId, reference: { label: "Ignored", url: "https://example.com" } });

      const list = await listRecentMarks(client, 10);
      expect(list.some((m) => m.reference?.label === "Ignored")).toBe(false);

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });
});

afterAll(async () => {
  if (hasDb) {
    await getPool().end();
  }
});
