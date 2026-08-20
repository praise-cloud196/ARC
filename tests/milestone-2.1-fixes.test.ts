/**
 * docs/milestone-2.1-fixes.md items 1 and 2. Same pattern as
 * tests/character-model.test.ts — real database, transaction always rolled
 * back. Skipped automatically when DATABASE_URL is unset.
 */
import { describe, expect, it } from "vitest";
import { getPool } from "../lib/db";
import { appendCorrection, appendEvent } from "../lib/events";
import { computeDomainLevel, computeDomainXp } from "../lib/xp";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Domain level high-water mark (milestone-2.1-fixes.md item 1)", () => {
  it("a downward correction reduces current XP but does not reduce level", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Five tier-3 completions (50 XP each) = 250 XP = exactly
      // xpToReachLevel(3) -> level 3.
      const days = ["01", "02", "03", "04", "05"];
      const first = await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: new Date(`2026-06-${days[0]}T10:00:00-05:00`),
        domain: "career",
        payload: { tier: 3 },
      });
      for (const day of days.slice(1)) {
        await appendEvent(client, {
          type: "commitment.completed",
          occurredAt: new Date(`2026-06-${day}T10:00:00-05:00`),
          domain: "career",
          payload: { tier: 3 },
        });
      }

      expect(await computeDomainXp(client, "career")).toBe(250);
      expect(await computeDomainLevel(client, "career")).toBe(3);

      // Correct the first completion down to tier 1 (10 XP): total drops to
      // 210, which alone only implies level 2 — but the level must not fall,
      // because the log genuinely reached 250 XP before this correction was
      // recorded (AGENTS.md hard rule 12).
      await appendCorrection(client, {
        correctsType: "commitment.completed",
        correctsEventId: first.id,
        payload: { tier: 1 },
      });

      expect(await computeDomainXp(client, "career")).toBe(210);
      expect(await computeDomainLevel(client, "career")).toBe(3);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("a domain that never reached a level stays at the level its current total implies", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: new Date("2026-06-01T10:00:00-05:00"),
        domain: "body",
        payload: { tier: 1 }, // 10 XP, well under the 100 needed for level 2
      });
      expect(await computeDomainLevel(client, "body")).toBe(1);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Tier validated at write time, not read time (milestone-2.1-fixes.md item 2)", () => {
  it("rejects a commitment.completed event with an out-of-range tier", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(
        appendEvent(client, {
          type: "commitment.completed",
          occurredAt: new Date("2026-06-10T10:00:00-05:00"),
          domain: "career",
          payload: { tier: 4 },
        })
      ).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("rejects a commitment.completed event with no tier at all", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(
        appendEvent(client, {
          type: "commitment.completed",
          occurredAt: new Date("2026-06-11T10:00:00-05:00"),
          domain: "career",
          payload: {},
        })
      ).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("rejects a quest.step_completed event with an invalid tier", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(
        appendEvent(client, {
          type: "quest.step_completed",
          occurredAt: new Date("2026-06-12T10:00:00-05:00"),
          domain: "career",
          payload: { tier: "three" },
        })
      ).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("still allows a valid tier through unchanged", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const event = await appendEvent(client, {
        type: "commitment.completed",
        occurredAt: new Date("2026-06-13T10:00:00-05:00"),
        domain: "career",
        payload: { tier: 2 },
      });
      expect(event.payload.tier).toBe(2);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
