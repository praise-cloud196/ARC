import { withReadTransaction } from "@/lib/with-transaction";
import { listRecentMetrics } from "@/lib/metrics";
import { DOMAINS } from "@/lib/domains";
import { BackLink } from "@/app/components/BackLink";
import { SystemVoice } from "@/app/components/SystemVoice";
import { submitMetric, submitEditMetric, submitVoidMetric } from "./actions";

/**
 * Metric recording, after the audit — the audit's own wizard (app/audit/)
 * only ever writes the body baseline. This is the same write
 * (lib/metrics.ts's recordMetric), open to any domain.
 *
 * design-revision-v2.md §7.3: a metric is a record — Edit and Remove on
 * every listed one, Remove always a void. `withdrawn=1` is the "show
 * withdrawn" toggle; `edit=<id>` opens that row's inline edit form.
 *
 * Reads live DB state (the recent-metrics list) on every load — see
 * app/(loop)/page.tsx's comment on the same line for why a raw `pg` query
 * doesn't trip Next's static/dynamic analysis on its own.
 */
export const dynamic = "force-dynamic";

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ withdrawn?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const showWithdrawn = params.withdrawn === "1";
  const editingId = params.edit ?? null;

  const recent = await withReadTransaction((client) => listRecentMetrics(client, 10, showWithdrawn));

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
        <ul className="mt-8 space-y-3">
          {recent.map((m) =>
            editingId === m.id ? (
              <li key={m.id} className="border border-border p-3">
                <form action={submitEditMetric} className="space-y-3">
                  <input type="hidden" name="metricEventId" value={m.id} />
                  <label className="block space-y-2">
                    <SystemVoice size="sm">Domain</SystemVoice>
                    <p className="font-sans text-ink-faint text-sm">{m.domain}</p>
                  </label>
                  <label className="block space-y-2">
                    <SystemVoice size="sm">Metric</SystemVoice>
                    <input
                      type="text"
                      name="metric"
                      required
                      defaultValue={m.metric}
                      className="w-full rounded border border-border bg-surface p-2 font-sans text-ink"
                    />
                  </label>
                  <label className="block space-y-2">
                    <SystemVoice size="sm">Value</SystemVoice>
                    <input
                      type="number"
                      step="any"
                      name="value"
                      required
                      defaultValue={m.value}
                      className="w-full rounded border border-border bg-surface p-2 font-sans text-ink"
                    />
                  </label>
                  <label className="block space-y-2">
                    <SystemVoice size="sm">Unit</SystemVoice>
                    <input
                      type="text"
                      name="unit"
                      required
                      defaultValue={m.unit}
                      className="w-full rounded border border-border bg-surface p-2 font-sans text-ink"
                    />
                  </label>
                  <div className="flex gap-3">
                    <button type="submit" className="border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
                      Save
                    </button>
                    <a
                      href={showWithdrawn ? "/metrics?withdrawn=1" : "/metrics"}
                      className="text-ink-faint font-mono text-xs uppercase tracking-wide2"
                    >
                      Cancel
                    </a>
                  </div>
                </form>
              </li>
            ) : (
              <li key={m.id} className="border-b border-border py-2">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-sans text-ink">
                    {m.metric}: {m.value} {m.unit}
                    <span className="text-ink-faint text-sm">
                      {" "}
                      ({m.domain}
                      {m.voided ? ", withdrawn" : ""})
                    </span>
                  </p>
                  {!m.voided && (
                    <div className="flex shrink-0 gap-3">
                      <a
                        href={`/metrics?edit=${m.id}${showWithdrawn ? "&withdrawn=1" : ""}`}
                        className="text-ink-faint font-mono text-xs uppercase tracking-wide2"
                      >
                        Edit
                      </a>
                      <form action={submitVoidMetric}>
                        <input type="hidden" name="metricEventId" value={m.id} />
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
        href={showWithdrawn ? "/metrics" : "/metrics?withdrawn=1"}
        className="text-ink-faint mt-6 block font-mono text-xs uppercase tracking-wide2"
      >
        {showWithdrawn ? "Hide withdrawn" : "Show withdrawn"}
      </a>
    </main>
  );
}
