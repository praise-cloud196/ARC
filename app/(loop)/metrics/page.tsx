import { withReadTransaction } from "@/lib/with-transaction";
import { listRecentMetrics } from "@/lib/metrics";
import { DOMAINS } from "@/lib/domains";
import { BackLink } from "@/app/components/BackLink";
import { SystemVoice } from "@/app/components/SystemVoice";
import { submitMetric } from "./actions";

/**
 * Metric recording, after the audit — the audit's own wizard (app/audit/)
 * only ever writes the body baseline. This is the same write
 * (lib/metrics.ts's recordMetric), open to any domain.
 *
 * Reads live DB state (the recent-metrics list) on every load — see
 * app/(loop)/page.tsx's comment on the same line for why a raw `pg` query
 * doesn't trip Next's static/dynamic analysis on its own.
 */
export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const recent = await withReadTransaction((client) => listRecentMetrics(client, 10));

  return (
    <main className="mx-auto max-w-md px-6 py-12 text-ink">
      <BackLink href="/character-sheet" label="Character Sheet" />
      <SystemVoice as="div" size="sm" className="text-ink-faint mb-8">
        Metrics
      </SystemVoice>

      <form action={submitMetric} className="space-y-4 border border-border p-4">
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
          <SystemVoice size="sm">Metric</SystemVoice>
          <input type="text" name="metric" required placeholder="e.g. weight" className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Value</SystemVoice>
          <input type="number" step="any" name="value" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Unit</SystemVoice>
          <input type="text" name="unit" required placeholder="e.g. kg" className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
          Add Metric
        </button>
      </form>

      {recent.length > 0 && (
        <ul className="mt-8 space-y-2">
          {recent.map((m) => (
            <li key={m.id} className="border-b border-border py-2 font-sans text-ink">
              {m.metric}: {m.value} {m.unit}
              <span className="text-ink-faint text-sm"> ({m.domain})</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
