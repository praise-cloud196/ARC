/**
 * The nightly report (milestone-4-spec.md §6, PRD §12.3; corrected by
 * milestone-4.1-fixes.md §2/§3/§5). Pure — no I/O; `computeNightlyReportData`
 * in lib/loop.ts assembles `NightlyReportInput` from the DB, including
 * calling lib/report-facts.ts's `selectClosingLine`, and calls
 * `computeNightlyReport`.
 *
 * PRD §12.3 gives five worked examples, not a derivation algorithm — two
 * pieces here remain this session's interpretation of those examples,
 * flagged for review the same way milestone-2-spec.md's original XP curve
 * was:
 *
 * - "X of Y" counts today's *distinct commitments completed at least once*
 *   against the count of commitments active this week — not weekly_target
 *   pacing, which the report never shows a running count of.
 * - Mark-day and partial-day never show a momentum qualifier or a closing
 *   line at all (matching PRD's own worked examples exactly, which show
 *   Mark-day's momentum bare like complete-day's); only complete and empty
 *   do — Mark/partial are already at the 5-line cap without one.
 *
 * milestone-4.1-fixes.md corrected two things this module used to get
 * wrong on its own:
 * - §2: "shorter" is measured in **lines**, not characters. An empty day
 *   has one fewer information-bearing line than a complete day, by
 *   construction (no XP line) — true regardless of which lines happen to
 *   render, so this no longer depends on copy-pool wording at all.
 * - §3: the closing line is supplied by the caller, already resolved by
 *   lib/report-facts.ts's fact rules over the actual log — this module
 *   never invents it, and renders nothing when the caller passes null
 *   (silence is correct and expected to be common).
 * - §5: the momentum qualifier ("improving" / "slipping" / "unchanged") is
 *   derived from `delta` against `MOMENTUM_STABLE_BAND` — the same
 *   threshold momentum.ts itself uses — not from today's completion
 *   completeness. Omitted entirely when `delta` is null.
 *
 * Every variant caps at 5 lines (the hard PRD §12.3 maximum) by
 * construction: Mark-containing drops "Not logged" and the closing line to
 * make room for the Mark line; partial days are already full at 5 without
 * a closing line; empty/complete days have room for one when the caller
 * supplies one.
 */
import { MOMENTUM_STABLE_BAND } from "./calibration";
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
  /** Every commitment active for the current week. */
  weekCommitments: ReportCommitment[];
  /** Ids of weekCommitments completed at least once today. */
  completedTodayIds: string[];
  /** XP earned today, by domain, already summed — omitted from the report entirely if empty. */
  xpEarnedToday: Record<string, number>;
  momentum: MomentumResult;
  /**
   * Already resolved by lib/report-facts.ts's `selectClosingLine` — this
   * module doesn't compute it, only decides whether there's room to show
   * it. Null means no fact rule fired (or none was off cooldown): render
   * nothing, not a placeholder.
   */
  closingLine: string | null;
  /** Today's Mark, if any — takes over the report's shape (see module comment). */
  mark: ReportMark | null;
  /** Set only on the first open after a >=14-day gap; overrides every other variant. */
  returnAfterGapDays: number | null;
  /** What was logged on a return day's single line, e.g. "Train · logged". Required when returnAfterGapDays is set. */
  returnLoggedLine: string | null;
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

/** milestone-4.1-fixes.md §5: derived from delta against the same band momentum.ts itself uses, not from today's activity. Empty string when delta is null — no qualifier at all. */
function momentumQualifier(momentum: MomentumResult): string {
  if (momentum.delta === null) return "";
  if (momentum.delta > MOMENTUM_STABLE_BAND) return " — improving";
  if (momentum.delta < -MOMENTUM_STABLE_BAND) return " — slipping";
  return " — unchanged";
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
    // count line stays plain, and momentum stays bare (no qualifier, no
    // closing line — no room, and Mark already closes the day).
    const countLine = completedCount === 0 ? "Nothing logged." : `${completedCount} of ${totalCount}.`;
    const lines = [header, countLine];
    if (xpLine) lines.push(xpLine);
    lines.push(`Momentum: ${momentumWord}`);
    lines.push(`MARK — ${input.mark.note}`);
    return lines.slice(0, 5);
  }

  if (completedCount === 0) {
    // Structurally one line shorter than the complete-day branch below in
    // every case (milestone-4.1-fixes.md §2): no XP line, ever, since
    // nothing was completed. No blank spacer line — that was only ever in
    // service of the old rotating-pool copy, not a rule of its own.
    const lines = [header, "Nothing logged.", `Momentum: ${momentumWord}${momentumQualifier(input.momentum)}`];
    if (input.closingLine) lines.push(input.closingLine);
    return lines;
  }

  if (completedCount === totalCount && totalCount > 0) {
    const lines = [header, `Complete. ${completedCount} of ${totalCount}.`];
    if (xpLine) lines.push(xpLine);
    lines.push(`Momentum: ${momentumWord}`);
    if (input.closingLine) lines.push(input.closingLine);
    return lines.slice(0, 5);
  }

  // Partial: already at 5 lines with "Not logged", so no closing line fits.
  const notLogged = input.weekCommitments
    .filter((c) => !input.completedTodayIds.includes(c.id))
    .map((c) => c.label);
  const lines = [header, `${completedCount} of ${totalCount}.`];
  if (xpLine) lines.push(xpLine);
  lines.push(`Not logged: ${notLogged.join(", ")}`);
  lines.push(`Momentum: ${momentumWord}${momentumQualifier(input.momentum)}`);
  return lines.slice(0, 5);
}
