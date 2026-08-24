/**
 * docs/design-revision-v2.md §7 — completion has no undo. Same pattern as
 * tests/milestone-4-loop.test.ts — real database, transaction always
 * rolled back. Skipped automatically when DATABASE_URL is unset.
 */
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "../lib/db";
import {
  completeCommitment,
  computeCurrentMomentum,
  countCompletions,
  declareCommitment,
  voidCommitmentCompletion,
} from "../lib/commitments";
import { computeDomainXp, computeDomainLevel } from "../lib/xp";
import { lastConductLogicalDay } from "../lib/dormancy";
import { computeNightlyReportData } from "../lib/loop";
import { startOfWeek } from "../lib/day-math";
import { recordMetric, editMetric, voidMetric, listRecentMetrics } from "../lib/metrics";
import { recordMark, editMark, voidMark, listRecentMarks } from "../lib/marks";
import { recordNote, editNote, voidNote, domainsWithNotes } from "../lib/notes";
import { computeIdentity } from "../lib/identity";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Voiding a completion (design-revision-v2.md §7)", () => {
  it("the original event is never removed; the correction carries payload.voided = true", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = startOfWeek("2026-06-01");
      const commitment = await declareCommitment(client, {
        domain: "body",
        label: "Train",
        tier: 1,
        weeklyTarget: 2,
        weekStart,
      });
      const now = new Date(`${weekStart}T10:00:00-05:00`);
      const completion = await completeCommitment(client, { commitmentId: commitment.id, occurredAt: now });

      const voided = await voidCommitmentCompletion(client, { completionEventId: completion.id, occurredAt: now });
      expect(voided.type).toBe("commitment.completed.corrected");
      expect(voided.payload.voided).toBe(true);
      expect(voided.payload.tier).toBe(1); // merged forward from the original, untouched

      const stillThere = await client.query(`SELECT id, type FROM events WHERE id = $1`, [completion.id]);
      expect(stillThere.rows).toHaveLength(1);
      expect(stillThere.rows[0]?.type).toBe("commitment.completed");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("rejects voiding a completion after its own logical day has passed", async () => {
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
      const completedAt = new Date(`${weekStart}T10:00:00-05:00`);
      const completion = await completeCommitment(client, { commitmentId: commitment.id, occurredAt: completedAt });

      const twoDaysLater = new Date(completedAt.getTime() + 2 * 86400000);
      await expect(
        voidCommitmentCompletion(client, { completionEventId: completion.id, occurredAt: twoDaysLater })
      ).rejects.toThrow(/only be undone on the day it happened/);

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("the database rejects a malformed `voided` value", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = startOfWeek("2026-06-01");
      const commitment = await declareCommitment(client, {
        domain: "attention",
        label: "Write",
        tier: 1,
        weeklyTarget: 1,
        weekStart,
      });
      const completion = await completeCommitment(client, {
        commitmentId: commitment.id,
        occurredAt: new Date(`${weekStart}T10:00:00-05:00`),
      });

      await expect(
        client.query(
          `INSERT INTO events (type, occurred_at, logical_day, timezone, domain, subject_id, payload)
           VALUES ('commitment.completed.corrected', now(), $1, 'UTC', 'attention', $2, '{"tier": 1, "voided": false}'::jsonb)`,
          [weekStart, completion.id]
        )
      ).rejects.toThrow();

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("complete, void: XP and momentum are unchanged from before the completion", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = startOfWeek("2026-06-01");
      const commitment = await declareCommitment(client, {
        domain: "body",
        label: "Train",
        tier: 2,
        weeklyTarget: 3,
        weekStart,
      });
      const asOf = weekStart;

      const xpBefore = await computeDomainXp(client, "body");
      const levelBefore = await computeDomainLevel(client, "body");
      const momentumBefore = await computeCurrentMomentum(client, asOf);

      const completion = await completeCommitment(client, {
        commitmentId: commitment.id,
        occurredAt: new Date(`${weekStart}T10:00:00-05:00`),
      });
      // Sanity: the completion really did move XP before voiding it.
      expect(await computeDomainXp(client, "body")).toBeGreaterThan(xpBefore);

      await voidCommitmentCompletion(client, {
        completionEventId: completion.id,
        occurredAt: new Date(`${weekStart}T11:00:00-05:00`),
      });

      expect(await computeDomainXp(client, "body")).toBe(xpBefore);
      expect(await computeDomainLevel(client, "body")).toBe(levelBefore);

      const momentumAfter = await computeCurrentMomentum(client, asOf);
      expect(momentumAfter).toEqual(momentumBefore);

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("does not count toward the weekly target (countCompletions), so a mis-tap can't satisfy it", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = startOfWeek("2026-06-01");
      const commitment = await declareCommitment(client, {
        domain: "career",
        label: "Outbound contact",
        tier: 1,
        weeklyTarget: 1,
        weekStart,
      });
      const completion = await completeCommitment(client, {
        commitmentId: commitment.id,
        occurredAt: new Date(`${weekStart}T10:00:00-05:00`),
      });
      expect(await countCompletions(client, commitment.id)).toBe(1);

      await voidCommitmentCompletion(client, {
        completionEventId: completion.id,
        occurredAt: new Date(`${weekStart}T11:00:00-05:00`),
      });
      expect(await countCompletions(client, commitment.id)).toBe(0);

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("does not appear in the nightly report's completed/XP data", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = startOfWeek("2026-06-01");
      const commitment = await declareCommitment(client, {
        domain: "body",
        label: "Train",
        tier: 2,
        weeklyTarget: 3,
        weekStart,
      });
      const now = new Date(`${weekStart}T10:00:00-05:00`);
      const completion = await completeCommitment(client, { commitmentId: commitment.id, occurredAt: now });
      await voidCommitmentCompletion(client, { completionEventId: completion.id, occurredAt: now });

      const report = await computeNightlyReportData(client, now);
      expect(report.completedTodayIds).not.toContain(commitment.id);
      expect(report.xpEarnedToday.body ?? 0).toBe(0);

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("does not count as conduct for domain dormancy", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const weekStart = startOfWeek("2026-06-01");
      const commitment = await declareCommitment(client, {
        domain: "attention",
        label: "Write",
        tier: 1,
        weeklyTarget: 1,
        weekStart,
      });
      const before = await lastConductLogicalDay(client, "attention");

      const now = new Date(`${weekStart}T10:00:00-05:00`);
      const completion = await completeCommitment(client, { commitmentId: commitment.id, occurredAt: now });
      await voidCommitmentCompletion(client, { completionEventId: completion.id, occurredAt: now });

      expect(await lastConductLogicalDay(client, "attention")).toBe(before);

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Records are correctable and voidable at any time (design-revision-v2.md §7.1)", () => {
  it("editing a metric: the latest value is read, and the original is retained in events", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const recorded = await recordMetric(client, { domain: "body", metric: "weight", value: 82, unit: "kg" });

      const corrected = await editMetric(client, { metricEventId: recorded.id, value: 81.5 });
      expect(corrected.type).toBe("metric.recorded.corrected");
      expect(corrected.payload).toEqual({ metric: "weight", value: 81.5, unit: "kg" });

      const list = await listRecentMetrics(client, 10);
      const latest = list.find((m) => m.id === recorded.id);
      expect(latest?.value).toBe(81.5);

      const original = await client.query(`SELECT payload FROM events WHERE id = $1`, [recorded.id]);
      expect(original.rows[0]?.payload).toEqual({ metric: "weight", value: 82, unit: "kg" });

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("voiding a metric: it disappears from the list and remains in events; editing it afterward is still allowed (any time)", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const recorded = await recordMetric(client, { domain: "body", metric: "weight", value: 82, unit: "kg" });

      let list = await listRecentMetrics(client, 10);
      expect(list.some((m) => m.id === recorded.id)).toBe(true);

      await voidMetric(client, { metricEventId: recorded.id });

      list = await listRecentMetrics(client, 10);
      expect(list.some((m) => m.id === recorded.id)).toBe(false);

      const withWithdrawn = await listRecentMetrics(client, 10, true);
      const voided = withWithdrawn.find((m) => m.id === recorded.id);
      expect(voided?.voided).toBe(true);

      const original = await client.query(`SELECT id FROM events WHERE id = $1`, [recorded.id]);
      expect(original.rows).toHaveLength(1);

      // Old day is irrelevant for records — a metric recorded long ago is
      // still editable/voidable right now, unlike a completion.
      const old = await recordMetric(client, {
        domain: "career",
        metric: "hours",
        value: 3,
        unit: "h",
        occurredAt: new Date("2020-01-01T10:00:00-05:00"),
      });
      await expect(editMetric(client, { metricEventId: old.id, value: 4 })).resolves.toBeDefined();
      await expect(voidMetric(client, { metricEventId: old.id })).resolves.toBeDefined();

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("voiding a Mark excludes it from the character sheet's Marks count", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const mark = await recordMark(client, { domain: "attention", note: "Finished the draft." });
      const before = await computeIdentity(client);

      await voidMark(client, { markEventId: mark.id });
      const after = await computeIdentity(client);

      expect(after.marksCount).toBe(before.marksCount - 1);

      const list = await listRecentMarks(client, 10);
      expect(list.some((m) => m.id === mark.id)).toBe(false);
      const withWithdrawn = await listRecentMarks(client, 10, true);
      expect(withWithdrawn.find((m) => m.id === mark.id)?.voided).toBe(true);

      const editedAfterVoid = await editMark(client, { markEventId: mark.id, note: "Edited after withdrawal." });
      expect(editedAfterVoid.payload.voided).toBe(true); // still withdrawn — editing doesn't un-void it
      expect(editedAfterVoid.payload.note).toBe("Edited after withdrawal.");

      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("a domain whose only note is voided goes back to having none", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const note = await recordNote(client, { domain: "life", note: "Good, actually." });
      expect(await domainsWithNotes(client)).toContain("life");

      await voidNote(client, { noteEventId: note.id });
      expect(await domainsWithNotes(client)).not.toContain("life");

      await editNote(client, { noteEventId: note.id, note: "Corrected note text." });
      // Editing doesn't revive a withdrawn note as far as domain completeness goes.
      expect(await domainsWithNotes(client)).not.toContain("life");

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
