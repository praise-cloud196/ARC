/**
 * docs/milestone-3-spec.md §1-7 (backend layer only — no wizard UI exists
 * yet). Same pattern as tests/character-model.test.ts — real database,
 * transaction always rolled back. Skipped automatically when DATABASE_URL
 * is unset.
 */
import { describe, expect, it } from "vitest";
import { getPool } from "../lib/db";
import { appendEvent } from "../lib/events";
import { recordNote } from "../lib/notes";
import { recordMetric } from "../lib/metrics";
import { recordRetroactiveMark, retroactiveMarkStats } from "../lib/marks";
import { getActiveStances, getAllStancesForManagement, setStance } from "../lib/stances";
import { listOutcomes, recordOutcome } from "../lib/quests";
import { openSeason } from "../lib/seasons";
import { completeAudit, getAuditProgress, isDomainSelfAssessmentComplete } from "../lib/audit";
import { computeProposedStartingRank, getCurrentRank } from "../lib/rank";
import { computeIdentity } from "../lib/identity";
import { computeMomentum, MOMENTUM_CONDUCT_EVENT_TYPES } from "../lib/momentum";
import { DOMAINS, type Domain } from "../lib/domains";
import { AUDIT_MIN_RETROACTIVE_MARKS } from "../lib/calibration";

const hasDb = Boolean(process.env.DATABASE_URL);

/** Logs exactly AUDIT_MIN_RETROACTIVE_MARKS retroactive Marks across `domains` (cycled). */
async function seedMinimumMarks(client: import("pg").PoolClient, domains: readonly Domain[]): Promise<void> {
  for (let i = 0; i < AUDIT_MIN_RETROACTIVE_MARKS; i++) {
    const domain = domains[i % domains.length];
    if (!domain) throw new Error("domains must be non-empty");
    await recordRetroactiveMark(client, {
      domain,
      occurredAt: new Date(`2020-0${(i % 9) + 1}-01T10:00:00-05:00`),
      note: `Retroactive achievement ${i}.`,
    });
  }
}

describe.skipIf(!hasDb)("New event types are zero-XP and domain-scoped (milestone-3-spec.md §1)", () => {
  it("rejects metric.recorded / note.recorded without a domain", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(
        appendEvent(client, {
          type: "metric.recorded",
          occurredAt: new Date("2026-07-01T10:00:00-05:00"),
          payload: { metric: "weight", value: 70, unit: "kg" },
        })
      ).rejects.toThrow();
      await expect(
        appendEvent(client, {
          type: "note.recorded",
          occurredAt: new Date("2026-07-01T10:00:00-05:00"),
          payload: { note: "Feeling strong." },
        })
      ).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("recordMetric / recordNote write correctly-shaped, domain-scoped events", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const metric = await recordMetric(client, { domain: "body", metric: "weight", value: 70, unit: "kg" });
      expect(metric.domain).toBe("body");
      expect(metric.payload).toEqual({ metric: "weight", value: 70, unit: "kg" });

      const note = await recordNote(client, { domain: "life", note: "Reconnected with an old friend." });
      expect(note.domain).toBe("life");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Retroactive Marks (milestone-3-spec.md §3)", () => {
  it("counts retroactive Marks and their domains, corrections applied", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body"]);
      const stats = await retroactiveMarkStats(client);
      expect(stats.count).toBe(AUDIT_MIN_RETROACTIVE_MARKS);
      expect(new Set(stats.domains)).toEqual(new Set(["career", "body"]));
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("rejects a retroactive Mark with no note", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(
        appendEvent(client, {
          type: "mark.recorded",
          occurredAt: new Date("2020-01-01T10:00:00-05:00"),
          domain: "career",
          payload: { retroactive: true },
        })
      ).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Fewer than three retroactive Marks cannot advance (milestone-3-spec.md §3/§7)", () => {
  it("blocks recordOutcome, openSeason, and setStance below the minimum", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await recordRetroactiveMark(client, {
        domain: "career",
        occurredAt: new Date("2020-01-01T10:00:00-05:00"),
        note: "Only one.",
      });

      await expect(recordOutcome(client, { statement: "Ship it." })).rejects.toThrow();
      await expect(openSeason(client, { number: 1 })).rejects.toThrow();
      await expect(setStance(client, { behaviour: "doomscrolling", stance: "reducing" })).rejects.toThrow();
      await expect(completeAudit(client, { startingRank: "E" })).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("allows all of them once the minimum is met", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body", "attention"]);

      const outcome = await recordOutcome(client, { statement: "Ship it." });
      expect(outcome.type).toBe("quest.created");

      const season = await openSeason(client, { number: 1 });
      expect(season.type).toBe("season.opened");

      const stance = await setStance(client, { behaviour: "doomscrolling", stance: "reducing" });
      expect(stance.type).toBe("stance.changed");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("`not_now` stances are unreachable outside management (milestone-3-spec.md §4)", () => {
  it("excludes not_now from getActiveStances but includes it in getAllStancesForManagement", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body", "attention"]);
      await setStance(client, { behaviour: "doomscrolling", stance: "not_now" });
      await setStance(client, { behaviour: "late_snacking", stance: "reducing" });

      const active = await getActiveStances(client);
      expect(active.map((s) => s.behaviour)).toEqual(["late_snacking"]);

      const all = await getAllStancesForManagement(client);
      expect(all.map((s) => s.behaviour).sort()).toEqual(["doomscrolling", "late_snacking"]);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("upserts by behaviour rather than accumulating rows", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body", "attention"]);
      await setStance(client, { behaviour: "doomscrolling", stance: "observing" });
      await setStance(client, { behaviour: "doomscrolling", stance: "abstaining" });

      const all = await getAllStancesForManagement(client);
      expect(all).toHaveLength(1);
      expect(all[0]?.stance).toBe("abstaining");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Stance changes are restricted to season boundaries (PRD §16)", () => {
  it("allows declaring a new behaviour after the audit boundary has closed", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body", "attention"]);
      await completeAudit(client, { startingRank: "E" });

      const stance = await setStance(client, { behaviour: "doomscrolling", stance: "reducing" });
      expect(stance.type).toBe("stance.changed");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("rejects changing an already-named behaviour's stance once the audit boundary has closed", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body", "attention"]);
      await setStance(client, { behaviour: "doomscrolling", stance: "observing" });
      await completeAudit(client, { startingRank: "E" });

      await expect(setStance(client, { behaviour: "doomscrolling", stance: "abstaining" })).rejects.toThrow();

      const all = await getAllStancesForManagement(client);
      expect(all.find((s) => s.behaviour === "doomscrolling")?.stance).toBe("observing");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Starting rank (milestone-3-spec.md §6)", () => {
  it("proposes E, D, or C per the deterministic domain/mark thresholds", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      expect((await computeProposedStartingRank(client)).rank).toBe("E");

      // 2 domains, 3 marks -> D.
      await recordRetroactiveMark(client, { domain: "career", occurredAt: new Date("2020-01-01"), note: "a" });
      await recordRetroactiveMark(client, { domain: "career", occurredAt: new Date("2020-01-02"), note: "b" });
      await recordRetroactiveMark(client, { domain: "body", occurredAt: new Date("2020-01-03"), note: "c" });
      expect((await computeProposedStartingRank(client)).rank).toBe("D");

      // 3 domains, 6 marks -> C.
      await recordRetroactiveMark(client, { domain: "attention", occurredAt: new Date("2020-01-04"), note: "d" });
      await recordRetroactiveMark(client, { domain: "attention", occurredAt: new Date("2020-01-05"), note: "e" });
      await recordRetroactiveMark(client, { domain: "attention", occurredAt: new Date("2020-01-06"), note: "f" });
      const proposal = await computeProposedStartingRank(client);
      expect(proposal.rank).toBe("C");
      expect(proposal.explanation).toContain("3 domains");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("never proposes above C even with every domain and many marks", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < 20; i++) {
        await recordRetroactiveMark(client, {
          domain: DOMAINS[i % DOMAINS.length] as (typeof DOMAINS)[number],
          occurredAt: new Date(`2020-01-${String((i % 28) + 1).padStart(2, "0")}`),
          note: `mark ${i}`,
        });
      }
      expect((await computeProposedStartingRank(client)).rank).toBe("C");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("completeAudit accepts adjusting the rank down but rejects adjusting it up", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // 2 domains, 3 marks -> proposed D.
      await recordRetroactiveMark(client, { domain: "career", occurredAt: new Date("2020-01-01"), note: "a" });
      await recordRetroactiveMark(client, { domain: "career", occurredAt: new Date("2020-01-02"), note: "b" });
      await recordRetroactiveMark(client, { domain: "body", occurredAt: new Date("2020-01-03"), note: "c" });

      await expect(completeAudit(client, { startingRank: "C" })).rejects.toThrow(); // up from D -> rejected

      const completed = await completeAudit(client, { startingRank: "E" }); // down from D -> allowed
      expect(completed.payload).toEqual({ proposedRank: "D", startingRank: "E" });
      expect(await getCurrentRank(client)).toBe("E");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("audit.completed can only be written once", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body", "attention"]);
      await completeAudit(client, { startingRank: "E" });
      await expect(completeAudit(client, { startingRank: "E" })).rejects.toThrow();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Audit progress / resumability (milestone-3-spec.md §2/§7)", () => {
  it("reports exactly what's been recorded after a partial run", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await recordNote(client, { domain: "career", note: "Doing fine." });
      await recordNote(client, { domain: "body", note: "Could be stronger." });
      expect(await isDomainSelfAssessmentComplete(client)).toBe(false);

      await recordNote(client, { domain: "attention", note: "Distracted lately." });
      await recordNote(client, { domain: "life", note: "Good, actually." });
      expect(await isDomainSelfAssessmentComplete(client)).toBe(true);

      await seedMinimumMarks(client, ["career", "body", "attention"]);
      await recordMetric(client, { domain: "body", metric: "weight", value: 70, unit: "kg" });

      const progress = await getAuditProgress(client);
      expect(progress.domainsWithNotes.sort()).toEqual([...DOMAINS].sort());
      expect(progress.retroactiveMarks.count).toBe(AUDIT_MIN_RETROACTIVE_MARKS);
      expect(progress.metricsRecorded).toBe(1);
      expect(progress.stancesNamed).toBe(0);
      expect(progress.outcomesRecorded).toBe(0);
      expect(progress.seasonOpened).toBe(false);
      expect(progress.completed).toBe(false);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("outcomes accumulate and are readable back", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body", "attention"]);
      await recordOutcome(client, { statement: "Statement one." });
      await recordOutcome(client, { statement: "Statement two." });

      const outcomes = await listOutcomes(client);
      expect(outcomes.map((o) => o.statement)).toEqual(["Statement one.", "Statement two."]);
      expect(outcomes.every((o) => o.status === "active")).toBe(true);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("The audit must not register as momentum conduct (milestone-3-spec.md §5)", () => {
  it("excludes note.recorded, metric.recorded, and audit.completed from MOMENTUM_CONDUCT_EVENT_TYPES", () => {
    const conductTypes: readonly string[] = MOMENTUM_CONDUCT_EVENT_TYPES;
    expect(conductTypes).not.toContain("note.recorded");
    expect(conductTypes).not.toContain("metric.recorded");
    expect(conductTypes).not.toContain("audit.completed");
    expect(conductTypes).toContain("mark.recorded"); // §5: mark.recorded remains conduct
  });

  it("a day containing only audit-type events derives an empty conduct-day set, and reads Dormant", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedMinimumMarks(client, ["career", "body", "attention"]); // occurred in 2020 — outside any momentum window below
      const auditDay = "2026-08-01";
      await recordNote(client, { domain: "career", note: "x", occurredAt: new Date(`${auditDay}T10:00:00-05:00`) });
      await recordMetric(client, {
        domain: "body",
        metric: "weight",
        value: 70,
        unit: "kg",
        occurredAt: new Date(`${auditDay}T10:00:00-05:00`),
      });
      await completeAudit(client, { startingRank: "E", occurredAt: new Date(`${auditDay}T11:00:00-05:00`) });

      // What future milestone-5 wiring would derive: distinct logical days
      // on which a MOMENTUM_CONDUCT_EVENT_TYPES event occurred, from the raw
      // rows just written (the three audit-only writes above, on auditDay).
      const rows = await client.query<{ type: string; logical_day: string }>(
        `SELECT type, logical_day FROM events WHERE logical_day = $1`,
        [auditDay]
      );
      const conductLogicalDays = [
        ...new Set(
          rows.rows
            .filter((row) => (MOMENTUM_CONDUCT_EVENT_TYPES as readonly string[]).includes(row.type))
            .map((row) => row.logical_day)
        ),
      ];
      expect(conductLogicalDays).toEqual([]); // note/metric/audit.completed alone produce no conduct day

      const result = computeMomentum({
        asOfLogicalDay: "2026-08-08", // 7 days after the audit, nothing since
        commitments: [],
        completions: [],
        conductLogicalDays,
      });
      expect(result.state).toBe("Dormant");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe.skipIf(!hasDb)("Tenure excludes retroactive Marks (interaction with milestone-2-spec.md §7)", () => {
  it("does not let a backdated retroactive Mark inflate tenure", async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await recordRetroactiveMark(client, {
        domain: "career",
        occurredAt: new Date("2015-01-01T10:00:00-05:00"), // 11 years before asOf
        note: "Ancient achievement.",
      });
      await recordNote(client, {
        domain: "body",
        note: "Real first day.",
        occurredAt: new Date("2026-08-01T10:00:00-05:00"),
      });

      const identity = await computeIdentity(client, new Date("2026-08-10T00:00:00-05:00"));
      expect(identity.tenureDays).toBe(10); // Aug 1 - Aug 10 inclusive, not ~11 years

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
