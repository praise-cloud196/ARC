/**
 * docs/milestone-4-spec.md §6 / PRD §12.3 — the five report variants,
 * checked word for word against the PRD's own worked examples. Pure
 * function, no database. "2020-01-06" is lib/day-math.ts's dayIndex epoch
 * (index 0), so it deterministically picks index 0 of each closing-line
 * set — the PRD's own line, in both cases.
 */
import { describe, expect, it } from "vitest";
import { computeNightlyReport, type NightlyReportInput } from "../lib/report";
import type { MomentumResult } from "../lib/momentum";

const STRONG: MomentumResult = { state: "Strong", rateCurrent: 0.9, ratePrior: 0.9, delta: 0 };

const BASE: NightlyReportInput = {
  dayNumber: 34,
  seasonNumber: 1,
  logicalDay: "2020-01-06",
  weekCommitments: [],
  completedTodayIds: [],
  xpEarnedToday: {},
  momentum: STRONG,
  mark: null,
  returnAfterGapDays: null,
  returnLoggedLine: null,
};

describe("nightly report variants (PRD §12.3, word for word)", () => {
  it("complete day", () => {
    const input: NightlyReportInput = {
      ...BASE,
      dayNumber: 34,
      weekCommitments: [
        { id: "1", label: "a" },
        { id: "2", label: "b" },
        { id: "3", label: "c" },
        { id: "4", label: "d" },
      ],
      completedTodayIds: ["1", "2", "3", "4"],
      xpEarnedToday: { body: 50, career: 25 },
    };
    expect(computeNightlyReport(input)).toEqual([
      "DAY 34 · SEASON 1",
      "Complete. 4 of 4.",
      "Body +50 · Career +25",
      "Momentum: Strong",
      "Three of the last five days ran clean.",
    ]);
  });

  it("partial day", () => {
    const input: NightlyReportInput = {
      ...BASE,
      dayNumber: 35,
      weekCommitments: [
        { id: "1", label: "Career task" },
        { id: "2", label: "Attention task" },
        { id: "3", label: "Train" },
        { id: "4", label: "Reflect" },
        { id: "5", label: "Other" },
      ],
      completedTodayIds: ["1", "2", "5"],
      xpEarnedToday: { career: 50, attention: 10 },
    };
    expect(computeNightlyReport(input)).toEqual([
      "DAY 35 · SEASON 1",
      "3 of 5.",
      "Career +50 · Attention +10",
      "Not logged: Train, Reflect",
      "Momentum: Strong — unchanged",
    ]);
  });

  it("empty day", () => {
    const input: NightlyReportInput = { ...BASE, dayNumber: 36 };
    expect(computeNightlyReport(input)).toEqual([
      "DAY 36 · SEASON 1",
      "Nothing logged.",
      "Momentum: Strong — holding",
      "",
      "Day incomplete. Progress continues.",
    ]);
  });

  it("day containing a Mark — the Mark is the last line", () => {
    const input: NightlyReportInput = {
      ...BASE,
      dayNumber: 41,
      weekCommitments: [
        { id: "1", label: "a" },
        { id: "2", label: "b" },
        { id: "3", label: "c" },
        { id: "4", label: "d" },
      ],
      completedTodayIds: ["1", "2", "3", "4"],
      xpEarnedToday: { body: 50, career: 25 },
      mark: { note: "10 pull-ups, clean. Recorded." },
    };
    expect(computeNightlyReport(input)).toEqual([
      "DAY 41 · SEASON 1",
      "4 of 4.",
      "Body +50 · Career +25",
      "Momentum: Strong",
      "MARK — 10 pull-ups, clean. Recorded.",
    ]);
  });

  it("first day after a return", () => {
    const input: NightlyReportInput = {
      ...BASE,
      dayNumber: 1,
      seasonNumber: 4,
      returnAfterGapDays: 67,
      returnLoggedLine: "Train · logged",
    };
    expect(computeNightlyReport(input)).toEqual([
      "DAY 1 · SEASON 4",
      "First entry in 67 days.",
      "Train · logged",
      "",
      "The record resumes.",
    ]);
  });

  it("never exceeds five lines", () => {
    const input: NightlyReportInput = {
      ...BASE,
      weekCommitments: Array.from({ length: 10 }, (_, i) => ({ id: String(i), label: `c${i}` })),
      completedTodayIds: ["0", "1", "2"],
      xpEarnedToday: { career: 10, body: 10, attention: 10 },
    };
    expect(computeNightlyReport(input).length).toBeLessThanOrEqual(5);
  });

  it("closing line never repeats within any 7 consecutive days (empty-day variant)", () => {
    // Empty-day inputs for 7 consecutive logical days; the closing line is
    // always the last of its 5 lines. All 7 must be distinct, proving the
    // day-index rotation over a 7-entry set can't repeat inside a 7-day
    // window.
    const closings = Array.from({ length: 7 }, (_, i) => {
      const input: NightlyReportInput = { ...BASE, logicalDay: `2020-03-${String(i + 1).padStart(2, "0")}` };
      const lines = computeNightlyReport(input);
      return lines[lines.length - 1];
    });
    expect(new Set(closings).size).toBe(7);
  });

  it("an empty day reads shorter than a full day, by content — not necessarily by line count", () => {
    // milestone-4-spec.md §6 / PRD §12.3's governing rule: "a day with
    // nothing logged produces a shorter report, not a longer one." Both
    // variants hit the 5-line cap (confirmed above), including in the
    // PRD's own worked examples — so "shorter" has to mean less actual
    // content (characters), not fewer lines. Checked across several day
    // indices so it isn't a coincidence of one closing-line pick.
    const fullDay: NightlyReportInput = {
      ...BASE,
      weekCommitments: [
        { id: "1", label: "a" },
        { id: "2", label: "b" },
      ],
      completedTodayIds: ["1", "2"],
      xpEarnedToday: { body: 50, career: 25 },
    };
    for (let i = 0; i < 7; i++) {
      const day = `2020-04-${String(i + 1).padStart(2, "0")}`;
      const fullChars = computeNightlyReport({ ...fullDay, logicalDay: day }).join("").length;
      const emptyChars = computeNightlyReport({ ...BASE, logicalDay: day }).join("").length;
      expect(emptyChars).toBeLessThan(fullChars);
    }
  });
});
