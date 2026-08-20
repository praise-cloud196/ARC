/**
 * Today (the Loop) — milestone-4-spec.md §5. One route, three states
 * selected by clock time relative to the logical day boundary and the
 * user's display-hour preference; and the data each state needs to render.
 */
import type { PoolClient } from "pg";
import { LOGICAL_DAY_BOUNDARY_HOUR, MORNING_WINDOW_HOURS } from "./calibration";
import { computeLogicalDay, getDisplayHour, getTimezone } from "./logical-day";
import { daysBetweenInclusive } from "./day-math";
import { computeIdentity, type Identity } from "./identity";
import { computeCurrentMomentum, getCommitmentsForWeek, type Commitment } from "./commitments";
import { startOfWeek } from "./day-math";
import type { MomentumResult } from "./momentum";
import {
  computeNightlyReport,
  type NightlyReportInput,
  type ReportCommitment,
  type ReportMark,
} from "./report";
import { XP_TIER_VALUES, type XpTier } from "./calibration";

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

/** Pure given `now`'s local hour. */
export function selectLoopState(now: Date, timezone: string = getTimezone(), displayHour: number = getDisplayHour()): LoopState {
  const hour = localHour(now, timezone);
  const morningEnd = (LOGICAL_DAY_BOUNDARY_HOUR + MORNING_WINDOW_HOURS) % 24;

  if (hour < LOGICAL_DAY_BOUNDARY_HOUR) return "night"; // still last night, before today's boundary
  if (hour < morningEnd) return "morning";
  if (hour < displayHour) return "day";
  return "night";
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

/** The earliest-created active Outcome — milestone-4-spec.md doesn't define "main quest" selection beyond this; a fuller rule arrives with milestone 5's Undertakings/Probes. */
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
  };
}

function isXpTier(value: unknown): value is XpTier {
  return typeof value === "number" && value in XP_TIER_VALUES;
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

  const todaysEvents = await client.query<{ type: string; subject_id: string | null; domain: string | null; payload: Record<string, unknown> }>(
    `SELECT type, subject_id, domain, payload FROM events WHERE logical_day = $1`,
    [today]
  );

  const completedTodayIds = new Set<string>();
  const xpEarnedToday: Record<string, number> = {};
  let mark: ReportMark | null = null;

  for (const row of todaysEvents.rows) {
    if (row.type === "commitment.completed" && row.subject_id) {
      completedTodayIds.add(row.subject_id);
      const tier = row.payload.tier;
      if (row.domain && isXpTier(tier)) {
        xpEarnedToday[row.domain] = (xpEarnedToday[row.domain] ?? 0) + XP_TIER_VALUES[tier];
      }
    }
    if (row.type === "mark.recorded") {
      const note = row.payload.note;
      if (typeof note === "string") mark = { note };
    }
  }

  const momentum = await computeCurrentMomentum(client, today);

  return {
    dayNumber,
    seasonNumber: season?.number ?? 1,
    logicalDay: today,
    weekCommitments: reportCommitments,
    completedTodayIds: [...completedTodayIds],
    xpEarnedToday,
    momentum,
    mark,
    returnAfterGapDays: null,
    returnLoggedLine: null,
  };
}

/** Renders tonight's report. */
export async function computeTonightsReport(client: PoolClient, now: Date = new Date()): Promise<string[]> {
  return computeNightlyReport(await computeNightlyReportData(client, now));
}
