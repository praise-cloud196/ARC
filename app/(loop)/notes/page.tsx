import { withReadTransaction } from "@/lib/with-transaction";
import { listRecentNotes } from "@/lib/notes";
import { DOMAINS } from "@/lib/domains";
import { BackLink } from "@/app/components/BackLink";
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
    <main className="mx-auto max-w-md px-6 py-12 text-ink">
      <BackLink href="/character-sheet" label="Character Sheet" />
      <SystemVoice as="div" size="sm" className="text-ink-faint mb-8">
        Notes
      </SystemVoice>

      <form action={submitNote} className="space-y-4 border border-border p-4">
        <label className="block space-y-2">
          <SystemVoice size="sm">Domain</SystemVoice>
          <select name="domain" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink">
            {DOMAINS.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Note</SystemVoice>
          <textarea name="note" required rows={3} className="w-full rounded border border-border bg-surface p-3 font-sans text-ink" />
        </label>
        <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
          Add Note
        </button>
      </form>

      {recent.length > 0 && (
        <ul className="mt-8 space-y-3">
          {recent.map((note) =>
            editingId === note.id ? (
              <li key={note.id} className="border border-border p-3">
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
                      className="w-full rounded border border-border bg-surface p-3 font-sans text-ink"
                    />
                  </label>
                  <div className="flex gap-3">
                    <button type="submit" className="border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
                      Save
                    </button>
                    <a
                      href={showWithdrawn ? "/notes?withdrawn=1" : "/notes"}
                      className="text-ink-faint font-mono text-xs uppercase tracking-wide2"
                    >
                      Cancel
                    </a>
                  </div>
                </form>
              </li>
            ) : (
              <li key={note.id} className="border-b border-border py-2">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-sans text-ink">
                    {note.note}
                    <span className="text-ink-faint text-sm">
                      {" "}
                      ({note.domain}, {note.logicalDay}
                      {note.voided ? ", withdrawn" : ""})
                    </span>
                  </p>
                  {!note.voided && (
                    <div className="flex shrink-0 gap-3">
                      <a
                        href={`/notes?edit=${note.id}${showWithdrawn ? "&withdrawn=1" : ""}`}
                        className="text-ink-faint font-mono text-xs uppercase tracking-wide2"
                      >
                        Edit
                      </a>
                      <form action={submitVoidNote}>
                        <input type="hidden" name="noteEventId" value={note.id} />
                        <button type="submit" className="text-ink-faint font-mono text-xs uppercase tracking-wide2">
                          Remove
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <a
        href={showWithdrawn ? "/notes" : "/notes?withdrawn=1"}
        className="text-ink-faint mt-6 block font-mono text-xs uppercase tracking-wide2"
      >
        {showWithdrawn ? "Hide withdrawn" : "Show withdrawn"}
      </a>
    </main>
  );
}
