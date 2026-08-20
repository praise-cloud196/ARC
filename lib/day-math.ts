/**
 * Arithmetic on logical-day strings ('YYYY-MM-DD'), shared by
 * lib/momentum.ts and lib/dormancy.ts. Treated as plain calendar dates in
 * UTC — logical_day is already a timezone-resolved calendar day
 * (lib/logical-day.ts), so this never needs to re-interpret a timezone.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(day: string): number {
  const parts = day.split("-").map(Number);
  const [y, m, d] = parts;
  if (parts.length !== 3 || y === undefined || m === undefined || d === undefined) {
    throw new Error(`Not a logical day string: ${day}`);
  }
  return Date.UTC(y, m - 1, d);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  return formatDay(parseDay(day) + delta * DAY_MS);
}

/** Number of days from `fromDay` to `toDay` (positive if `toDay` is later). */
export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((parseDay(toDay) - parseDay(fromDay)) / DAY_MS);
}

/** Count of days in [startDay, endDay], inclusive of both ends. */
export function daysBetweenInclusive(startDay: string, endDay: string): number {
  return daysBetween(startDay, endDay) + 1;
}

/**
 * The Monday (ISO week start) of the week containing `day`
 * (milestone-4-spec.md §3 — the commitments weekly-lock convention).
 */
export function startOfWeek(day: string): string {
  const ms = parseDay(day);
  const isoWeekday = new Date(ms).getUTCDay() || 7; // Sun=0 -> 7, so Mon=1..Sun=7
  return formatDay(ms - (isoWeekday - 1) * DAY_MS);
}

/**
 * A stable, monotonically increasing index for `day` (days since an
 * arbitrary fixed epoch). Used to deterministically rotate the nightly
 * report's closing framing line (lib/report.ts) without storing which line
 * was shown on which day — consecutive calendar days always get
 * consecutive indices, so cycling a same-condition variant set of at least
 * 7 entries by this index modulo its length can never repeat within 7 days.
 */
export function dayIndex(day: string): number {
  return daysBetween("2020-01-06", day); // an arbitrary Monday; only the stride matters
}
