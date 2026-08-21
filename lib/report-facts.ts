/**
 * The nightly report's closing framing line (milestone-4.1-fixes.md §3,
 * correcting lib/report.ts's original rotating-pool design). PRD §12.3
 * requires the line be "omitted when nothing true can be said" and its own
 * worked example — "Three of the last five days ran clean" — is a computed
 * statement about the log, not a stock phrase. A rotating pool of generic
 * encouragement is precisely the "wallpaper within a fortnight" failure the
 * five-line budget exists to prevent, and it's the product speaking without
 * knowing anything, the opposite of its only real power.
 *
 * Each rule below is a pure function over a bounded window of commitments
 * and completions: it either states a true, specific fact or returns null.
 * `selectClosingLine` tries them in priority order and skips any rule whose
 * condition has also held on any of the last REPORT_CLOSING_LINE_COOLDOWN_DAYS
 * days — the seven-day non-repetition rule applies to *rules*, not exact
 * wording (a rule's sentence can vary night to night with the data; the
 * rule itself still needs to cool down). If no rule survives, there is no
 * closing line — silence, and that's expected to be the common case (PRD
 * §12.3, milestone-4.1-fixes.md §3: "a report that is silent four nights
 * out of seven is working as designed").
 */
import { addDays, daysBetween } from "./day-math";
import {
  REPORT_CLEAN_STREAK_MIN,
  REPORT_CLEAN_STREAK_WINDOW_DAYS,
  REPORT_CLOSING_LINE_COOLDOWN_DAYS,
  REPORT_DOMAIN_QUIET_THRESHOLD_DAYS,
  REPORT_STREAK_LOOKBACK_DAYS,
  REPORT_STREAK_RECORD_MIN,
} from "./calibration";
import type { Domain } from "./domains";

export interface FactCommitment {
  id: string;
  /** Inclusive logical day this commitment became active. */
  activeFrom: string;
  /** Inclusive logical day this commitment stopped being active, or null if still active. */
  activeUntil: string | null;
}

export interface FactCompletion {
  commitmentId: string;
  domain: Domain;
  /** Logical day the completion counts toward. */
  logicalDay: string;
}

export interface ClosingLineContext {
  /** Every commitment whose active window could overlap the lookback horizon — not just the current week's. */
  commitments: FactCommitment[];
  /** Every completion within the lookback horizon. */
  completions: FactCompletion[];
  asOfDay: string;
}

function commitmentsActiveOn(commitments: FactCommitment[], day: string): FactCommitment[] {
  return commitments.filter((c) => c.activeFrom <= day && (c.activeUntil === null || c.activeUntil >= day));
}

/** A day is clean if every commitment active on it was completed at least once that day. Vacuously clean if none were active. */
function isDayClean(commitments: FactCommitment[], completedIdsByDay: Map<string, Set<string>>, day: string): boolean {
  const active = commitmentsActiveOn(commitments, day);
  if (active.length === 0) return true;
  const completedToday = completedIdsByDay.get(day);
  if (!completedToday) return false;
  return active.every((c) => completedToday.has(c.id));
}

function groupCompletionIdsByDay(completions: FactCompletion[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const completion of completions) {
    let ids = map.get(completion.logicalDay);
    if (!ids) {
      ids = new Set();
      map.set(completion.logicalDay, ids);
    }
    ids.add(completion.commitmentId);
  }
  return map;
}

export interface ClosingLineRule {
  id: string;
  evaluate(ctx: ClosingLineContext): string | null;
}

/** "N of the last M days ran clean." — the PRD's own worked example, now computed rather than quoted. */
export const cleanStreakRule: ClosingLineRule = {
  id: "clean_streak",
  evaluate({ commitments, completions, asOfDay }) {
    const completedIdsByDay = groupCompletionIdsByDay(completions);
    let clean = 0;
    for (let i = 0; i < REPORT_CLEAN_STREAK_WINDOW_DAYS; i++) {
      if (isDayClean(commitments, completedIdsByDay, addDays(asOfDay, -i))) clean++;
    }
    if (clean < REPORT_CLEAN_STREAK_MIN) return null;
    return `${clean} of the last ${REPORT_CLEAN_STREAK_WINDOW_DAYS} days ran clean.`;
  },
};

/** "First {Domain} completion in N days." — the domain with the largest gap among today's completions, if any gap clears the threshold. */
export const domainQuietBrokenRule: ClosingLineRule = {
  id: "domain_quiet_broken",
  evaluate({ completions, asOfDay }) {
    const todaysDomains = new Set(
      completions.filter((c) => c.logicalDay === asOfDay).map((c) => c.domain)
    );

    let best: { domain: Domain; gap: number } | null = null;
    for (const domain of todaysDomains) {
      const priorDays = completions
        .filter((c) => c.domain === domain && c.logicalDay < asOfDay)
        .map((c) => c.logicalDay)
        .sort();
      const lastPrior = priorDays[priorDays.length - 1];
      const gap = lastPrior ? daysBetween(lastPrior, asOfDay) : REPORT_STREAK_LOOKBACK_DAYS;
      if (gap >= REPORT_DOMAIN_QUIET_THRESHOLD_DAYS && (!best || gap > best.gap)) {
        best = { domain, gap };
      }
    }
    if (!best) return null;
    const label = best.domain.charAt(0).toUpperCase() + best.domain.slice(1);
    return `First ${label} completion in ${best.gap} days.`;
  },
};

/** "Longest run of complete days so far: N." — fires only when today's streak exceeds every other streak within the lookback window. */
export const streakRecordRule: ClosingLineRule = {
  id: "streak_record",
  evaluate({ commitments, completions, asOfDay }) {
    if (commitments.length === 0) return null; // nothing has ever been declared; no streak concept applies

    // isDayClean is vacuously true for a day with no active commitments —
    // right for a deliberate rest day, wrong for "before any commitment
    // ever existed": without this floor, both loops below would wander
    // into that pre-history and count it as an arbitrarily long streak.
    const earliestStart = commitments.reduce(
      (min, c) => (c.activeFrom < min ? c.activeFrom : min),
      commitments[0]!.activeFrom
    );
    const completedIdsByDay = groupCompletionIdsByDay(completions);

    let current = 0;
    while (current < REPORT_STREAK_LOOKBACK_DAYS) {
      const day = addDays(asOfDay, -current);
      if (day < earliestStart || !isDayClean(commitments, completedIdsByDay, day)) break;
      current++;
    }
    if (current < REPORT_STREAK_RECORD_MIN) return null;

    const currentStreakStart = addDays(asOfDay, -(current - 1));
    let longestPrior = 0;
    let running = 0;
    for (let i = 1; i <= REPORT_STREAK_LOOKBACK_DAYS; i++) {
      const day = addDays(currentStreakStart, -i);
      if (day < earliestStart) break;
      if (isDayClean(commitments, completedIdsByDay, day)) {
        running++;
        longestPrior = Math.max(longestPrior, running);
      } else {
        running = 0;
      }
    }
    if (current <= longestPrior) return null;
    return `Longest run of complete days so far: ${current}.`;
  },
};

/** Priority order: tried top to bottom, first eligible (fires tonight and hasn't fired within the cooldown) wins. */
export const CLOSING_LINE_RULES: ClosingLineRule[] = [cleanStreakRule, domainQuietBrokenRule, streakRecordRule];

/** Pure. Returns tonight's closing line, or null if no rule is both firing and off cooldown — silence, and that's fine. */
export function selectClosingLine(ctx: ClosingLineContext): string | null {
  for (const rule of CLOSING_LINE_RULES) {
    const tonight = rule.evaluate(ctx);
    if (!tonight) continue;

    let firedRecently = false;
    for (let i = 1; i <= REPORT_CLOSING_LINE_COOLDOWN_DAYS; i++) {
      const pastDay = addDays(ctx.asOfDay, -i);
      if (rule.evaluate({ ...ctx, asOfDay: pastDay })) {
        firedRecently = true;
        break;
      }
    }
    if (!firedRecently) return tonight;
  }
  return null;
}
