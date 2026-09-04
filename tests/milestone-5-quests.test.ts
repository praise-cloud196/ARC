/**
 * docs/milestone-5-spec.md. Same pattern as tests/milestone-4-loop.test.ts —
 * real database, one transaction per test, always rolled back. Skipped
 * automatically when DATABASE_URL is unset.
 */
import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { getPool } from "../lib/db";
import {
  abandonQuest,
  achieveOutcome,
  addUndertakingStep,
  completeUndertaking,
  createProbe,
  createUndertaking,
  listProbesAwaitingResolution,
  listUndertakings,
  recordOutcome,
  resolveProbe,
  voidUndertakingStep,
} from "../lib/quests";
import { recordRetroactiveMark } from "../lib/marks";
import { computeDomainXp } from "../lib/xp";
import { AUDIT_MIN_RETROACTIVE_MARKS } from "../lib/calibration";

const hasDb = Boolean(process.env.DATABASE_URL);

/** milestone-3-spec.md §3/§7: recordOutcome (and therefore any Outcome-dependent fixture) is gated on the retroactive-Marks minimum. */
async function clearOutcomeGate(client: PoolClient) {
  for (let i = 0; i < AUDIT_MIN_RETROACTIVE_MARKS; i++) {
    await recordRetroactiveMark(client, {
      domain: "career",
      occurredAt: new Date(`2020-01-0${i + 1}T10:00:00-05:00`),
      note: `Fixture mark ${i}.`,
    });
  }
}

describe.skipIf(!hasDb)("Undertakings (milestone-5-spec.md §3)", () => {
  it("creates, adds steps (awarding career XP), and completes with an optional Mark", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const created = await createUndertaking(client, { statement: "Ship the v2 pricing page" });
      expect(created.payload).toEqual({ kind: "undertaking", statement: "Ship the v2 pricing page" });
      expect(created.domain).toBe("career");

      const undertakingId = created.subjectId as string;
      const before = await computeDomainXp(client, "career");

      const step1 = await addUndertakingStep(client, { undertakingId, tier: 2 });
      const step2 = await addUndertakingStep(client, { undertakingId, tier: 1 });
      expect(step1.domain).toBe("career");

      const after = await computeDomainXp(client, "career");
      expect(after - before).toBe(25 + 10); // XP_TIER_VALUES[2] + XP_TIER_VALUES[1]

      const listed = await listUndertakings(client);
      const row = listed.find((u) => u.id === undertakingId);
      expect(row?.stepCount).toBe(2);
      expect(row?.status).toBe("active");

      // Void one step (same-day) and confirm the count and XP both drop.
      await voidUndertakingStep(client, { stepEventId: step2.id });
      const afterVoid = await computeDomainXp(client, "career");
      expect(afterVoid).toBe(before + 25);
      const listedAfterVoid = await listUndertakings(client);
      expect(listedAfterVoid.find((u) => u.id === undertakingId)?.stepCount).toBe(1);

      await completeUndertaking(client, {
        undertakingId,
        note: "The whole flow finally reads clearly.",
      });
      const completed = await listUndertakings(client);
      expect(completed.find((u) => u.id === undertakingId)?.status).toBe("completed");

      // Cannot add a step to a completed Undertaking.
      await expect(addUndertakingStep(client, { undertakingId, tier: 1 })).rejects.toThrow();

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("rejects a 4th active Undertaking (milestone-5-spec.md §1, PRD §13: max 3)", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await createUndertaking(client, { statement: "One" });
      await createUndertaking(client, { statement: "Two" });
      await createUndertaking(client, { statement: "Three" });
      await expect(createUndertaking(client, { statement: "Four" })).rejects.toThrow();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Probes (milestone-5-spec.md §4)", () => {
  it("requires decision date and signal, and rejects a 3rd active Probe (max 2)", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await createProbe(client, { statement: "One", decisionDate: "2026-09-01", signal: "reply rate" });
      await createProbe(client, { statement: "Two", decisionDate: "2026-09-15", signal: "interviews booked" });
      await expect(
        createProbe(client, { statement: "Three", decisionDate: "2026-10-01", signal: "offers" })
      ).rejects.toThrow();
      await expect(createProbe(client, { statement: "No signal", decisionDate: "2026-09-01", signal: "" })).rejects.toThrow();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("surfaces a Probe past its decision date, and stops once resolved", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const created = await createProbe(client, {
        statement: "Cold outbound to founders",
        decisionDate: "2026-08-01",
        signal: "3+ real conversations",
      });
      const probeId = created.subjectId as string;

      const awaiting = await listProbesAwaitingResolution(client, "2026-08-10");
      expect(awaiting.map((p) => p.id)).toContain(probeId);
      expect(await listProbesAwaitingResolution(client, "2026-07-31")).toHaveLength(0); // before decision date

      await resolveProbe(client, { probeId, action: "double_down", occurredAt: new Date("2026-08-10T10:00:00-05:00") });
      expect(await listProbesAwaitingResolution(client, "2026-08-10")).toHaveLength(0);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("fold requires a note, is never a failure state, and is terminal", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const created = await createProbe(client, { statement: "Fold me", decisionDate: "2026-08-01", signal: "x" });
      const probeId = created.subjectId as string;

      await expect(resolveProbe(client, { probeId, action: "fold" })).rejects.toThrow();

      const resolved = await resolveProbe(client, {
        probeId,
        action: "fold",
        note: "The market wasn't there.",
      });
      expect(resolved.payload).toEqual({ action: "fold", note: "The market wasn't there." });

      await expect(resolveProbe(client, { probeId, action: "double_down" })).rejects.toThrow(); // no longer active

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("extend moves the decision date forward and is rejected the second time", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const created = await createProbe(client, { statement: "Extend me", decisionDate: "2026-08-01", signal: "x" });
      const probeId = created.subjectId as string;

      await resolveProbe(client, { probeId, action: "extend", newDecisionDate: "2026-09-01" });
      expect(await listProbesAwaitingResolution(client, "2026-08-15")).toHaveLength(0); // extended past this date
      expect((await listProbesAwaitingResolution(client, "2026-09-05")).map((p) => p.id)).toContain(probeId);

      await expect(
        resolveProbe(client, { probeId, action: "extend", newDecisionDate: "2026-10-01" })
      ).rejects.toThrow(); // extend permitted once only

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Outcomes and generic abandonment (milestone-5-spec.md §5)", () => {
  it("achieving an Outcome always produces a Mark", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await clearOutcomeGate(client);
      const created = await recordOutcome(client, { statement: "A stable, independent future." });
      const outcomeId = created.subjectId as string;

      const marksBefore = await client.query(`SELECT count(*)::int AS n FROM events WHERE type = 'mark.recorded'`);
      await achieveOutcome(client, {
        outcomeId,
        domain: "career",
        note: "Landed the role that made this true.",
      });
      const marksAfter = await client.query(`SELECT count(*)::int AS n FROM events WHERE type = 'mark.recorded'`);
      expect(marksAfter.rows[0].n).toBe(marksBefore.rows[0].n + 1);

      const sourced = await client.query(
        `SELECT payload FROM events WHERE type = 'mark.recorded' ORDER BY recorded_at DESC LIMIT 1`
      );
      expect(sourced.rows[0].payload.sourceQuestId).toBe(outcomeId);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("abandonQuest works across kinds and never removes the row", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const undertaking = await createUndertaking(client, { statement: "Abandon me" });
      const questId = undertaking.subjectId as string;

      await abandonQuest(client, { questId, note: "No longer the priority." });
      const row = await client.query(`SELECT status FROM quests WHERE id = $1`, [questId]);
      expect(row.rows[0].status).toBe("abandoned");

      await expect(abandonQuest(client, { questId })).rejects.toThrow(); // already terminal

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
