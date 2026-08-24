/**
 * Marks (milestone-3-spec.md §3, PRD §14). `recordRetroactiveMark` is the
 * audit's step 2 — it requires an `occurredAt` because backdating is the
 * whole point, and it tags `payload.retroactive = true` so
 * `retroactiveMarkStats` (the audit-progress/starting-rank gate) counts only
 * these. `recordMark` is the ordinary, present-day version used after the
 * audit — same required note, same optional artifact, no retroactive flag,
 * `occurredAt` defaults to now. `events_mark_has_note`
 * (db/migrations/0006_baseline_audit.sql) enforces the note requirement for
 * both at the data layer, deliberately not distinguishing the two.
 */
import type { Pool, PoolClient } from "pg";
import { appendCorrection, appendEvent, type AppendedEvent } from "./events";
import { fetchRawEventRows, resolveEffectiveEvents, type EffectiveEvent } from "./effective-events";
import { getTimezone } from "./logical-day";
import type { Domain } from "./domains";

type Queryable = Pool | PoolClient;

export interface RecordRetroactiveMarkInput {
  domain: Domain;
  /** The user's best estimate of when it actually happened — may be years ago. Required: this is what makes it retroactive. */
  occurredAt: Date;
  /** "What changed because of this?" (PRD §14) — required. */
  note: string;
  artifact?: string;
  timezone?: string;
}

export async function recordRetroactiveMark(
  client: Queryable,
  input: RecordRetroactiveMarkInput
): Promise<AppendedEvent> {
  const payload: Record<string, unknown> = { retroactive: true, note: input.note };
  if (input.artifact !== undefined) payload.artifact = input.artifact;

  return appendEvent(client, {
    type: "mark.recorded",
    occurredAt: input.occurredAt,
    domain: input.domain,
    payload,
    timezone: input.timezone ?? getTimezone(),
  });
}

export interface RecordMarkInput {
  domain: Domain;
  /** "What changed because of this?" (PRD §14) — required. */
  note: string;
  artifact?: string;
  occurredAt?: Date;
  timezone?: string;
}

/** Ordinary, present-day Mark — see this file's header comment for how it differs from `recordRetroactiveMark`. */
export async function recordMark(client: Queryable, input: RecordMarkInput): Promise<AppendedEvent> {
  const payload: Record<string, unknown> = { note: input.note };
  if (input.artifact !== undefined) payload.artifact = input.artifact;

  return appendEvent(client, {
    type: "mark.recorded",
    occurredAt: input.occurredAt ?? new Date(),
    domain: input.domain,
    payload,
    timezone: input.timezone ?? getTimezone(),
  });
}

export interface RecentMark {
  id: string;
  domain: Domain | null;
  note: string;
  artifact: string | null;
  occurredAt: Date;
  logicalDay: string;
  voided: boolean;
}

/**
 * Most recent Marks, newest first, corrections applied — for the /marks
 * list, not the full effective-event log. `includeVoided` powers the
 * "show withdrawn" toggle (design-revision-v2.md §7.3); a Mark voided via
 * `voidMark` is otherwise excluded (§7.2's default), and an edited one
 * shows its latest note/artifact, not the original typo.
 */
export async function listRecentMarks(
  client: Queryable,
  limit = 10,
  includeVoided = false
): Promise<RecentMark[]> {
  const rows = await fetchRawEventRows(client);
  const marks = resolveEffectiveEvents(rows, { includeVoided })
    .filter((e) => e.type === "mark.recorded")
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);

  return marks.map((e) => ({
    id: e.id,
    domain: e.domain as Domain | null,
    note: typeof e.payload.note === "string" ? e.payload.note : "",
    artifact: typeof e.payload.artifact === "string" ? e.payload.artifact : null,
    occurredAt: e.occurredAt,
    logicalDay: e.logicalDay,
    voided: e.payload.voided === true,
  }));
}

export interface EditMarkInput {
  markEventId: string;
  note?: string;
  artifact?: string;
  timezone?: string;
}

/** Corrects a Mark's note/artifact (design-revision-v2.md §7.1/§7.2) — a record, editable at any time, no same-day restriction. */
export async function editMark(client: Queryable, input: EditMarkInput): Promise<AppendedEvent> {
  const payload: Record<string, unknown> = {};
  if (input.note !== undefined) payload.note = input.note;
  if (input.artifact !== undefined) payload.artifact = input.artifact;

  return appendCorrection(client, {
    correctsType: "mark.recorded",
    correctsEventId: input.markEventId,
    payload,
    timezone: input.timezone,
  });
}

export interface VoidMarkInput {
  markEventId: string;
  timezone?: string;
}

/** Withdraws a Mark (design-revision-v2.md §7.1/§7.2) — a record, voidable at any time. The original is never removed. */
export async function voidMark(client: Queryable, input: VoidMarkInput): Promise<AppendedEvent> {
  return appendCorrection(client, {
    correctsType: "mark.recorded",
    correctsEventId: input.markEventId,
    payload: { voided: true },
    timezone: input.timezone,
  });
}

export interface RetroactiveMarkStats {
  count: number;
  domains: Domain[];
}

/** Pure — no I/O. See `retroactiveMarkStats` below. */
export function retroactiveMarkStatsFromEvents(events: EffectiveEvent[]): RetroactiveMarkStats {
  const domains = new Set<Domain>();
  let count = 0;

  for (const event of events) {
    if (event.type !== "mark.recorded") continue;
    if (event.payload.retroactive !== true) continue;
    count += 1;
    if (event.domain) domains.add(event.domain as Domain);
  }

  return { count, domains: [...domains] };
}

/**
 * Count and distinct domains of retroactive Marks, corrections applied —
 * milestone-3-spec.md §6's `retroMarks` / `retroDomains`, and the §3
 * minimum-3 gate. Folds the log itself (not a raw count query) because a
 * correction could change a Mark's domain or its `retroactive` flag, and
 * both must reflect the corrected value. A caller also needing other
 * derived values from the same request should fetch once and call
 * `retroactiveMarkStatsFromEvents` directly instead (milestone-4-spec.md §1).
 */
export async function retroactiveMarkStats(client: PoolClient): Promise<RetroactiveMarkStats> {
  const events = resolveEffectiveEvents(await fetchRawEventRows(client));
  return retroactiveMarkStatsFromEvents(events);
}
