/**
 * The nightly report (milestone-4-spec.md §6, PRD §12.3). Pure — no I/O;
 * `computeNightlyReportData` in lib/loop.ts assembles `NightlyReportInput`
 * from the DB and calls `computeNightlyReport`.
 *
 * PRD §12.3 gives five worked examples, not a derivation algorithm — this
 * is an interpretation of those examples, not a literal transcription of a
 * spec'd rule, and should be treated as flagged for product-owner review
 * (AGENTS.md: "If a string isn't specified in the PRD, write it in the
 * register above and flag it for review"):
 *
 * - "X of Y" counts today's *distinct commitments completed at least once*
 *   against the count of commitments active this week — not weekly_target
 *   pacing, which the report never shows a running count of.
 * - The momentum qualifier ("— unchanged" / "— holding") is derived from
 *   today's completion completeness (partial -> unchanged, nothing logged
 *   -> holding, everything done -> no qualifier), not from
 *   MomentumResult.delta — the three PRD examples are consistent with this
 *   reading but also with others; there wasn't a way to be sure which was
 *   intended without more than three data points.
 * - The closing framing line's candidates are fixed strings (including the
 *   PRD's own examples verbatim), not text computed from real log data —
 *   "Three of the last five days ran clean." is treated as one flavor
 *   string in the complete-day rotation, not a verified statistic.
 *
 * Every variant caps at 5 lines (the hard PRD §12.3 maximum) by
 * construction: Mark-containing drops "Not logged" and the closing framing
 * line to make room for the Mark line; partial days are already full at 5
 * without a closing line; empty/complete days have room for one.
 */
import { dayIndex } from "./day-math";
import type { MomentumResult } from "./momentum";

export interface ReportCommitment {
  id: string;
  label: string;
}

export interface ReportMark {
  /** "What changed because of this?" — rendered as the report's last line. */
  note: string;
}

export interface NightlyReportInput {
  dayNumber: number;
  seasonNumber: number;
  logicalDay: string;
  /** Every commitment active for the current week. */
  weekCommitments: ReportCommitment[];
  /** Ids of weekCommitments completed at least once today. */
  completedTodayIds: string[];
  /** XP earned today, by domain, already summed — omitted from the report entirely if empty. */
  xpEarnedToday: Record<string, number>;
  momentum: MomentumResult;
  /** Today's Mark, if any — takes over the report's shape (see module comment). */
  mark: ReportMark | null;
  /** Set only on the first open after a >=14-day gap; overrides every other variant. */
  returnAfterGapDays: number | null;
  /** What was logged on a return day's single line, e.g. "Train · logged". Required when returnAfterGapDays is set. */
  returnLoggedLine: string | null;
}

const CLOSING_LINES_COMPLETE = [
  "Three of the last five days ran clean.",
  "The pattern holds.",
  "Consistent, not dramatic.",
  "Another full day on the record.",
  "The log speaks for itself.",
  "Steady, same as the day before.",
  "Nothing here needed forcing.",
] as const;

const CLOSING_LINES_EMPTY = [
  "Day incomplete. Progress continues.",
  "Nothing today. The record continues regardless.",
  "A gap, not a verdict.",
  "The log shows a pause, not a stop.",
  "Tomorrow is unaffected by today.",
  "Silence in the log. Nothing more.",
  "One day does not undo the rest.",
] as const;

function pickClosingLine(lines: readonly string[], logicalDay: string): string {
  const line = lines[dayIndex(logicalDay) % lines.length];
  if (!line) throw new Error("Closing line set must be non-empty.");
  return line;
}

function formatXpLine(xpEarnedToday: Record<string, number>): string | null {
  const entries = Object.entries(xpEarnedToday)
    .filter(([, xp]) => xp > 0)
    .sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  return entries
    .map(([domain, xp]) => `${domain[0]?.toUpperCase()}${domain.slice(1)} +${xp}`)
    .join(" · ");
}

/** Pure. Returns the report as an ordered list of lines (never more than 5). */
export function computeNightlyReport(input: NightlyReportInput): string[] {
  const header = `DAY ${input.dayNumber} · SEASON ${input.seasonNumber}`;

  if (input.returnAfterGapDays !== null) {
    const lines = [header, `First entry in ${input.returnAfterGapDays} days.`];
    if (input.returnLoggedLine) lines.push(input.returnLoggedLine);
    lines.push("", "The record resumes.");
    return lines;
  }

  const completedCount = input.completedTodayIds.length;
  const totalCount = input.weekCommitments.length;
  const xpLine = formatXpLine(input.xpEarnedToday);
  const momentumWord = input.momentum.state;

  if (input.mark) {
    // PRD §12.3's Mark-day example shows "4 of 4." with no "Complete."
    // prefix even at a full count — unlike the plain complete-day variant
    // below. The Mark line itself is what the day finishes on, so the
    // count line stays plain.
    const countLine = completedCount === 0 ? "Nothing logged." : `${completedCount} of ${totalCount}.`;
    const lines = [header, countLine];
    if (xpLine) lines.push(xpLine);
    lines.push(`Momentum: ${momentumWord}`);
    lines.push(`MARK — ${input.mark.note}`);
    return lines.slice(0, 5);
  }

  if (completedCount === 0) {
    const lines = [header, "Nothing logged.", `Momentum: ${momentumWord} — holding`, ""];
    lines.push(pickClosingLine(CLOSING_LINES_EMPTY, input.logicalDay));
    return lines;
  }

  if (completedCount === totalCount && totalCount > 0) {
    const lines = [header, `Complete. ${completedCount} of ${totalCount}.`];
    if (xpLine) lines.push(xpLine);
    lines.push(`Momentum: ${momentumWord}`);
    lines.push(pickClosingLine(CLOSING_LINES_COMPLETE, input.logicalDay));
    return lines.slice(0, 5);
  }

  // Partial: already at 5 lines with "Not logged", so no closing line fits.
  const notLogged = input.weekCommitments
    .filter((c) => !input.completedTodayIds.includes(c.id))
    .map((c) => c.label);
  const lines = [header, `${completedCount} of ${totalCount}.`];
  if (xpLine) lines.push(xpLine);
  lines.push(`Not logged: ${notLogged.join(", ")}`);
  lines.push(`Momentum: ${momentumWord} — unchanged`);
  return lines.slice(0, 5);
}
