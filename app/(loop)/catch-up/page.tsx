import { withReadTransaction } from "@/lib/with-transaction";
import { computeCommitmentRowsForDay } from "@/lib/loop";
import { computeLogicalDay, getTimezone } from "@/lib/logical-day";
import { addDays } from "@/lib/day-math";
import { CATCHUP_WINDOW_DAYS } from "@/lib/calibration";
import { Panel } from "@/app/components/Panel";
import { SystemVoice } from "@/app/components/SystemVoice";
import { BackLink } from "@/app/components/BackLink";
import { CommitmentRow } from "@/app/components/CommitmentRow";

/**
 * Catch-up logging: log (or withdraw) commitment completions for the last
 * few logical days. The record keeps when each was entered, so a late entry
 * is stored as late. Days outside CATCHUP_WINDOW_DAYS are closed.
 */
export const dynamic = "force-dynamic";

function dayLabel(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return `${weekday} ${day}`;
}

export default async function CatchUpPage() {
  const today = computeLogicalDay(new Date(), getTimezone());
  const days = Array.from({ length: CATCHUP_WINDOW_DAYS }, (_, i) => addDays(today, -(i + 1)));

  const sections = await withReadTransaction(async (client) =>
    Promise.all(days.map(async (day) => ({ day, rows: await computeCommitmentRowsForDay(client, day) })))
  );

  return (
    <main className="px-6 py-12 pb-24">
      <Panel
        size="wide"
        header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Earlier days</div>}
      >
        <BackLink href="/" label="← Today" />
        <div className="space-y-8">
          {sections.map(({ day, rows }) => (
            <section key={day}>
              <SystemVoice size="sm" className="text-ink-muted mb-2 block">
                {dayLabel(day)}
              </SystemVoice>
              {rows.length === 0 ? (
                <p className="font-sans text-ink-faint text-sm">Nothing scheduled.</p>
              ) : (
                rows.map((c) => <CommitmentRow key={`${day}-${c.id}`} commitment={c} logicalDay={day} />)
              )}
            </section>
          ))}
        </div>
      </Panel>
    </main>
  );
}
