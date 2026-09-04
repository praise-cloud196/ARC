/**
 * Today (the Loop) — milestone-4-spec.md §5, corrected by
 * docs/milestone-4.1-fixes.md §4. One route, three states; and the data
 * each state needs to render.
 */
import type { PoolClient } from "pg";
import {
  LOGICAL_DAY_BOUNDARY_HOUR,
  REPORT_CLOSING_LINE_COOLDOWN_DAYS,
  REPORT_STREAK_LOOKBACK_DAYS,
  XP_TIER_VALUES,
  type XpTier,
} from "./calibration";
import { appendEvent } from "./events";
import { computeLogicalDay, getDisplayHour, getTimezone } from "./logical-day";
import { addDays, daysBetweenInclusive, startOfWeek } from "./day-math";
import { computeIdentity, type Identity } from "./identity";
import { computeCurrentMomentum, getCommitmentsForWeek, type Commitment } from "./commitments";
import { listProbesAwaitingResolution, type Probe } from "./quests";
import type { MomentumResult } from "./momentum";
import { resolveEffectiveEvents, type RawEventRow } from "./effective-events";
import { selectClosingLine, type FactCommitment, type FactCompletion } from "./report-facts";
import {
  computeNightlyReport,
  type NightlyReportInput,
  type ReportCommitment,
  type ReportMark,
} from "./report";
import type { Domain } from "./domains";

export type LoopState = "morning" | "day" | "night";

function localHour(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "2-digit", hour12: false }).formatToParts(
    date
  );
  const hourPart = parts.find((p) => p.type === "hour");
  if (!hourPart) throw new Error(`Could not resolve hour for timezone ${timezone}`);
  const hour = Number(hourPart.value);
  return hour === 24 ? 0 : hour;
}

/**
 * Pure. Night is still purely clock-driven (before the boundary = still
 * last night; at/after the display hour = tonight — milestone-4.1-fixes.md
 * §5: "as already built"). Between those two clock bounds, Morning is not
 * a fixed window (§4: waking at 11:00 under the old 3-hour-from-boundary
 * design meant never seeing Morning at all, the one screen carrying the
 * product's emotional weight) — it's whichever of Morning/Day
 * `alreadyEngagedToday` (already open once today, or already completed
 * something) says it should be. That flag itself is log-derived
 * (`determineLoopState` below), not a second clock rule.
 */
export function selectLoopState(
  now: Date,
  alreadyEngagedToday: boolean,
  timezone: string = getTimezone(),
  displayHour: number = getDisplayHour()
): LoopState {
  const hour = localHour(now, timezone);
  if (hour < LOGICAL_DAY_BOUNDARY_HOUR) return "night"; // still last night, before today's boundary
  if (hour >= displayHour) return "night";
  return alreadyEngagedToday ? "day" : "morning";
}

/** Has today's logical day already seen an app open or a completion — milestone-4.1-fixes.md §4's "first open" / "until the first completion" conditions, both derived from the log rather than stored session state. */
async function hasEngagedToday(client: PoolClient, today: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM events WHERE logical_day = $1 AND type IN ('app.opened', 'commitment.completed') LIMIT 1`,
    [today]
  );
  return result.rows.length > 0;
}

/**
 * Records this visit (self-instrumentation, PRD §22 — never read by XP,
 * momentum, or the nightly report). Idempotency-keyed per logical day, not
 * per visit: what `hasEngagedToday` needs is "did today see an open at
 * all," so a second call the same day is a deliberate no-op, not a second
 * fact worth recording. Call this *after* `determineLoopState` — recording
 * the current visit before checking would make every visit see itself as
 * "already engaged."
 */
export async function recordAppOpened(client: PoolClient, now: Date = new Date()): Promise<void> {
  const timezone = getTimezone();
  const today = computeLogicalDay(now, timezone);
  await appendEvent(client, {
    type: "app.opened",
    occurredAt: now,
    timezone,
    idempotencyKey: `app-opened:${today}`,
  });
}

/** DB-wiring for `selectLoopState` — fetches `alreadyEngagedToday` and calls the pure function. */
export async function determineLoopState(client: PoolClient, now: Date = new Date()): Promise<LoopState> {
  const timezone = getTimezone();
  const today = computeLogicalDay(now, timezone);
  const alreadyEngaged = await hasEngagedToday(client, today);
  return selectLoopState(now, alreadyEngaged, timezone);
}

interface CurrentSeasonRow {
  number: number;
  opened_at: Date;
}

async function getCurrentSeason(client: PoolClient): Promise<CurrentSeasonRow | null> {
  const result = await client.query<CurrentSeasonRow>(
    `SELECT number, opened_at FROM seasons WHERE status = 'open' LIMIT 1`
  );
  return result.rows[0] ?? null;
}

interface MainQuestRow {
  statement: string;
}

/** The earliest-created active Outcome — milestone-4-spec.md doesn't define "main quest" selection beyond this. milestone-5-spec.md doesn't revisit it either (in scope only for Undertakings/Probes themselves); still open for a later milestone. */
async function getMainQuest(client: PoolClient): Promise<string | null> {
  const result = await client.query<MainQuestRow>(
    `SELECT statement FROM quests WHERE kind = 'outcome' AND status = 'active' ORDER BY created_at ASC LIMIT 1`
  );
  return result.rows[0]?.statement ?? null;
}

export interface MorningScreenData {
  identity: Identity;
  momentum: MomentumResult;
  seasonNumber: number | null;
  dayNumber: number | null;
  mainQuest: string | null;
  todaysCommitments: Commitment[];
  /** milestone-5-spec.md §7 / architecture-and-ux-v1.0.md §4.4: a Probe past its decision date stays here, with its resolution actions, until resolved — the one place Morning's "nothing else" rule is already known to bend. */
  probesAwaitingResolution: Probe[];
}

/** Assembles everything the Morning state renders (PRD §12.1). */
export async function computeMorningScreenData(client: PoolClient, now: Date = new Date()): Promise<MorningScreenData> {
  const timezone = getTimezone();
  const today = computeLogicalDay(now, timezone);

  const identity = await computeIdentity(client, now);
  const momentum = await computeCurrentMomentum(client, today);
  const season = await getCurrentSeason(client);
  const mainQuest = await getMainQuest(client);
  const todaysCommitments = await getCommitmentsForWeek(client, startOfWeek(today));
  const probesAwaitingResolution = await listProbesAwaitingResolution(client, today);

  const dayNumber = season
    ? daysBetweenInclusive(computeLogicalDay(season.opened_at, timezone), today)
    : null;

  return {
    identity,
    momentum,
    seasonNumber: season?.number ?? null,
    dayNumber,
    mainQuest,
    todaysCommitments,
    probesAwaitingResolution,
  };
}

function isXpTier(value: unknown): value is XpTier {
  return typeof value === "number" && value in XP_TIER_VALUES;
}

const RAW_EVENT_COLUMNS = "id, type, occurred_at, timezone, domain, subject_id, payload, recorded_at";

/**
 * Effective (corrections-applied, voided-excluded) events of `types` whose
 * *original* falls within [dayStart, dayEnd] — a correction is picked up
 * regardless of its own logical_day, since an edit or void written later
 * (design-revision-v2.md §7.1: records are correctable/voidable any time)
 * must still apply to an original that happened in this window. Narrower
 * than fetchRawEventRows's full-log fetch, for a caller — the nightly
 * report, the closing line — that only needs a bounded window.
 */
async function fetchEffectiveEventsForRange(
  client: PoolClient,
  dayStart: string,
  dayEnd: string,
  types: string[]
) {
  const originals = await client.query<RawEventRow>(
    `SELECT ${RAW_EVENT_COLUMNS} FROM events WHERE logical_day >= $1 AND logical_day <= $2 AND type = ANY($3)`,
    [dayStart, dayEnd, types]
  );
  const ids = originals.rows.map((r) => r.id);
  const corrections = ids.length
    ? await client.query<RawEventRow>(
        `SELECT ${RAW_EVENT_COLUMNS} FROM events WHERE subject_id = ANY($1) AND type = ANY($2)`,
        [ids, types.map((t) => `${t}.corrected`)]
      )
    : { rows: [] as RawEventRow[] };
  return resolveEffectiveEvents([...originals.rows, ...corrections.rows]);
}

/** Assembles lib/report.ts's input from the DB for the current logical day. */
export async function computeNightlyReportData(client: PoolClient, now: Date = new Date()): Promise<NightlyReportInput> {
  const timezone = getTimezone();
  const today = computeLogicalDay(now, timezone);
  const weekStart = startOfWeek(today);

  const season = await getCurrentSeason(client);
  const dayNumber = season ? daysBetweenInclusive(computeLogicalDay(season.opened_at, timezone), today) : 1;

  const weekCommitments = await getCommitmentsForWeek(client, weekStart);
  const reportCommitments: ReportCommitment[] = weekCommitments.map((c) => ({ id: c.id, label: c.label }));

  // Voided rows are already excluded by fetchEffectiveEventsForRange
  // (design-revision-v2.md §7.2: "contributes nothing... to the report"),
  // and an edited Mark's latest note is what shows, not a withdrawn typo.
  const todaysEffective = await fetchEffectiveEventsForRange(client, today, today, [
    "commitment.completed",
    "mark.recorded",
  ]);

  const completedTodayIds = new Set<string>();
  const xpEarnedToday: Record<string, number> = {};
  let mark: ReportMark | null = null;

  for (const event of todaysEffective) {
    if (event.type === "commitment.completed" && event.subjectId) {
      completedTodayIds.add(event.subjectId);
      const tier = event.payload.tier;
      if (event.domain && isXpTier(tier)) {
        xpEarnedToday[event.domain] = (xpEarnedToday[event.domain] ?? 0) + XP_TIER_VALUES[tier];
      }
    }
    if (event.type === "mark.recorded") {
      const note = event.payload.note;
      if (typeof note === "string") mark = { note };
    }
  }

  const momentum = await computeCurrentMomentum(client, today);
  const closingLine = await computeClosingLine(client, today);

  return {
    dayNumber,
    seasonNumber: season?.number ?? 1,
    weekCommitments: reportCommitments,
    completedTodayIds: [...completedTodayIds],
    xpEarnedToday,
    momentum,
    closingLine,
    mark,
    returnAfterGapDays: null,
    returnLoggedLine: null,
  };
}

/**
 * lib/report-facts.ts's `selectClosingLine` needs enough history to
 * evaluate each fact rule both tonight and on every day in its cooldown
 * window (and `streakRecordRule` itself looks back further still), so this
 * fetches REPORT_STREAK_LOOKBACK_DAYS + REPORT_CLOSING_LINE_COOLDOWN_DAYS
 * of commitments/completions — comfortably covering the deepest lookback
 * any rule, evaluated on any cooldown day, could need.
 */
async function computeClosingLine(client: PoolClient, asOfDay: string): Promise<string | null> {
  const horizon = addDays(asOfDay, -(REPORT_STREAK_LOOKBACK_DAYS + REPORT_CLOSING_LINE_COOLDOWN_DAYS));

  const commitmentsResult = await client.query<{ id: string; active_from: string; active_until: string | null }>(
    `SELECT id, active_from, active_until FROM commitments WHERE active_from <= $1 AND (active_until IS NULL OR active_until >= $2)`,
    [asOfDay, horizon]
  );
  const commitments: FactCommitment[] = commitmentsResult.rows.map((row) => ({
    id: row.id,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
  }));

  // Excludes voided completions (design-revision-v2.md §7.2) — a fact rule
  // (lib/report-facts.ts) must not read a withdrawn mis-tap as a real
  // streak day.
  const completionsEffective = await fetchEffectiveEventsForRange(client, horizon, asOfDay, ["commitment.completed"]);
  const completions: FactCompletion[] = completionsEffective
    .filter((e) => e.type === "commitment.completed" && e.subjectId !== null)
    .map((e) => ({
      commitmentId: e.subjectId as string,
      domain: e.domain as Domain,
      logicalDay: e.logicalDay,
    }));

  return selectClosingLine({ commitments, completions, asOfDay });
}

/** Renders tonight's report. */
export async function computeTonightsReport(client: PoolClient, now: Date = new Date()): Promise<string[]> {
  return computeNightlyReport(await computeNightlyReportData(client, now));
}

/**
 * Shape a `CommitmentRow` needs to render — structurally identical to (and
 * interchangeable with) app/components/CommitmentRow.tsx's own
 * `CommitmentRowData`; defined here instead of imported from it since lib/
 * doesn't reach into app/.
 */
export interface TodaysCommitmentRow {
  id: string;
  label: string;
  completionEventId: string | null;
  resistance: string | null;
}

/**
 * Today's commitment rows, current logical day only — the data the Day
 * state renders, and (docs/night-access-fix.md §2) what Night's "log
 * something from today" disclosure reveals too, so both call this one
 * function rather than keep two copies of the same completion-folding
 * logic in sync.
 */
export async function computeTodaysCommitmentRows(client: PoolClient, now: Date = new Date()): Promise<TodaysCommitmentRow[]> {
  const timezone = getTimezone();
  const today = computeLogicalDay(now, timezone);
  const weekStart = startOfWeek(today);
  const weekCommitments = await getCommitmentsForWeek(client, weekStart);

  // Today's raw rows only (not the whole log — this isn't the multi-value
  // identity computation lib/effective-events.ts's fetchRawEventRows is
  // meant for), folded the same way so a resistance/note correction is
  // reflected even though the original commitment.completed write never
  // had them.
  const todaysRows = await client.query<RawEventRow>(
    `SELECT id, type, occurred_at, timezone, domain, subject_id, payload, recorded_at
     FROM events WHERE logical_day = $1 AND type IN ('commitment.completed', 'commitment.completed.corrected')`,
    [today]
  );
  const effective = resolveEffectiveEvents(todaysRows.rows);
  const effectiveById = new Map(effective.map((e) => [e.id, e]));
  // subject_id (which commitment this completion belongs to) lives on the
  // raw original row — effective events don't carry it, since
  // resolveEffectiveEvents's shape is generic across every event type.
  const originalIdByCommitmentId = new Map(
    todaysRows.rows.filter((r) => r.type === "commitment.completed").map((r) => [r.subject_id, r.id])
  );

  return weekCommitments.map((c) => {
    const originalId = originalIdByCommitmentId.get(c.id);
    const completion = originalId ? effectiveById.get(originalId) : undefined;
    // A voided completion (design-revision-v2.md §7) reads as not
    // completed — the row goes back to offering Complete, not stuck on
    // Done. The original event id is still real (never removed), just not
    // surfaced as "the current completion" here.
    const voided = completion?.payload.voided === true;
    const resistance = completion?.payload.resistance;
    return {
      id: c.id,
      label: c.label,
      completionEventId: voided ? null : (originalId ?? null),
      resistance: voided || typeof resistance !== "string" ? null : resistance,
    };
  });
}
