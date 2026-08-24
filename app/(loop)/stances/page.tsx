import { withReadTransaction } from "@/lib/with-transaction";
import { getAllStancesForManagement, isWithinSeasonBoundary } from "@/lib/stances";
import { Panel } from "@/app/components/Panel";
import { Grid, GridCell } from "@/app/components/GridCell";
import { SystemVoice } from "@/app/components/SystemVoice";
import { submitStance } from "./actions";

/**
 * Stance management, after the audit — the audit's own wizard (app/audit/)
 * only ever declares stances (nothing exists yet to change). This is where
 * PRD §16's rule actually shows up: declaring a new behaviour is always
 * allowed; changing one already named is gated to season boundaries
 * (lib/stances.ts's isWithinSeasonBoundary — currently a placeholder keyed
 * to audit.completed, see docs/milestone-7-notes.md).
 *
 * design-revision-v2.md §1/§2: sits in a Panel, the stance list is a grid
 * of cells, not rows.
 *
 * Reads live DB state on every load — see app/(loop)/page.tsx's comment on
 * the same line for why a raw `pg` query doesn't trip Next's
 * static/dynamic analysis on its own.
 */
export const dynamic = "force-dynamic";

const STANCE_OPTIONS: { value: string; label: string }[] = [
  { value: "observing", label: "Observing" },
  { value: "reducing", label: "Reducing" },
  { value: "abstaining", label: "Abstaining" },
  { value: "not_now", label: "Not now" },
];

export default async function StancesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { stances, withinBoundary } = await withReadTransaction(async (client) => ({
    stances: await getAllStancesForManagement(client),
    withinBoundary: await isWithinSeasonBoundary(client),
  }));

  return (
    <main className="px-6 py-12">
      <Panel size="wide" header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Stances</div>}>
        <a href="/character-sheet" className="ia-link mb-8 block font-mono text-xs uppercase tracking-wide2">
          Character Sheet
        </a>

        {params.error && <p className="text-ink-muted mb-6 font-sans text-sm">{params.error}</p>}

        {stances.length > 0 && (
          <Grid className="mb-10">
            {stances.map((s) => (
              <GridCell key={s.id}>
                <form action={submitStance} className="flex items-center justify-between gap-3">
                  <div>
                    <SystemVoice as="div" size="sm">
                      {s.behaviour}
                    </SystemVoice>
                    <p className="text-ink-faint text-xs">currently {s.stance.replace("_", " ")}</p>
                  </div>
                  <input type="hidden" name="behaviour" value={s.behaviour} />
                  <div className="flex items-center gap-2">
                    <select
                      name="stance"
                      defaultValue={s.stance}
                      disabled={!withinBoundary}
                      className="ia rounded border border-border bg-surface p-2 font-sans text-ink"
                    >
                      {STANCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!withinBoundary}
                      className="ia border border-border px-3 py-2 font-mono text-xs uppercase tracking-wide2 text-ink"
                    >
                      Change
                    </button>
                  </div>
                </form>
              </GridCell>
            ))}
          </Grid>
        )}

        {!withinBoundary && (
          <p className="text-ink-faint mb-6 text-xs">
            Changing an already-named behaviour&rsquo;s stance is restricted to season boundaries. Declaring a new one is
            always allowed.
          </p>
        )}

        <form action={submitStance} className="max-w-md space-y-4 border border-border p-4">
          <SystemVoice size="sm">Declare a new behaviour</SystemVoice>
          <label className="block space-y-2">
            <SystemVoice size="sm">Behaviour</SystemVoice>
            <input type="text" name="behaviour" required className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">Stance</SystemVoice>
            <select name="stance" required defaultValue="observing" className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink">
              {STANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="ia border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
            Declare
          </button>
        </form>
      </Panel>
    </main>
  );
}
