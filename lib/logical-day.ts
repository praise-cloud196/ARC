/**
 * Logical day computation (architecture-and-ux-v1.0.md §2.5).
 *
 * A logical day boundary at `LOGICAL_DAY_BOUNDARY_HOUR` local time — a
 * session logged before that hour belongs to the previous day. The boundary
 * hour lives in lib/calibration.ts, not here: it buckets days, and day
 * buckets feed momentum, which makes it a tunable calibration value rather
 * than fixed clock semantics (AGENTS.md hard rule 4,
 * milestone-1.1-fixes.md item 5).
 */
import { LOGICAL_DAY_BOUNDARY_HOUR } from "./calibration";

/**
 * The configured timezone. Throws if unset rather than guessing — a wrong
 * guess would mislabel every logical_day permanently, since events are
 * append-only and logical_day is derived from this at write time
 * (milestone-1.1-fixes.md item 3).
 */
export function getTimezone(): string {
  const tz = process.env.ARC_TIMEZONE;
  if (!tz) {
    throw new Error(
      "ARC_TIMEZONE is not set. There is no default: a wrong guess would " +
        "mislabel every logical_day permanently. Set it in .env.local."
    );
  }
  return tz;
}

/** Returns the logical day for `occurredAt` as a 'YYYY-MM-DD' string. */
export function computeLogicalDay(occurredAt: Date, timeZone: string = getTimezone()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(occurredAt);

  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Could not resolve ${type} for timezone ${timeZone}`);
    return Number(part.value);
  };

  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = get("hour");
  // Some runtimes render local midnight as "24" even with hour12: false.
  if (hour === 24) hour = 0;

  const localDate = new Date(Date.UTC(year, month - 1, day));
  if (hour < LOGICAL_DAY_BOUNDARY_HOUR) {
    localDate.setUTCDate(localDate.getUTCDate() - 1);
  }

  const isoDate = localDate.toISOString().slice(0, 10);
  return isoDate;
}
