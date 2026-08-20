/**
 * DB-backed milestone-2-spec.md coverage: XP (§1), Condition (§4), domain
 * dormancy (§5), Identity (§7). Same pattern as
 * tests/rebuild-equivalence.test.ts — real database, transaction always
 * rolled back. Skipped automatically when DATABASE_URL is unset.
 */
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "../lib/db";
import { appendCorrection, appendEvent } from "../lib/events";
import { computeDomainXp } from "../lib/xp";
import { logCondition, getCondition } from "../lib/condition";
import { isDormant, lastConductLogicalDay } from "../lib/dormancy";
import { computeIdentity } from "../lib/identity";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("XP (milestone-2-spec.md §1)", () => {
  it("sums XP from commitment.completed and quest.step_completed only, applying corrections", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const commitmentEvent = await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: new Date("2026-04-01T10:00:00-05:00"),
        domain: "body",
        payload: { tier: 1 }, // 10 XP, will be corrected to tier 3 (50 XP)
      });
      // quest.step_completed also earns XP (milestone-2-spec.md §1), but
      // quests aren't a built feature yet (no correction type exists for
      // it), so only the correction path is exercised via commitment.completed.
      await appendEvent(client, {
        type: "quest.step_completed",
        occurredAt: new Date("2026-04-02T10:00:00-05:00"),
        domain: "body",
        payload: { tier: 2 }, // 25 XP
      });
      // Zero-XP events in the same domain must not contribute.
      await appendEvent(client, {
        type: "mark.recorded",
        occurredAt: new Date("2026-04-03T10:00:00-05:00"),
        domain: "body",
        payload: { note: "Should not add XP." },
      });
      await appendEvent(client, {
        type: "condition.logged",
        occurredAt: new Date("2026-04-04T10:00:00-05:00"),
        payload: { sleep: "normal", energy: "normal" },
      });
      // Self-instrumentation must never influence XP (milestone-2-spec.md
      // §1 / §8), even given a domain it would never realistically carry.
      await appendEvent(client, {
        type: "app.opened",
        occurredAt: new Date("2026-04-04T11:00:00-05:00"),
        domain: "body",
      });
      await appendCorrection(client, {
        correctsType: "commitment.completed",
        correctsEventId: commitmentEvent.id,
        payload: { tier: 3 },
      });

      const bodyXp = await computeDomainXp(client, "body");
      expect(bodyXp).toBe(50 + 25); // corrected tier 3 (not tier 1) + the quest step's tier 2

      const careerXp = await computeDomainXp(client, "career");
      expect(careerXp).toBe(0);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Condition (milestone-2-spec.md §4)", () => {
  it("a second write for the same logical day corrects the first instead of duplicating it", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const day = new Date("2026-04-05T10:00:00-05:00");
      await logCondition(client, { occurredAt: day, sleep: "short", energy: "low" });
      await logCondition(client, { occurredAt: day, sleep: "long", energy: "high" });

      const countResult = await client.query(
        `SELECT count(*)::int AS count FROM events WHERE type LIKE 'condition.logged%'`
      );
      expect(countResult.rows[0]?.count).toBe(2); // one original, one correction — never a second original

      const effective = await getCondition(client, "2026-04-05");
      expect(effective).toEqual({ sleep: "long", energy: "high" });

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("returns null for a day with no condition logged", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      expect(await getCondition(client, "2026-04-06")).toBeNull();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Domain dormancy (milestone-2-spec.md §5)", () => {
  it("a domain with no conduct in DOMAIN_DORMANCY_DAYS is dormant; a domain never touched is not", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: new Date("2026-01-01T10:00:00-05:00"),
        domain: "career",
        payload: { tier: 1 },
      });
      // Self-instrumentation must never count as conduct for dormancy
      // (milestone-2-spec.md §5 / §8), even on a much more recent day.
      await appendEvent(client, {
        type: "app.opened",
        occurredAt: new Date("2026-01-24T10:00:00-05:00"),
        domain: "career",
      });

      const lastCareer = await lastConductLogicalDay(client, "career");
      expect(lastCareer).toBe("2026-01-01"); // not 2026-01-24 — app.opened doesn't count
      expect(isDormant(lastCareer, "2026-01-25")).toBe(true); // 24 days later, >= 21
      expect(isDormant(lastCareer, "2026-01-15")).toBe(false); // 14 days later, < 21

      const neverTouched = await lastConductLogicalDay(client, "life");
      expect(neverTouched).toBeNull();
      expect(isDormant(neverTouched, "2026-06-01")).toBe(false); // never active != dormant

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Identity (milestone-2-spec.md §7)", () => {
  it("composes rank, per-domain levels, Marks count, and tenure", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const firstDay = new Date("2026-05-01T10:00:00-05:00");
      await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: firstDay,
        domain: "body",
        payload: { tier: 3 }, // 50 XP -> still level 1 (needs 100 for level 2)
      });
      await appendEvent(client, {
        type: "mark.recorded",
        occurredAt: new Date("2026-05-02T10:00:00-05:00"),
        domain: "career",
        payload: { note: "First mark." },
      });
      await appendEvent(client, {
        type: "mark.recorded",
        occurredAt: new Date("2026-05-03T10:00:00-05:00"),
        domain: "career",
        payload: { note: "Second mark." },
      });

      const identity = await computeIdentity(client, new Date("2026-05-10T00:00:00-05:00"));

      expect(identity.rank).toBe("E");
      expect(identity.domainLevels).toEqual({ career: 1, body: 1, attention: 1 });
      expect(identity.marksCount).toBe(2);
      expect(identity.tenureDays).toBe(10); // May 1 through May 10 inclusive

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
