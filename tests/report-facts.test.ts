/**
 * docs/milestone-4.1-fixes.md §3 — the closing line is generated from fact
 * rules over the log, not picked from a stock pool. Pure functions, no
 * database.
 */
import { describe, expect, it } from "vitest";
import {
  cleanStreakRule,
  domainQuietBrokenRule,
  selectClosingLine,
  streakRecordRule,
  type ClosingLineContext,
  type FactCommitment,
  type FactCompletion,
} from "../lib/report-facts";

function commitment(id: string, activeFrom: string, activeUntil: string | null = null): FactCommitment {
  return { id, activeFrom, activeUntil };
}

function completedEveryDayExcept(
  commitmentId: string,
  domain: FactCompletion["domain"],
  from: string,
  to: string,
  skip: string[] = []
): FactCompletion[] {
  const out: FactCompletion[] = [];
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  let cursor = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  while (cursor <= end) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    if (!skip.includes(day)) out.push({ commitmentId, domain, logicalDay: day });
    cursor += 24 * 60 * 60 * 1000;
  }
  return out;
}

describe("cleanStreakRule", () => {
  it("fires once at least REPORT_CLEAN_STREAK_MIN of the last window days are clean", () => {
    const commitments = [commitment("c1", "2026-01-01")];
    const completions = completedEveryDayExcept("c1", "body", "2026-03-01", "2026-03-14");
    const ctx: ClosingLineContext = { commitments, completions, asOfDay: "2026-03-14" };
    expect(cleanStreakRule.evaluate(ctx)).toBe("5 of the last 5 days ran clean.");
  });

  it("does not fire below the minimum", () => {
    const commitments = [commitment("c1", "2026-01-01")];
    // Only 1 of the last 5 days completed.
    const completions: FactCompletion[] = [{ commitmentId: "c1", domain: "body", logicalDay: "2026-03-14" }];
    const ctx: ClosingLineContext = { commitments, completions, asOfDay: "2026-03-14" };
    expect(cleanStreakRule.evaluate(ctx)).toBeNull();
  });

  it("a day with no active commitments counts as vacuously clean", () => {
    const ctx: ClosingLineContext = { commitments: [], completions: [], asOfDay: "2026-03-14" };
    expect(cleanStreakRule.evaluate(ctx)).toBe("5 of the last 5 days ran clean.");
  });
});

describe("domainQuietBrokenRule", () => {
  it("fires for a domain whose gap since its last completion clears the threshold", () => {
    const completions: FactCompletion[] = [
      { commitmentId: "c1", domain: "career", logicalDay: "2026-02-01" }, // long ago
      { commitmentId: "c1", domain: "career", logicalDay: "2026-03-14" }, // today
    ];
    const ctx: ClosingLineContext = { commitments: [], completions, asOfDay: "2026-03-14" };
    expect(domainQuietBrokenRule.evaluate(ctx)).toBe("First Career completion in 41 days.");
  });

  it("does not fire for a domain completed recently", () => {
    const completions: FactCompletion[] = [
      { commitmentId: "c1", domain: "career", logicalDay: "2026-03-12" },
      { commitmentId: "c1", domain: "career", logicalDay: "2026-03-14" },
    ];
    const ctx: ClosingLineContext = { commitments: [], completions, asOfDay: "2026-03-14" };
    expect(domainQuietBrokenRule.evaluate(ctx)).toBeNull();
  });

  it("picks the domain with the largest gap when several qualify", () => {
    const completions: FactCompletion[] = [
      { commitmentId: "c1", domain: "career", logicalDay: "2026-01-01" },
      { commitmentId: "c1", domain: "career", logicalDay: "2026-03-14" },
      { commitmentId: "c2", domain: "body", logicalDay: "2026-02-01" },
      { commitmentId: "c2", domain: "body", logicalDay: "2026-03-14" },
    ];
    const ctx: ClosingLineContext = { commitments: [], completions, asOfDay: "2026-03-14" };
    expect(domainQuietBrokenRule.evaluate(ctx)).toBe("First Career completion in 72 days.");
  });
});

describe("streakRecordRule", () => {
  it("fires when today's streak is a new record", () => {
    const commitments = [commitment("c1", "2026-01-01")];
    // A 2-day clean streak (Feb 1-2), then a gap, then today's 3-day streak (Mar 12-14) beats it.
    const completions = [
      ...completedEveryDayExcept("c1", "body", "2026-02-01", "2026-02-02"),
      ...completedEveryDayExcept("c1", "body", "2026-03-12", "2026-03-14"),
    ];
    const ctx: ClosingLineContext = { commitments, completions, asOfDay: "2026-03-14" };
    expect(streakRecordRule.evaluate(ctx)).toBe("Longest run of complete days so far: 3.");
  });

  it("does not fire when a prior streak was at least as long", () => {
    const commitments = [commitment("c1", "2026-01-01")];
    const completions = [
      ...completedEveryDayExcept("c1", "body", "2026-02-01", "2026-02-05"), // 5-day streak, prior
      ...completedEveryDayExcept("c1", "body", "2026-03-12", "2026-03-14"), // only 3-day streak now
    ];
    const ctx: ClosingLineContext = { commitments, completions, asOfDay: "2026-03-14" };
    expect(streakRecordRule.evaluate(ctx)).toBeNull();
  });

  it("does not fire below the minimum streak length", () => {
    const commitments = [commitment("c1", "2026-01-01")];
    const completions = completedEveryDayExcept("c1", "body", "2026-03-14", "2026-03-14"); // 1 day
    const ctx: ClosingLineContext = { commitments, completions, asOfDay: "2026-03-14" };
    expect(streakRecordRule.evaluate(ctx)).toBeNull();
  });
});

describe("selectClosingLine: priority, cooldown, and silence", () => {
  it("returns null when no rule fires — silence is correct", () => {
    // A declared commitment, never completed: cleanStreakRule's window is
    // all dirty days, domainQuietBrokenRule has no completions to check,
    // streakRecordRule has no streak at all.
    const commitments = [commitment("c1", "2026-01-01")];
    const ctx: ClosingLineContext = { commitments, completions: [], asOfDay: "2026-03-14" };
    expect(selectClosingLine(ctx)).toBeNull();
  });

  it("a rule that fired within the cooldown window does not fire again", () => {
    const commitments = [commitment("c1", "2026-01-01")];
    // Clean every day from Mar 1 through Mar 14 -> cleanStreakRule fires on
    // Mar 14, but it also fired (same underlying condition) on Mar 13,
    // Mar 12, etc. — well within the 7-day cooldown — so it must be
    // suppressed for Mar 14, falling through to whatever's next (nothing
    // else fires here, so null).
    const completions = completedEveryDayExcept("c1", "body", "2026-03-01", "2026-03-14");
    const ctx: ClosingLineContext = { commitments, completions, asOfDay: "2026-03-14" };
    expect(selectClosingLine(ctx)).toBeNull();
  });

  it("fires again once the cooldown has elapsed", () => {
    const commitments = [commitment("c1", "2026-01-01")];
    // Only 3 clean days (Mar 12-14), not 5 — cleanStreakRule's 5-day
    // sliding window only clears REPORT_CLEAN_STREAK_MIN (3) on Mar 14
    // itself; every day in the 7-day cooldown before that has fewer than 3
    // clean days in its own window, so the rule wasn't actually eligible
    // on any of them.
    const completions = completedEveryDayExcept("c1", "body", "2026-03-12", "2026-03-14");
    const ctx: ClosingLineContext = { commitments, completions, asOfDay: "2026-03-14" };
    expect(selectClosingLine(ctx)).toBe("3 of the last 5 days ran clean.");
  });
});
