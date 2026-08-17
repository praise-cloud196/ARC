/**
 * Logical day computation (architecture-and-ux-v1.0.md §2.5).
 *
 * A logical day boundary at 04:00 local time — a session logged at 1am
 * belongs to the previous day. This is a timekeeping rule, not a
 * progression calibration constant, so it does not live in
 * lib/calibration.ts (AGENTS.md hard rule 4 governs XP/level/momentum/etc,
 * not clock semantics).
 */
const LOGICAL_DAY_BOUNDARY_HOUR = 4;

export function getTimezone(): string {
  return process.env.ARC_TIMEZONE ?? "America/New_York";
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
