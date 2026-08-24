import { withReadTransaction } from "@/lib/with-transaction";
import { getAllStancesForManagement, isWithinSeasonBoundary } from "@/lib/stances";
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
    <main className="mx-auto max-w-md px-6 py-12 text-ink">
      <SystemVoice as="div" size="sm" className="text-ink-faint mb-8">
        Stances
      </SystemVoice>

      {params.error && <p className="text-ink-muted mb-6 font-sans text-sm">{params.error}</p>}

      {stances.length > 0 && (
        <ul className="mb-10 space-y-4">
          {stances.map((s) => (
            <li key={s.id} className="border-b border-border pb-4">
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
                    className="rounded border border-border bg-surface p-2 font-sans text-ink disabled:opacity-30"
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
                    className="border border-border px-3 py-2 font-mono text-xs uppercase tracking-wide2 text-ink disabled:opacity-30"
                  >
                    Change
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}

      {!withinBoundary && (
        <p className="text-ink-faint mb-6 text-xs">
          Changing an already-named behaviour&rsquo;s stance is restricted to season boundaries. Declaring a new one is
          always allowed.
        </p>
      )}

      <form action={submitStance} className="space-y-4 border border-border p-4">
        <SystemVoice size="sm">Declare a new behaviour</SystemVoice>
        <label className="block space-y-2">
          <SystemVoice size="sm">Behaviour</SystemVoice>
          <input type="text" name="behaviour" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Stance</SystemVoice>
          <select name="stance" required defaultValue="observing" className="w-full rounded border border-border bg-surface p-2 font-sans text-ink">
            {STANCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
          Declare
        </button>
      </form>
    </main>
  );
}
