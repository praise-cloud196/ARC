import { withReadTransaction } from "@/lib/with-transaction";
import { listRecentNotes } from "@/lib/notes";
import { DOMAINS } from "@/lib/domains";
import { Panel } from "@/app/components/Panel";
import { Grid, GridCell, orphanSpanClass } from "@/app/components/GridCell";
import { SystemVoice } from "@/app/components/SystemVoice";
import { submitNote, submitEditNote, submitVoidNote } from "./actions";

/**
 * Domain notes, after the audit — the audit's own wizard (app/audit/)
 * writes one per domain during onboarding only; this is the ordinary,
 * ongoing version, open any time, any domain, any number of notes
 * (lib/notes.ts's recordNote is the same write either way).
 *
 * design-revision-v2.md §7.3: a note is a record — Edit and Remove on
 * every listed one, Remove always a void. `withdrawn=1` is the "show
 * withdrawn" toggle; `edit=<id>` opens that row's inline edit form.
 * §1/§2: sits in a Panel, the list is a grid of cells, not rows.
 *
 * Reads live DB state (the recent-notes list) on every load — see
 * app/(loop)/page.tsx's comment on the same line for why a raw `pg` query
 * doesn't trip Next's static/dynamic analysis on its own.
 */
export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ withdrawn?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const showWithdrawn = params.withdrawn === "1";
  const editingId = params.edit ?? null;

  const recent = await withReadTransaction((client) => listRecentNotes(client, 10, showWithdrawn));

  return (
    <main className="px-6 py-12">
      <Panel size="wide" header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Notes</div>}>
        <a href="/character-sheet" className="ia-link text-ink-faint mb-8 inline-block font-mono text-xs normal-case">
          ← Character Sheet
        </a>

        <form action={submitNote} className="mx-auto mb-8 max-w-md space-y-4 border border-border p-4">
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
            <SystemVoice size="sm">Note</SystemVoice>
            <textarea name="note" required rows={3} className="ia w-full rounded border border-border bg-surface p-3 font-sans text-ink" />
          </label>
          <button type="submit" className="ia border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
            Add Note
          </button>
        </form>

        {recent.length > 0 && (
          <Grid>
            {recent.map((note, i) =>
              editingId === note.id ? (
                <GridCell key={note.id} className={orphanSpanClass(i, recent.length)}>
                  <form action={submitEditNote} className="space-y-3">
                    <input type="hidden" name="noteEventId" value={note.id} />
                    <label className="block space-y-2">
                      <SystemVoice size="sm">Domain</SystemVoice>
                      <p className="font-sans text-ink-faint text-sm">{note.domain}</p>
                    </label>
                    <label className="block space-y-2">
                      <SystemVoice size="sm">Note</SystemVoice>
                      <textarea
                        name="note"
                        required
                        rows={3}
                        defaultValue={note.note}
                        className="ia w-full rounded border border-border bg-surface p-3 font-sans text-ink"
                      />
                    </label>
                    <div className="flex gap-3">
                      <button type="submit" className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
                        Save
                      </button>
                      <a
                        href={showWithdrawn ? "/notes?withdrawn=1" : "/notes"}
                        className="ia-link font-mono text-xs uppercase tracking-wide2"
                      >
                        Cancel
                      </a>
                    </div>
                  </form>
                </GridCell>
              ) : (
                <GridCell key={note.id} className={orphanSpanClass(i, recent.length)}>
                  <p className="font-sans text-ink">{note.note}</p>
                  <p className="text-ink-faint mt-1 font-mono text-xs">
                    {note.domain}, {note.logicalDay}
                    {note.voided ? ", withdrawn" : ""}
                  </p>
                  {!note.voided && (
                    <div className="mt-2 flex gap-3">
                      <a
                        href={`/notes?edit=${note.id}${showWithdrawn ? "&withdrawn=1" : ""}`}
                        className="ia-link font-mono text-xs uppercase tracking-wide2"
                      >
                        Edit
                      </a>
                      <form action={submitVoidNote}>
                        <input type="hidden" name="noteEventId" value={note.id} />
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
          href={showWithdrawn ? "/notes" : "/notes?withdrawn=1"}
          className="ia-link mt-6 block font-mono text-xs uppercase tracking-wide2"
        >
          {showWithdrawn ? "Hide withdrawn" : "Show withdrawn"}
        </a>
      </Panel>
    </main>
  );
}
