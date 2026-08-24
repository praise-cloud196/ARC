/**
 * Domain notes (milestone-3-spec.md §1): an unquantified domain
 * observation — *"I feel stronger"* (PRD §9). Domain-scoped, zero XP — a
 * peer of lib/metrics.ts by design, not a comment attached to a number.
 */
import type { Pool, PoolClient } from "pg";
import { appendCorrection, appendEvent, type AppendedEvent } from "./events";
import { fetchRawEventRows, resolveEffectiveEvents } from "./effective-events";
import { getTimezone } from "./logical-day";
import type { Domain } from "./domains";

type Queryable = Pool | PoolClient;

export interface RecordNoteInput {
  domain: Domain;
  note: string;
  occurredAt?: Date;
  timezone?: string;
}

export async function recordNote(client: Queryable, input: RecordNoteInput): Promise<AppendedEvent> {
  return appendEvent(client, {
    type: "note.recorded",
    occurredAt: input.occurredAt ?? new Date(),
    domain: input.domain,
    payload: { note: input.note },
    timezone: input.timezone ?? getTimezone(),
  });
}

/**
 * Distinct domains (of DOMAINS, milestone-3-spec.md §2 step 1 — all four,
 * not just SCORED_DOMAINS) with at least one *effective* note.recorded
 * event — corrections applied, voided ones excluded
 * (design-revision-v2.md §7.2). A domain whose only note gets withdrawn
 * goes back to needing one, same as if it had never been written.
 */
export async function domainsWithNotes(client: Queryable): Promise<Domain[]> {
  const rows = await fetchRawEventRows(client);
  const domains = new Set<Domain>();
  for (const event of resolveEffectiveEvents(rows)) {
    if (event.type === "note.recorded" && event.domain) domains.add(event.domain as Domain);
  }
  return [...domains];
}

export interface RecentNote {
  id: string;
  domain: Domain | null;
  note: string;
  occurredAt: Date;
  logicalDay: string;
  voided: boolean;
}

/**
 * Most recent notes, newest first, corrections applied — for the /notes
 * list, not a full history view. `includeVoided` powers the "show
 * withdrawn" toggle (design-revision-v2.md §7.3).
 */
export async function listRecentNotes(
  client: Queryable,
  limit = 10,
  includeVoided = false
): Promise<RecentNote[]> {
  const rows = await fetchRawEventRows(client);
  const notes = resolveEffectiveEvents(rows, { includeVoided })
    .filter((e) => e.type === "note.recorded")
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);

  return notes.map((e) => ({
    id: e.id,
    domain: e.domain as Domain | null,
    note: typeof e.payload.note === "string" ? e.payload.note : "",
    occurredAt: e.occurredAt,
    logicalDay: e.logicalDay,
    voided: e.payload.voided === true,
  }));
}

export interface EditNoteInput {
  noteEventId: string;
  note: string;
  timezone?: string;
}

/** Corrects a note (design-revision-v2.md §7.1/§7.2) — a record, editable at any time, no same-day restriction. */
export async function editNote(client: Queryable, input: EditNoteInput): Promise<AppendedEvent> {
  return appendCorrection(client, {
    correctsType: "note.recorded",
    correctsEventId: input.noteEventId,
    payload: { note: input.note },
    timezone: input.timezone,
  });
}

export interface VoidNoteInput {
  noteEventId: string;
  timezone?: string;
}

/** Withdraws a note (design-revision-v2.md §7.1/§7.2) — a record, voidable at any time. The original is never removed. */
export async function voidNote(client: Queryable, input: VoidNoteInput): Promise<AppendedEvent> {
  return appendCorrection(client, {
    correctsType: "note.recorded",
    correctsEventId: input.noteEventId,
    payload: { voided: true },
    timezone: input.timezone,
  });
}
