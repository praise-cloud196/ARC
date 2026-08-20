/**
 * Baseline audit orchestration (milestone-3-spec.md §2, §6, §7). Backend
 * only — no wizard UI exists yet (that's a future milestone); this module
 * is what such a UI would call.
 *
 * Resumability (§2, §7) needs no draft/staging state of its own: each step
 * writes directly via lib/notes.ts, lib/marks.ts, lib/metrics.ts,
 * lib/stances.ts, lib/quests.ts, lib/seasons.ts as it completes, so "what's
 * left" is always answerable by reading what's already in the log —
 * `getAuditProgress` below is that read. A wizard closed at step 4 has
 * genuinely recorded steps 1-3, because there was never anywhere else for
 * those writes to have gone.
 */
import type { PoolClient } from "pg";
import { appendEvent, type AppendedEvent } from "./events";
import { getTimezone } from "./logical-day";
import { DOMAINS, type Domain } from "./domains";
import { domainsWithNotes } from "./notes";
import { retroactiveMarkStats, type RetroactiveMarkStats } from "./marks";
import { countMetrics } from "./metrics";
import { getAllStancesForManagement } from "./stances";
import { listOutcomes } from "./quests";
import { AUDIT_MIN_RETROACTIVE_MARKS, type Rank } from "./calibration";
import { computeProposedStartingRank, rankIndex } from "./rank";

export interface AuditProgress {
  /** Step 1: complete once this covers all of DOMAINS (all four, including unscored `life`). */
  domainsWithNotes: Domain[];
  /** Step 2: gates steps 3-6 at AUDIT_MIN_RETROACTIVE_MARKS. */
  retroactiveMarks: RetroactiveMarkStats;
  /** Step 3: open-ended by design (user-defined metrics) — a count, not a completion flag. */
  metricsRecorded: number;
  /** Step 4: open-ended (user chooses how many behaviours to name), not_now included — this is the audit's own progress check, not a surface subject to AGENTS.md hard rule 10. */
  stancesNamed: number;
  /** Step 5: PRD §11 — exactly three 2027 statements. */
  outcomesRecorded: number;
  /** Step 6. */
  seasonOpened: boolean;
  /** — completion. */
  completed: boolean;
}

export async function getAuditProgress(client: PoolClient): Promise<AuditProgress> {
  // Sequential, not Promise.all: a single PoolClient is one physical
  // connection, and node-postgres doesn't support overlapping concurrent
  // queries on it — issuing several at once is deprecated and silently
  // serializes anyway, so there's no real parallelism to gain here.
  const domains = await domainsWithNotes(client);
  const marks = await retroactiveMarkStats(client);
  const metrics = await countMetrics(client);
  const stances = await getAllStancesForManagement(client);
  const outcomes = await listOutcomes(client);
  const season = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM seasons WHERE status = 'open') AS exists`
  );
  const completed = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM events WHERE type = 'audit.completed') AS exists`
  );

  return {
    domainsWithNotes: domains,
    retroactiveMarks: marks,
    metricsRecorded: metrics,
    stancesNamed: stances.length,
    outcomesRecorded: outcomes.length,
    seasonOpened: season.rows[0]?.exists ?? false,
    completed: completed.rows[0]?.exists ?? false,
  };
}

/** All four DOMAINS have at least one note.recorded — step 1 complete. */
export async function isDomainSelfAssessmentComplete(client: PoolClient): Promise<boolean> {
  const covered = new Set(await domainsWithNotes(client));
  return DOMAINS.every((domain) => covered.has(domain));
}

export interface CompleteAuditInput {
  /** Must be at or below the system's proposal (milestone-3-spec.md §6 — adjust down, never up). */
  startingRank: Rank;
  occurredAt?: Date;
  timezone?: string;
}

/**
 * Writes `audit.completed`, marking onboarding's end. Gated on the
 * retroactive-Marks minimum as defense in depth — lib/quests.ts,
 * lib/seasons.ts and lib/stances.ts already gate every step after Marks, so
 * this should be unreachable in practice, but a read path being wrong is
 * exactly the failure mode AGENTS.md hard rule 13 exists to close off, and
 * the same applies to a write path with more than one caller.
 * db/migrations/0006_baseline_audit.sql's events_audit_completed_once CHECK
 * is the real, unbypassable enforcement of "written once" and of the
 * rank-cap/never-up rule; the checks here exist to fail with a clear
 * message instead of a raw constraint-violation error.
 */
export async function completeAudit(client: PoolClient, input: CompleteAuditInput): Promise<AppendedEvent> {
  const alreadyCompleted = await client.query(`SELECT 1 FROM events WHERE type = 'audit.completed' LIMIT 1`);
  if (alreadyCompleted.rows.length > 0) {
    throw new Error("The audit has already been completed.");
  }

  const stats = await retroactiveMarkStats(client);
  if (stats.count < AUDIT_MIN_RETROACTIVE_MARKS) {
    throw new Error(
      `Cannot complete the audit before ${AUDIT_MIN_RETROACTIVE_MARKS} retroactive Marks are logged ` +
        `(have ${stats.count}).`
    );
  }

  const proposal = await computeProposedStartingRank(client);
  if (rankIndex(input.startingRank) > rankIndex(proposal.rank)) {
    throw new Error(
      `Starting rank cannot be adjusted above the proposed rank (${proposal.rank}); got ${input.startingRank}.`
    );
  }

  return appendEvent(client, {
    type: "audit.completed",
    occurredAt: input.occurredAt ?? new Date(),
    payload: { proposedRank: proposal.rank, startingRank: input.startingRank },
    timezone: input.timezone ?? getTimezone(),
  });
}
