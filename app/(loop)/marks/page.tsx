import { withReadTransaction } from "@/lib/with-transaction";
import { listRecentMarks } from "@/lib/marks";
import { DOMAINS } from "@/lib/domains";
import { SystemVoice } from "@/app/components/SystemVoice";
import { submitMark } from "./actions";

/**
 * Ordinary (non-retroactive) Mark recording, after the audit — the audit's
 * own wizard (app/audit/) only ever writes retroactive Marks. See
 * lib/marks.ts's header comment for how the two differ.
 *
 * Reads live DB state (the recent-Marks list) on every load — see
 * app/(loop)/page.tsx's comment on the same line for why a raw `pg` query
 * doesn't trip Next's static/dynamic analysis on its own.
 */
export const dynamic = "force-dynamic";

export default async function MarksPage() {
  const recent = await withReadTransaction((client) => listRecentMarks(client, 10));

  return (
    <main className="mx-auto max-w-md px-6 py-12 text-ink">
      <SystemVoice as="div" size="sm" className="text-ink-faint mb-8">
        Marks
      </SystemVoice>

      <form action={submitMark} className="space-y-4 border border-border p-4">
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
          <SystemVoice size="sm">What changed because of this?</SystemVoice>
          <textarea name="note" required rows={3} className="w-full rounded border border-border bg-surface p-3 font-sans text-ink" />
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Artifact (optional)</SystemVoice>
          <input type="text" name="artifact" className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
          Add Mark
        </button>
      </form>

      {recent.length > 0 && (
        <ul className="mt-8 space-y-2">
          {recent.map((mark) => (
            <li key={mark.id} className="border-b border-border py-2 font-sans text-ink">
              {typeof mark.payload.note === "string" ? mark.payload.note : ""}
              <span className="text-ink-faint text-sm">
                {" "}
                ({mark.domain}, {mark.logicalDay})
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
