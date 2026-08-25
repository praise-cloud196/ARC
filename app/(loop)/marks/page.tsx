import { withReadTransaction } from "@/lib/with-transaction";
import { listRecentMarks } from "@/lib/marks";
import { DOMAINS } from "@/lib/domains";
import { Panel } from "@/app/components/Panel";
import { Grid, GridCell, orphanSpanClass } from "@/app/components/GridCell";
import { SystemVoice } from "@/app/components/SystemVoice";
import { submitMark, submitEditMark, submitVoidMark } from "./actions";

/**
 * Ordinary (non-retroactive) Mark recording, after the audit — the audit's
 * own wizard (app/audit/) only ever writes retroactive Marks. See
 * lib/marks.ts's header comment for how the two differ.
 *
 * design-revision-v2.md §7.3: a Mark is a record — Edit and Remove on
 * every listed one, Remove always a void. `withdrawn=1` is the "show
 * withdrawn" toggle; `edit=<id>` opens that row's inline edit form.
 * §1/§2: sits in a Panel, the list is a grid of cells, not rows.
 *
 * Reads live DB state (the recent-Marks list) on every load — see
 * app/(loop)/page.tsx's comment on the same line for why a raw `pg` query
 * doesn't trip Next's static/dynamic analysis on its own.
 */
export const dynamic = "force-dynamic";

export default async function MarksPage({
  searchParams,
}: {
  searchParams: Promise<{ withdrawn?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const showWithdrawn = params.withdrawn === "1";
  const editingId = params.edit ?? null;

  const recent = await withReadTransaction((client) => listRecentMarks(client, 10, showWithdrawn));

  return (
    <main className="px-6 py-12">
      <Panel size="wide" header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Marks</div>}>
        <a href="/character-sheet" className="ia-link text-ink-faint mb-8 inline-block font-mono text-xs normal-case">
          ← Character Sheet
        </a>

        <form action={submitMark} className="mx-auto mb-8 max-w-md space-y-4 border border-border p-4">
          <label className="block space-y-2">
            <SystemVoice size="sm">Domain</SystemVoice>
            <select name="domain" required className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink">
              {DOMAINS.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">What changed because of this?</SystemVoice>
            <textarea name="note" required rows={3} className="ia w-full rounded border border-border bg-surface p-3 font-sans text-ink" />
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">Artifact (optional)</SystemVoice>
            <input type="text" name="artifact" className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
          </label>
          <button type="submit" className="ia border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
            Add Mark
          </button>
        </form>

        {recent.length > 0 && (
          <Grid>
            {recent.map((mark, i) =>
              editingId === mark.id ? (
                <GridCell key={mark.id} className={orphanSpanClass(i, recent.length)}>
                  <form action={submitEditMark} className="space-y-3">
                    <input type="hidden" name="markEventId" value={mark.id} />
                    <label className="block space-y-2">
                      <SystemVoice size="sm">Domain</SystemVoice>
                      <p className="font-sans text-ink-faint text-sm">{mark.domain}</p>
                    </label>
                    <label className="block space-y-2">
                      <SystemVoice size="sm">What changed because of this?</SystemVoice>
                      <textarea
                        name="note"
                        required
                        rows={3}
                        defaultValue={mark.note}
                        className="ia w-full rounded border border-border bg-surface p-3 font-sans text-ink"
                      />
                    </label>
                    <label className="block space-y-2">
                      <SystemVoice size="sm">Artifact (optional)</SystemVoice>
                      <input
                        type="text"
                        name="artifact"
                        defaultValue={mark.artifact ?? ""}
                        className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink"
                      />
                    </label>
                    <div className="flex gap-3">
                      <button type="submit" className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
                        Save
                      </button>
                      <a
                        href={showWithdrawn ? "/marks?withdrawn=1" : "/marks"}
                        className="ia-link font-mono text-xs uppercase tracking-wide2"
                      >
                        Cancel
                      </a>
                    </div>
                  </form>
                </GridCell>
              ) : (
                <GridCell key={mark.id} className={orphanSpanClass(i, recent.length)}>
                  <p className="font-sans text-ink">{mark.note}</p>
                  <p className="text-ink-faint mt-1 font-mono text-xs">
                    {mark.domain}, {mark.logicalDay}
                    {mark.voided ? ", withdrawn" : ""}
                  </p>
                  {!mark.voided && (
                    <div className="mt-2 flex gap-3">
                      <a
                        href={`/marks?edit=${mark.id}${showWithdrawn ? "&withdrawn=1" : ""}`}
                        className="ia-link font-mono text-xs uppercase tracking-wide2"
                      >
                        Edit
                      </a>
                      <form action={submitVoidMark}>
                        <input type="hidden" name="markEventId" value={mark.id} />
                        <button type="submit" className="ia-link font-mono text-xs uppercase tracking-wide2">
                          Remove
                        </button>
                      </form>
                    </div>
                  )}
                </GridCell>
              )
            )}
          </Grid>
        )}

        <a
          href={showWithdrawn ? "/marks" : "/marks?withdrawn=1"}
          className="ia-link mt-6 block font-mono text-xs uppercase tracking-wide2"
        >
          {showWithdrawn ? "Hide withdrawn" : "Show withdrawn"}
        </a>
      </Panel>
    </main>
  );
}
