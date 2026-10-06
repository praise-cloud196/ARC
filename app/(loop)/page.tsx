import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { getCommitmentsForWeek, listCarryableCommitments } from "@/lib/commitments";
import { startOfWeek } from "@/lib/day-math";
import { computeLogicalDay, getTimezone } from "@/lib/logical-day";
import { withReadTransaction, withTransaction } from "@/lib/with-transaction";
import {
  determineLoopState,
  recordAppOpened,
  computeMorningScreenData,
  computeTonightsSummary,
  computeTodaysCommitmentRows,
} from "@/lib/loop";
import { listRecentMarks } from "@/lib/marks";
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
/** Labels of last week's commitments that can be copied into this week — only when this week has none declared yet. */
async function carryableLabelsFor(client: PoolClient, now: Date): Promise<string[]> {
  const weekStart = startOfWeek(computeLogicalDay(now, getTimezone()));
  if ((await getCommitmentsForWeek(client, weekStart)).length > 0) return [];
  return (await listCarryableCommitments(client, weekStart)).map((c) => c.label);
}

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
    const { data, carryableLabels } = await withReadTransaction(async (client) => ({
      data: await computeMorningScreenData(client, now),
      carryableLabels: await carryableLabelsFor(client, now),
    }));
    return <MorningScreen data={data} carryableLabels={carryableLabels} />;
  }

  if (state === "night") {
    // docs/night-access-fix.md §2: Night also gets today's commitment rows
    // (same data, same query Day itself uses) so the screen can offer a
    // way back to them — the logical day, and so the ability to log
    // conduct, stays open until the 6am boundary even though the display
    // hour has already switched the screen to Night.
    const [summary, todaysCommitments] = await withReadTransaction((client) =>
      Promise.all([computeTonightsSummary(client, now), computeTodaysCommitmentRows(client, now)])
    );
    return <NightScreen summary={summary} todaysCommitments={todaysCommitments} />;
  }

  const { commitments, lastMarkDay, carryableLabels } = await withReadTransaction(async (client) => ({
    commitments: (await computeTodaysCommitmentRows(client, now)) as CommitmentRowData[],
    lastMarkDay: (await listRecentMarks(client, 1))[0]?.logicalDay ?? null,
    carryableLabels: await carryableLabelsFor(client, now),
  }));

  return <DayScreen commitments={commitments} lastMarkDay={lastMarkDay} carryableLabels={carryableLabels} />;
}
