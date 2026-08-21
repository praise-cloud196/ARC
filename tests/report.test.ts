/**
 * docs/milestone-4-spec.md §6 / PRD §12.3, corrected by
 * docs/milestone-4.1-fixes.md §2/§3/§5. Pure function, no database —
 * `closingLine` is supplied directly here (lib/report-facts.ts, which
 * actually derives it from the log, has its own test file). The five
 * variants are still checked word for word against the PRD's own worked
 * examples, using the PRD's own closing-line text as the supplied value.
 */
import { describe, expect, it } from "vitest";
import { computeNightlyReport, type NightlyReportInput } from "../lib/report";
import type { MomentumResult } from "../lib/momentum";

// delta: 0 sits inside MOMENTUM_STABLE_BAND (0.05), so the qualifier this
// produces is "unchanged" wherever one is shown at all
// (milestone-4.1-fixes.md §5).
const STRONG: MomentumResult = { state: "Strong", rateCurrent: 0.9, ratePrior: 0.9, delta: 0 };

const BASE: NightlyReportInput = {
  dayNumber: 34,
  seasonNumber: 1,
  weekCommitments: [],
  completedTodayIds: [],
  xpEarnedToday: {},
  momentum: STRONG,
  closingLine: null,
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
      closingLine: "Three of the last five days ran clean.",
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
    // milestone-4.1-fixes.md §5 replaces the old hardcoded "— holding"
    // qualifier with the same delta-derived one partial uses — "— holding"
    // is no longer produced anywhere.
    const input: NightlyReportInput = { ...BASE, dayNumber: 36, closingLine: "Day incomplete. Progress continues." };
    expect(computeNightlyReport(input)).toEqual([
      "DAY 36 · SEASON 1",
      "Nothing logged.",
      "Momentum: Strong — unchanged",
      "Day incomplete. Progress continues.",
    ]);
  });

  it("empty day with no closing line: three lines, no trailing blank", () => {
    // milestone-4.1-fixes.md §3: silence is correct and common. §2: the
    // blank spacer line was only ever in service of the old rotating-pool
    // copy — dropped along with it.
    const input: NightlyReportInput = { ...BASE, dayNumber: 36, closingLine: null };
    expect(computeNightlyReport(input)).toEqual(["DAY 36 · SEASON 1", "Nothing logged.", "Momentum: Strong — unchanged"]);
  });

  it("day containing a Mark — the Mark is the last line, no qualifier, no closing line", () => {
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
      closingLine: "This should never appear — Mark leaves no room.",
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
});

describe("report length guarantee, measured in lines (milestone-4.1-fixes.md §2)", () => {
  it("an empty day has exactly one fewer line than a complete day, for the same data and closing-line presence", () => {
    // "An empty day is four lines; a complete day is five. That is the
    // whole rule" — structural (no XP line on an empty day, ever), not
    // contingent on which closing line's text happens to be picked.
    const shared = { ...BASE, weekCommitments: [{ id: "1", label: "a" }] };

    const completeWithClosing = computeNightlyReport({
      ...shared,
      completedTodayIds: ["1"],
      xpEarnedToday: { body: 10 },
      closingLine: "A closing line.",
    });
    const emptyWithClosing = computeNightlyReport({ ...shared, completedTodayIds: [], closingLine: "A closing line." });
    expect(completeWithClosing).toHaveLength(5);
    expect(emptyWithClosing).toHaveLength(4);
    expect(emptyWithClosing.length).toBe(completeWithClosing.length - 1);

    const completeNoClosing = computeNightlyReport({
      ...shared,
      completedTodayIds: ["1"],
      xpEarnedToday: { body: 10 },
      closingLine: null,
    });
    const emptyNoClosing = computeNightlyReport({ ...shared, completedTodayIds: [], closingLine: null });
    expect(completeNoClosing).toHaveLength(4);
    expect(emptyNoClosing).toHaveLength(3);
    expect(emptyNoClosing.length).toBe(completeNoClosing.length - 1);
  });
});

describe("momentum qualifier derived from delta, not from today's activity (milestone-4.1-fixes.md §5)", () => {
  const emptyDayWith = (delta: number | null): string[] =>
    computeNightlyReport({ ...BASE, momentum: { ...STRONG, delta }, closingLine: null });

  it("delta above the stable band -> improving", () => {
    expect(emptyDayWith(0.1)).toContain("Momentum: Strong — improving");
  });

  it("delta below the negative stable band -> slipping", () => {
    expect(emptyDayWith(-0.1)).toContain("Momentum: Strong — slipping");
  });

  it("delta within the band -> unchanged", () => {
    expect(emptyDayWith(0.01)).toContain("Momentum: Strong — unchanged");
  });

  it("null delta -> no qualifier at all", () => {
    expect(emptyDayWith(null)).toContain("Momentum: Strong");
    expect(emptyDayWith(null).some((line) => line.includes("—"))).toBe(false);
  });
});
