import { withReadTransaction } from "@/lib/with-transaction";
import { getCommitmentsForWeek } from "@/lib/commitments";
import { startOfWeek } from "@/lib/day-math";
import { computeLogicalDay, getTimezone } from "@/lib/logical-day";
import { Panel } from "@/app/components/Panel";
import { Grid, GridCell, orphanSpanClass } from "@/app/components/GridCell";
import { SystemVoice } from "@/app/components/SystemVoice";
import { submitDeclareCommitment } from "./actions";

/**
 * Weekly commitment declaration (milestone-4-spec.md §0.1/§3). Functional,
 * not visually invested — that budget belongs to the morning screen
 * (§2: "every other screen is functional"). Declares into the *current*
 * week: the full Ritual (declaring next week's commitments as part of a
 * weekly review) is milestone 7 — this is the minimal path that makes the
 * Loop usable now.
 *
 * design-revision-v2.md §1/§2: sits in a Panel like every other screen
 * now, header in the doc's own example format ("COMMITMENTS — WEEK OF
 * 2026-08-24"); the declared list is a grid, not rows — the form stays a
 * form.
 *
 * `dynamic = "force-dynamic"`: reads live DB state and the current day on
 * every load — see app/page.tsx's comment on the same line for why a raw
 * `pg` query doesn't trip Next's static/dynamic analysis on its own.
 */
export const dynamic = "force-dynamic";

export default async function CommitmentsPage() {
  const weekStart = startOfWeek(computeLogicalDay(new Date(), getTimezone()));
  const existing = await withReadTransaction((client) => getCommitmentsForWeek(client, weekStart));

  return (
    <main className="px-6 py-12">
      <Panel
        size="wide"
        header={
          <div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">
            Commitments — Week of {weekStart}
          </div>
        }
      >
        {existing.length > 0 && (
          <Grid className="mb-8">
            {existing.map((c, i) => (
              <GridCell key={c.id} className={orphanSpanClass(i, existing.length)}>
                <p className="font-sans text-ink">{c.label}</p>
                <p className="text-ink-faint mt-1 font-mono text-xs">
                  {c.domain}, tier {c.tier}, ×{c.weeklyTarget}/wk
                </p>
              </GridCell>
            ))}
          </Grid>
        )}

        <form action={submitDeclareCommitment} className="mx-auto max-w-md space-y-4 border border-border p-4">
          <label className="block space-y-2">
            <SystemVoice size="sm">Domain</SystemVoice>
            <select name="domain" required className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink">
              <option value="career">Career</option>
              <option value="body">Body</option>
              <option value="attention">Attention</option>
            </select>
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">Label</SystemVoice>
            <input type="text" name="label" required className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">Tier</SystemVoice>
            <select name="tier" required defaultValue="1" className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink">
              <option value="1">1 — Routine, ≤30 min</option>
              <option value="2">2 — Substantial, 30-90 min</option>
              <option value="3">3 — Demanding, 90+ min</option>
            </select>
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">Times per week</SystemVoice>
            <input
              type="number"
              name="weeklyTarget"
              min="1"
              required
              defaultValue="1"
              className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink"
            />
          </label>
          <div className="text-center">
            <button type="submit" className="ia border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
              Declare
            </button>
          </div>
        </form>

        <p className="text-ink-faint mt-4 text-xs">Once declared, these lock for the rest of the week.</p>
      </Panel>
    </main>
  );
}
