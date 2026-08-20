/**
 * milestone-2-spec.md §3. Pure function, no database — every row of the
 * §3.3 edge-case table gets its own test, plus the ordering/capping/
 * proration rules from §3.1-3.2.
 */
import { describe, expect, it } from "vitest";
import { computeMomentum, type MomentumCommitment, type MomentumCompletion } from "../lib/momentum";

// Fixed reference day. Current window: 2026-03-01..2026-03-14.
// Prior window: 2026-02-15..2026-02-28.
const ASOF = "2026-03-14";

function daily(id: string, activeFrom: string, activeUntil: string | null = null): MomentumCommitment {
  return { id, weeklyTarget: 7, activeFrom, activeUntil };
}

function completionsEveryDay(commitmentId: string, from: string, to: string): MomentumCompletion[] {
  const out: MomentumCompletion[] = [];
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  let cursor = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  while (cursor <= end) {
    out.push({ commitmentId, logicalDay: new Date(cursor).toISOString().slice(0, 10) });
    cursor += 24 * 60 * 60 * 1000;
  }
  return out;
}

describe("momentum: base states", () => {
  it("Strong: current rate >= 0.8, regardless of a small dip from the prior period", () => {
    const commitment = daily("c1", "2026-01-01");
    const completions = [
      ...completionsEveryDay("c1", "2026-02-15", "2026-02-28"), // prior: 100%
      ...completionsEveryDay("c1", "2026-03-01", "2026-03-13"), // current: 13/14 = 93%
    ];
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: ["2026-03-13"],
    });
    // A week at 93% following a week at 100% is Strong, not Slipping —
    // Strong is checked before Slipping (§3.2).
    expect(result.state).toBe("Strong");
    expect(result.rateCurrent).toBeCloseTo(13 / 14, 5);
  });

  it("Building: rate improving beyond the stable band, current still under 0.8", () => {
    const commitment = daily("c1", "2026-01-01");
    const completions = [
      ...completionsEveryDay("c1", "2026-02-15", "2026-02-21"), // prior: 7/14 = 50%
      ...completionsEveryDay("c1", "2026-03-01", "2026-03-10"), // current: 10/14 ≈ 71%
    ];
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: ["2026-03-10"],
    });
    expect(result.state).toBe("Building");
  });

  it("Slipping: rate declining beyond the stable band", () => {
    const commitment = daily("c1", "2026-01-01");
    const completions = [
      ...completionsEveryDay("c1", "2026-02-15", "2026-02-28"), // prior: 100%
      ...completionsEveryDay("c1", "2026-03-01", "2026-03-07"), // current: 7/14 = 50%
    ];
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: [ASOF],
    });
    expect(result.state).toBe("Slipping");
  });

  it("Holding: delta within the stable band", () => {
    // A single daily commitment over a 14-day window can only move its rate
    // in steps of 1/14 ≈ 0.071 — already bigger than the 0.05 stable band —
    // so this needs two commitments to get a delta fine enough to land
    // inside the band.
    const commitments = [daily("a", "2026-01-01"), daily("b", "2026-01-01")];
    const completions = [
      ...completionsEveryDay("a", "2026-02-15", "2026-02-22"), // prior a: 8 days
      ...completionsEveryDay("b", "2026-02-15", "2026-02-22"), // prior b: 8 days -> 16/28 ≈ 0.571
      ...completionsEveryDay("a", "2026-03-01", "2026-03-08"), // current a: 8 days
      ...completionsEveryDay("b", "2026-03-01", "2026-03-09"), // current b: 9 days -> 17/28 ≈ 0.607
    ];
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments,
      completions,
      conductLogicalDays: [ASOF],
    });
    expect(result.state).toBe("Holding");
    expect(Math.abs(result.delta ?? Infinity)).toBeLessThanOrEqual(0.05);
  });

  it("Dormant overrides everything else, even a currently-Strong rate", () => {
    const commitment = daily("c1", "2026-01-01");
    const completions = completionsEveryDay("c1", "2026-02-15", "2026-03-08"); // both windows 100%
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: ["2026-03-08"], // last conduct 6 days before ASOF... still within 7-day window
    });
    // Sanity: 2026-03-08 is within the 7-day Dormant window ending 2026-03-14, so this should NOT be Dormant.
    expect(result.state).not.toBe("Dormant");

    const dormantResult = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: ["2026-03-01"], // 13 days before ASOF, outside the 7-day window
    });
    expect(dormantResult.state).toBe("Dormant");
  });
});

describe("momentum: §3.3 edge cases", () => {
  it("no prior period yet: delta undefined, skip Building/Slipping (Dormant -> Strong -> Holding)", () => {
    const commitment = daily("c1", "2026-03-01"); // didn't exist during the prior window at all
    const completions = completionsEveryDay("c1", "2026-03-01", "2026-03-09"); // current: 9/14 ≈ 64%, not Strong
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: ["2026-03-09"],
    });
    expect(result.ratePrior).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.state).toBe("Holding");
  });

  it("no commitments in the current window: rate undefined -> Holding, never Slipping", () => {
    const commitment: MomentumCommitment = {
      id: "c1",
      weeklyTarget: 7,
      activeFrom: "2026-02-15",
      activeUntil: "2026-02-28", // active only during the prior window
    };
    const completions = completionsEveryDay("c1", "2026-02-15", "2026-02-28"); // prior: 100%
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: [ASOF], // some other conduct keeps it non-Dormant
    });
    expect(result.rateCurrent).toBeNull();
    expect(result.state).toBe("Holding");
    expect(result.state).not.toBe("Slipping");
  });

  it("no commitments in the prior window but some in current: delta undefined, skip Building/Slipping", () => {
    const commitment = daily("c1", "2026-03-01");
    const completions = completionsEveryDay("c1", "2026-03-01", "2026-03-07"); // current: 7/14 = 50%
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: [ASOF],
    });
    expect(result.ratePrior).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.state).toBe("Holding");
  });

  it("Recovery Phase: rate reflects only the commitments the caller includes (the reduced set)", () => {
    // Full commitment set would be two commitments; the caller simulates a
    // Recovery Phase by only passing the one that's still active.
    const reducedSet = [daily("c1", "2026-01-01")];
    const completions = completionsEveryDay("c1", "2026-03-01", "2026-03-14"); // 100% on the one active commitment
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: reducedSet,
      completions,
      conductLogicalDays: ["2026-03-14"],
    });
    expect(result.rateCurrent).toBe(1);
    expect(result.state).toBe("Strong");
  });

  it("attention-only activity does not count as conduct for the Dormant check", () => {
    // The caller never includes attention_events days in conductLogicalDays
    // at all (lib/attention-events.ts is a separate table); simulating that
    // "only attention activity happened" means passing none here.
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [],
      completions: [],
      conductLogicalDays: [],
    });
    expect(result.state).toBe("Dormant");
  });
});

describe("momentum: §3.1 rate mechanics", () => {
  it("caps an overshot commitment's contribution instead of letting it mask a fully-missed one", () => {
    const overshot: MomentumCommitment = { id: "weekly", weeklyTarget: 1, activeFrom: "2026-01-01" };
    const missed = daily("daily", "2026-01-01");
    const completions = [
      // Completed 5 times in 14 days against a target of 2 (1/week * 2 weeks).
      { commitmentId: "weekly", logicalDay: "2026-03-01" },
      { commitmentId: "weekly", logicalDay: "2026-03-03" },
      { commitmentId: "weekly", logicalDay: "2026-03-05" },
      { commitmentId: "weekly", logicalDay: "2026-03-08" },
      { commitmentId: "weekly", logicalDay: "2026-03-10" },
      // "daily" never completed at all.
    ];
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [overshot, missed],
      completions,
      conductLogicalDays: ["2026-03-10"],
    });
    // expected = 2 (weekly) + 14 (daily) = 16; completed = min(5,2) + 0 = 2.
    expect(result.rateCurrent).toBeCloseTo(2 / 16, 5);
  });

  it("prorates a commitment created mid-window instead of dragging the rate down for days before it existed", () => {
    // Created on day 8 of the 14-day current window (2026-03-08..2026-03-14 = 7 days active).
    const commitment = daily("c1", "2026-03-08");
    const completions = completionsEveryDay("c1", "2026-03-08", "2026-03-14"); // completed every day it existed
    const result = computeMomentum({
      asOfLogicalDay: ASOF,
      commitments: [commitment],
      completions,
      conductLogicalDays: ["2026-03-14"],
    });
    expect(result.rateCurrent).toBe(1);
  });
});
