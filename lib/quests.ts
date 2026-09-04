/**
 * Quests — milestone 3 covered only kind `outcome` (milestone-3-spec.md §2
 * step 5, the three 2027 statements). Undertaking and Probe are milestone 5
 * (docs/milestone-5-spec.md); both are Career-only in v1 (§0) — every event
 * either kind writes carries `domain: 'career'`, and neither creation form
 * takes a domain.
 *
 * `quests` is a direction table (architecture-and-ux-v1.0.md §2.3): current
 * state, freely editable, no append-only trigger. `quest.created`'s
 * `subject_id` points at the row it created — the same convention
 * lib/attention-events.ts already established for `stance.changed` before
 * the `stances` table existed.
 */
import type { Pool, PoolClient } from "pg";
import { appendCorrection, appendEvent, type AppendedEvent } from "./events";
import { computeLogicalDay, getTimezone } from "./logical-day";
import { recordMark, retroactiveMarkStats } from "./marks";
import { AUDIT_MIN_RETROACTIVE_MARKS, type XpTier } from "./calibration";
import type { Domain } from "./domains";

type Queryable = Pool | PoolClient;

/** milestone-5-spec.md §0: the only domain Undertakings/Probes ever write. */
const QUEST_DOMAIN: Domain = "career";

export interface Outcome {
  id: string;
  statement: string;
  status: "active" | "achieved" | "abandoned";
  createdAt: Date;
}

export interface RecordOutcomeInput {
  statement: string;
  occurredAt?: Date;
  timezone?: string;
}

/**
 * Records one of the three 2027 statements as a top-level Outcome. Gated on
 * the retroactive-Marks minimum (milestone-3-spec.md §3 / §7 — "the user
 * cannot skip past this step"), the same guard lib/seasons.ts's
 * `openSeason` and lib/stances.ts's `setStance` apply, since all three
 * belong to audit steps after retroactive Marks.
 */
export async function recordOutcome(client: PoolClient, input: RecordOutcomeInput): Promise<AppendedEvent> {
  const stats = await retroactiveMarkStats(client);
  if (stats.count < AUDIT_MIN_RETROACTIVE_MARKS) {
    throw new Error(
      `Cannot record an Outcome before ${AUDIT_MIN_RETROACTIVE_MARKS} retroactive Marks are logged ` +
        `(have ${stats.count}).`
    );
  }

  const inserted = await client.query<{ id: string; created_at: Date }>(
    `INSERT INTO quests (kind, statement) VALUES ('outcome', $1) RETURNING id, created_at`,
    [input.statement]
  );
  const row = inserted.rows[0];
  if (!row) throw new Error("Failed to insert quests row.");

  return appendEvent(client, {
    type: "quest.created",
    occurredAt: input.occurredAt ?? new Date(),
    subjectId: row.id,
    payload: { kind: "outcome", statement: input.statement },
    timezone: input.timezone ?? getTimezone(),
  });
}

export async function listOutcomes(client: Queryable): Promise<Outcome[]> {
  const result = await client.query<{ id: string; statement: string; status: Outcome["status"]; created_at: Date }>(
    `SELECT id, statement, status, created_at FROM quests WHERE kind = 'outcome' ORDER BY created_at ASC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    statement: row.statement,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export interface AchieveOutcomeInput {
  outcomeId: string;
  /** The Mark this always produces (PRD §13: "On achievement, converts to a Mark") needs a domain, the same as any other Mark, even though Outcomes themselves aren't domain-scoped. */
  domain: Domain;
  /** "What changed because of this?" — required, same as any Mark (PRD §14). */
  note: string;
  artifact?: string;
  occurredAt?: Date;
  timezone?: string;
}

/** milestone-5-spec.md §5: sets the Outcome achieved, writes `outcome.achieved` (the "major history event"), and always writes the accompanying Mark — unlike an Undertaking's, this one isn't optional. */
export async function achieveOutcome(client: Queryable, input: AchieveOutcomeInput): Promise<AppendedEvent> {
  const updated = await client.query(
    `UPDATE quests SET status = 'achieved' WHERE id = $1 AND kind = 'outcome' AND status = 'active' RETURNING id`,
    [input.outcomeId]
  );
  if (updated.rows.length === 0) {
    throw new Error(`No active outcome found with id ${input.outcomeId}`);
  }

  const timezone = input.timezone ?? getTimezone();
  const occurredAt = input.occurredAt ?? new Date();

  await recordMark(client, {
    domain: input.domain,
    note: input.note,
    artifact: input.artifact,
    sourceQuestId: input.outcomeId,
    occurredAt,
    timezone,
  });

  return appendEvent(client, {
    type: "outcome.achieved",
    occurredAt,
    subjectId: input.outcomeId,
    payload: {},
    timezone,
  });
}

export interface AbandonQuestInput {
  questId: string;
  note?: string;
  occurredAt?: Date;
  timezone?: string;
}

/**
 * Generic across all three kinds (architecture-and-ux-v1.0.md §9:
 * "Abandoning a quest appends an abandonment event; it never removes the
 * quest... from the record"). Only moves a quest out of 'active' — an
 * already-terminal quest (achieved/completed/folded/abandoned) can't be
 * abandoned again.
 */
export async function abandonQuest(client: Queryable, input: AbandonQuestInput): Promise<AppendedEvent> {
  const updated = await client.query(
    `UPDATE quests SET status = 'abandoned' WHERE id = $1 AND status = 'active' RETURNING id`,
    [input.questId]
  );
  if (updated.rows.length === 0) {
    throw new Error(`No active quest found with id ${input.questId}`);
  }

  const payload: Record<string, unknown> = {};
  if (input.note !== undefined) payload.note = input.note;

  return appendEvent(client, {
    type: "quest.abandoned",
    occurredAt: input.occurredAt ?? new Date(),
    subjectId: input.questId,
    payload,
    timezone: input.timezone ?? getTimezone(),
  });
}

// --- Undertakings (milestone-5-spec.md §3) ----------------------------------

export interface Undertaking {
  id: string;
  statement: string;
  status: "active" | "completed" | "abandoned";
  stepCount: number;
  createdAt: Date;
}

export interface CreateUndertakingInput {
  statement: string;
  occurredAt?: Date;
  timezone?: string;
}

/** Max 3 active, enforced by db/migrations/0010_undertakings_probes.sql's trigger — a caller over the limit sees that trigger's Postgres error, not a friendlier one duplicated here. */
export async function createUndertaking(client: Queryable, input: CreateUndertakingInput): Promise<AppendedEvent> {
  const inserted = await client.query<{ id: string; created_at: Date }>(
    `INSERT INTO quests (kind, statement) VALUES ('undertaking', $1) RETURNING id, created_at`,
    [input.statement]
  );
  const row = inserted.rows[0];
  if (!row) throw new Error("Failed to insert quests row.");

  return appendEvent(client, {
    type: "quest.created",
    occurredAt: input.occurredAt ?? new Date(),
    subjectId: row.id,
    domain: QUEST_DOMAIN,
    payload: { kind: "undertaking", statement: input.statement },
    timezone: input.timezone ?? getTimezone(),
  });
}

/** Every Undertaking, with its (non-voided) step count — milestone-5-spec.md §7's Quests screen. */
export async function listUndertakings(client: Queryable): Promise<Undertaking[]> {
  const result = await client.query<{
    id: string;
    statement: string;
    status: Undertaking["status"];
    created_at: Date;
    step_count: string;
  }>(
    `SELECT q.id, q.statement, q.status, q.created_at,
            count(s.id) FILTER (
              WHERE NOT EXISTS (
                SELECT 1 FROM events c
                WHERE c.type = 'quest.step_completed.corrected' AND c.subject_id = s.id AND c.payload->>'voided' = 'true'
              )
            ) AS step_count
     FROM quests q
     LEFT JOIN events s ON s.type = 'quest.step_completed' AND s.subject_id = q.id
     WHERE q.kind = 'undertaking'
     GROUP BY q.id
     ORDER BY q.created_at ASC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    statement: row.statement,
    status: row.status,
    stepCount: Number(row.step_count),
    createdAt: row.created_at,
  }));
}

export interface AddUndertakingStepInput {
  undertakingId: string;
  tier: XpTier;
  occurredAt?: Date;
  timezone?: string;
}

/** Steps are not a pre-declared checklist (milestone-5-spec.md §1) — each is its own `quest.step_completed`, "ordered" only in the sense of the log's own append order. Awards XP to `career` (lib/xp.ts's XP_EVENT_TYPES already includes this type). */
export async function addUndertakingStep(client: Queryable, input: AddUndertakingStepInput): Promise<AppendedEvent> {
  const found = await client.query(
    `SELECT 1 FROM quests WHERE id = $1 AND kind = 'undertaking' AND status = 'active'`,
    [input.undertakingId]
  );
  if (found.rows.length === 0) {
    throw new Error(`No active undertaking found with id ${input.undertakingId}`);
  }

  return appendEvent(client, {
    type: "quest.step_completed",
    occurredAt: input.occurredAt ?? new Date(),
    subjectId: input.undertakingId,
    domain: QUEST_DOMAIN,
    payload: { tier: input.tier },
    timezone: input.timezone ?? getTimezone(),
  });
}

export interface VoidUndertakingStepInput {
  stepEventId: string;
  occurredAt?: Date;
  timezone?: string;
}

/** Conduct, voidable same logical day only — the same rule and reasoning as lib/commitments.ts's `voidCommitmentCompletion` (design-revision-v2.md §7.1). */
export async function voidUndertakingStep(client: Queryable, input: VoidUndertakingStepInput): Promise<AppendedEvent> {
  const original = await client.query<{ logical_day: string }>(
    `SELECT logical_day FROM events WHERE id = $1 AND type = 'quest.step_completed'`,
    [input.stepEventId]
  );
  const originalRow = original.rows[0];
  if (!originalRow) {
    throw new Error(`No quest.step_completed event found with id ${input.stepEventId}`);
  }

  const timezone = input.timezone ?? getTimezone();
  const now = input.occurredAt ?? new Date();
  const today = computeLogicalDay(now, timezone);
  if (originalRow.logical_day !== today) {
    throw new Error("A step completion can only be undone on the day it happened.");
  }

  return appendCorrection(client, {
    correctsType: "quest.step_completed",
    correctsEventId: input.stepEventId,
    payload: { voided: true },
    occurredAt: now,
    timezone,
  });
}

export interface CompleteUndertakingInput {
  undertakingId: string;
  /** Optional — "Completion may generate a Mark" (PRD §13), not always. Filling this in is what generates one. */
  note?: string;
  artifact?: string;
  occurredAt?: Date;
  timezone?: string;
}

/** Closes the Undertaking out. A discrete action, not implied by adding a step — see milestone-5-spec.md §3 for why no new event type marks this beyond the status transition itself. */
export async function completeUndertaking(client: Queryable, input: CompleteUndertakingInput): Promise<void> {
  const updated = await client.query(
    `UPDATE quests SET status = 'completed' WHERE id = $1 AND kind = 'undertaking' AND status = 'active' RETURNING id`,
    [input.undertakingId]
  );
  if (updated.rows.length === 0) {
    throw new Error(`No active undertaking found with id ${input.undertakingId}`);
  }

  if (input.note !== undefined && input.note.trim() !== "") {
    await recordMark(client, {
      domain: QUEST_DOMAIN,
      note: input.note,
      artifact: input.artifact,
      sourceQuestId: input.undertakingId,
      occurredAt: input.occurredAt,
      timezone: input.timezone,
    });
  }
}

// --- Probes (milestone-5-spec.md §4) ----------------------------------------

export type ProbeResolutionAction = "double_down" | "fold" | "extend";

export interface Probe {
  id: string;
  statement: string;
  status: "active" | "folded" | "abandoned";
  decisionDate: string;
  signal: string;
  createdAt: Date;
  /** True once `decisionDate` has passed with no resolution recorded since — milestone-5-spec.md §4. */
  needsResolution: boolean;
}

export interface CreateProbeInput {
  statement: string;
  /** ISO date (YYYY-MM-DD). Required, never optional — PRD §13. */
  decisionDate: string;
  signal: string;
  occurredAt?: Date;
  timezone?: string;
}

/** Max 2 active, enforced by the same trigger as Undertakings. Decision date and signal are both blocking at creation (PRD §13) — the CHECK in 0010 rejects a probe row missing either. */
export async function createProbe(client: Queryable, input: CreateProbeInput): Promise<AppendedEvent> {
  if (input.signal.trim() === "") {
    throw new Error("A Probe's signal is required.");
  }

  const inserted = await client.query<{ id: string; created_at: Date }>(
    `INSERT INTO quests (kind, statement, decision_date, signal) VALUES ('probe', $1, $2, $3) RETURNING id, created_at`,
    [input.statement, input.decisionDate, input.signal]
  );
  const row = inserted.rows[0];
  if (!row) throw new Error("Failed to insert quests row.");

  return appendEvent(client, {
    type: "quest.created",
    occurredAt: input.occurredAt ?? new Date(),
    subjectId: row.id,
    domain: QUEST_DOMAIN,
    payload: { kind: "probe", statement: input.statement, decisionDate: input.decisionDate, signal: input.signal },
    timezone: input.timezone ?? getTimezone(),
  });
}

interface ProbeRow {
  id: string;
  statement: string;
  status: Probe["status"];
  decision_date: string;
  signal: string;
  created_at: Date;
  needs_resolution: boolean;
}

/**
 * "Needs resolution" is decided by event *order*, not calendar-date
 * comparison. An earlier version compared \`probe.resolved.recorded_at::date
 * >= decision_date\` directly — that broke the instant an extend's own
 * write time (real wall-clock \`recorded_at\`, always "now") was on or
 * after the very decision_date it had just set, which happens any time
 * \`newDecisionDate\` isn't safely in the future relative to the moment
 * of extending (caught by tests/milestone-5-quests.test.ts's extend test:
 * the fixture's "future" date had been overtaken by the real calendar
 * during a long session). Comparing against the most recent event that
 * *set* the current decision_date (creation, or the latest extend) is
 * immune to that: a resolution only counts if it happened after that
 * point in the log's own write order, regardless of what any of the
 * dates involved actually are.
 */
const PROBE_SELECT = `
  SELECT q.id, q.statement, q.status, q.decision_date, q.signal, q.created_at,
         (q.status = 'active' AND q.decision_date <= $1 AND NOT EXISTS (
           SELECT 1 FROM events pr
           WHERE pr.type = 'probe.resolved' AND pr.subject_id = q.id
           AND pr.recorded_at > COALESCE(
             (SELECT max(ext.recorded_at) FROM events ext
              WHERE ext.type = 'probe.resolved' AND ext.subject_id = q.id AND ext.payload->>'action' = 'extend'),
             q.created_at
           )
         )) AS needs_resolution
  FROM quests q
  WHERE q.kind = 'probe'
`;

function mapProbeRow(row: ProbeRow): Probe {
  return {
    id: row.id,
    statement: row.statement,
    status: row.status,
    decisionDate: row.decision_date,
    signal: row.signal,
    createdAt: row.created_at,
    needsResolution: row.needs_resolution,
  };
}

/** Every Probe, `needsResolution` computed as of `asOfLogicalDay` (milestone-5-spec.md §4 — not stored). */
export async function listProbes(client: Queryable, asOfLogicalDay: string): Promise<Probe[]> {
  const result = await client.query<ProbeRow>(`${PROBE_SELECT} ORDER BY q.decision_date ASC`, [asOfLogicalDay]);
  return result.rows.map(mapProbeRow);
}

/** Just the ones needing a decision today — what the Morning screen's card and the Quests screen's highlighted section both read (milestone-5-spec.md §7). Filters `listProbes`'s own `needsResolution` rather than re-deriving the condition in a second query, so there's exactly one place that logic lives. */
export async function listProbesAwaitingResolution(client: Queryable, asOfLogicalDay: string): Promise<Probe[]> {
  const probes = await listProbes(client, asOfLogicalDay);
  return probes.filter((p) => p.needsResolution);
}

export interface ResolveProbeInput {
  probeId: string;
  action: ProbeResolutionAction;
  /** Required when `action` is `'fold'` (PRD §13: "required note on what was learned"); optional otherwise. Also enforced by 0010's `events_valid_probe_resolution` CHECK. */
  note?: string;
  /** Required when `action` is `'extend'`. Must be a real future date; not validated against "today" here since that's a display concern, not a data one. */
  newDecisionDate?: string;
  occurredAt?: Date;
  timezone?: string;
}

/**
 * Resolves a Probe past its decision date. `double_down` leaves status and
 * decision_date untouched — the resolution event's own existence (recorded
 * after the current decision_date) is what makes `needsResolution` false
 * from here on, per milestone-5-spec.md §4. `fold` is a successful close,
 * never framed as failure. `extend` moves decision_date forward and is
 * rejected if this Probe has already been extended once (checked against
 * the log, not a stored flag — AGENTS.md hard rule 3).
 */
export async function resolveProbe(client: Queryable, input: ResolveProbeInput): Promise<AppendedEvent> {
  const probe = await client.query<{ decision_date: string }>(
    `SELECT decision_date FROM quests WHERE id = $1 AND kind = 'probe' AND status = 'active'`,
    [input.probeId]
  );
  if (probe.rows.length === 0) {
    throw new Error(`No active probe found with id ${input.probeId}`);
  }

  if (input.action === "fold" && (input.note === undefined || input.note.trim() === "")) {
    throw new Error("Folding a probe requires a note on what was learned.");
  }

  if (input.action === "extend") {
    if (!input.newDecisionDate) {
      throw new Error("Extending a probe requires a new decision date.");
    }
    const priorExtend = await client.query(
      `SELECT 1 FROM events WHERE type = 'probe.resolved' AND subject_id = $1 AND payload->>'action' = 'extend'`,
      [input.probeId]
    );
    if (priorExtend.rows.length > 0) {
      throw new Error("A probe may be extended only once.");
    }
  }

  const timezone = input.timezone ?? getTimezone();
  const occurredAt = input.occurredAt ?? new Date();

  if (input.action === "fold") {
    await client.query(`UPDATE quests SET status = 'folded' WHERE id = $1`, [input.probeId]);
  } else if (input.action === "extend") {
    await client.query(`UPDATE quests SET decision_date = $2 WHERE id = $1`, [input.probeId, input.newDecisionDate]);
  }

  const payload: Record<string, unknown> = { action: input.action };
  if (input.note !== undefined && input.note.trim() !== "") payload.note = input.note;

  return appendEvent(client, {
    type: "probe.resolved",
    occurredAt,
    subjectId: input.probeId,
    domain: QUEST_DOMAIN,
    payload,
    timezone,
  });
}
