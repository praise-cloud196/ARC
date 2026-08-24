import { redirect } from "next/navigation";
import { withReadTransaction, withTransaction } from "@/lib/with-transaction";
import { determineLoopState, recordAppOpened, computeMorningScreenData, computeTonightsReport } from "@/lib/loop";
import { getCommitmentsForWeek } from "@/lib/commitments";
import { startOfWeek } from "@/lib/day-math";
import { computeLogicalDay, getTimezone } from "@/lib/logical-day";
import { resolveEffectiveEvents, type RawEventRow } from "@/lib/effective-events";
import { MorningScreen } from "@/app/components/MorningScreen";
import { DayScreen } from "@/app/components/DayScreen";
import { NightScreen } from "@/app/components/NightScreen";
import type { CommitmentRowData } from "@/app/components/CommitmentRow";

// This page reads live DB state (audit status, commitments, momentum) and
// the current server time on every load — Next.js's static analysis can't
// see that through a raw `pg` query (it isn't a recognized dynamic API the
// way `fetch()` or `cookies()` are), so without this it gets prerendered
// once at build time and every visitor gets that frozen snapshot forever.
export const dynamic = "force-dynamic";

// Deliberately no Suspense boundary here. docs/design-revision-v1.md §5b's
// screen transition relies on a *cross-document* navigation (Nav.tsx /
// BackLink.tsx render a real `<a>` for any link touching this route) —
// and that mechanism needs the whole response, including this panel,
// ready in one shot: a `<Suspense fallback={null}>` split was tried and
// makes the transition capture the *empty* fallback instead, since
// content streamed in later never gets re-captured (confirmed directly:
// the named panel-transition element only ever animated once the split
// was removed and this page went back to blocking fully before
// responding, however long that takes). Blocking here is correct, not a
// perf bug to fix — see globals.css's screen-transition comment.
export default async function TodayPage() {
  const auditCompleted = await withReadTransaction(async (client) => {
    const result = await client.query(`SELECT 1 FROM events WHERE type = 'audit.completed' LIMIT 1`);
    return result.rows.length > 0;
  });
  if (!auditCompleted) redirect("/audit");

  const now = new Date();
  // Determine state before recording this visit — recording first would
  // make every visit see itself as "already engaged" (milestone-4.1-fixes.md
  // §4). The record itself is a real write (idempotency-keyed per logical
  // day, so a second visit today is a no-op), never rolled back like the
  // read-only data fetches below.
  const state = await withReadTransaction((client) => determineLoopState(client, now));
  await withTransaction((client) => recordAppOpened(client, now));

  if (state === "morning") {
    const data = await withReadTransaction((client) => computeMorningScreenData(client, now));
    return <MorningScreen data={data} />;
  }

  if (state === "night") {
    const lines = await withReadTransaction((client) => computeTonightsReport(client, now));
    return <NightScreen lines={lines} />;
  }

  const timezone = getTimezone();
  const today = computeLogicalDay(now, timezone);
  const weekStart = startOfWeek(today);

  const commitments: CommitmentRowData[] = await withReadTransaction(async (client) => {
    const weekCommitments = await getCommitmentsForWeek(client, weekStart);

    // Today's raw rows only (not the whole log — this isn't the
    // multi-value identity computation lib/effective-events.ts's
    // fetchRawEventRows is meant for), folded the same way so a
    // resistance/note correction is reflected even though the original
    // commitment.completed write never had them.
    const todaysRows = await client.query<RawEventRow>(
      `SELECT id, type, occurred_at, timezone, domain, subject_id, payload, recorded_at
       FROM events WHERE logical_day = $1 AND type IN ('commitment.completed', 'commitment.completed.corrected')`,
      [today]
    );
    const effective = resolveEffectiveEvents(todaysRows.rows);
    const effectiveById = new Map(effective.map((e) => [e.id, e]));
    // subject_id (which commitment this completion belongs to) lives on
    // the raw original row — effective events don't carry it, since
    // resolveEffectiveEvents's shape is generic across every event type.
    const originalIdByCommitmentId = new Map(
      todaysRows.rows.filter((r) => r.type === "commitment.completed").map((r) => [r.subject_id, r.id])
    );

    return weekCommitments.map((c) => {
      const originalId = originalIdByCommitmentId.get(c.id);
      const completion = originalId ? effectiveById.get(originalId) : undefined;
      const resistance = completion?.payload.resistance;
      return {
        id: c.id,
        label: c.label,
        completionEventId: originalId ?? null,
        resistance: typeof resistance === "string" ? resistance : null,
      };
    });
  });

  return <DayScreen commitments={commitments} />;
}
