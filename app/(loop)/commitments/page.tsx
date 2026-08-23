import { withReadTransaction } from "@/lib/with-transaction";
import { getCommitmentsForWeek } from "@/lib/commitments";
import { startOfWeek } from "@/lib/day-math";
import { computeLogicalDay, getTimezone } from "@/lib/logical-day";
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
 * `dynamic = "force-dynamic"`: reads live DB state and the current day on
 * every load — see app/page.tsx's comment on the same line for why a raw
 * `pg` query doesn't trip Next's static/dynamic analysis on its own.
 */
export const dynamic = "force-dynamic";

export default async function CommitmentsPage() {
  const weekStart = startOfWeek(computeLogicalDay(new Date(), getTimezone()));
  const existing = await withReadTransaction((client) => getCommitmentsForWeek(client, weekStart));

  return (
    <main className="mx-auto max-w-md px-6 py-12 text-ink">
      <SystemVoice as="div" size="sm" className="text-ink-faint mb-8">
        Commitments — Week of {weekStart}
      </SystemVoice>

      {existing.length > 0 && (
        <ul className="mb-8 space-y-2">
          {existing.map((c) => (
            <li key={c.id} className="border-b border-border py-2 font-sans text-ink">
              {c.label} <span className="text-ink-faint text-sm">({c.domain}, tier {c.tier}, ×{c.weeklyTarget}/wk)</span>
            </li>
          ))}
        </ul>
      )}

      <form action={submitDeclareCommitment} className="space-y-4 border border-border p-4">
        <label className="block space-y-2">
          <SystemVoice size="sm">Domain</SystemVoice>
          <select name="domain" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink">
            <option value="career">Career</option>
            <option value="body">Body</option>
            <option value="attention">Attention</option>
          </select>
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Label</SystemVoice>
          <input type="text" name="label" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Tier</SystemVoice>
          <select name="tier" required defaultValue="1" className="w-full rounded border border-border bg-surface p-2 font-sans text-ink">
            <option value="1">1 — Routine, ≤30 min</option>
            <option value="2">2 — Substantial, 30-90 min</option>
            <option value="3">3 — Demanding, 90+ min</option>
          </select>
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Times per week</SystemVoice>
          <input type="number" name="weeklyTarget" min="1" required defaultValue="1" className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
          Declare
        </button>
      </form>

      <p className="text-ink-faint mt-4 text-xs">Once declared, these lock for the rest of the week.</p>
    </main>
  );
}
