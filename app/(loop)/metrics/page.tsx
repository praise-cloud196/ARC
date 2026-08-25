import { withReadTransaction } from "@/lib/with-transaction";
import { listRecentMetrics } from "@/lib/metrics";
import { DOMAINS } from "@/lib/domains";
import { Panel } from "@/app/components/Panel";
import { Grid, GridCell, orphanSpanClass } from "@/app/components/GridCell";
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
 * §1/§2: sits in a Panel, the list is a grid of cells, not rows.
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
    <main className="px-6 py-12">
      <Panel size="wide" header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Metrics</div>}>
        <a href="/character-sheet" className="ia-link text-ink-faint mb-8 inline-block font-mono text-xs normal-case">
          ← Character Sheet
        </a>

        <form action={submitMetric} className="mx-auto mb-8 max-w-md space-y-4 border border-border p-4">
          <label className="block space-y-2">
            <SystemVoice size="sm">Domain</SystemVoice>
            <select name="domain" required defaultValue="" className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink">
              <option value="" disabled>
                Select a domain
              </option>
              {DOMAINS.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">Metric</SystemVoice>
            <input type="text" name="metric" required placeholder="e.g. weight" className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">Value</SystemVoice>
            <input type="number" step="any" name="value" required className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
          </label>
          <label className="block space-y-2">
            <SystemVoice size="sm">Unit</SystemVoice>
            <input type="text" name="unit" required placeholder="e.g. kg" className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
          </label>
          <button type="submit" className="ia border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
            Add Metric
          </button>
        </form>

        {recent.length > 0 && (
          <Grid>
            {recent.map((m, i) =>
              editingId === m.id ? (
                <GridCell key={m.id} className={orphanSpanClass(i, recent.length)}>
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
                        className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink"
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
                        className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink"
                      />
                    </label>
                    <label className="block space-y-2">
                      <SystemVoice size="sm">Unit</SystemVoice>
                      <input
                        type="text"
                        name="unit"
                        required
                        defaultValue={m.unit}
                        className="ia w-full rounded border border-border bg-surface p-2 font-sans text-ink"
                      />
                    </label>
                    <div className="flex gap-3">
                      <button type="submit" className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
                        Save
                      </button>
                      <a
                        href={showWithdrawn ? "/metrics?withdrawn=1" : "/metrics"}
                        className="ia-link font-mono text-xs uppercase tracking-wide2"
                      >
                        Cancel
                      </a>
                    </div>
                  </form>
                </GridCell>
              ) : (
                <GridCell key={m.id} className={orphanSpanClass(i, recent.length)}>
                  <p className="font-sans text-ink">
                    {m.metric}: {m.value} {m.unit}
                  </p>
                  <p className="text-ink-faint mt-1 font-mono text-xs">
                    {m.domain}
                    {m.voided ? ", withdrawn" : ""}
                  </p>
                  {!m.voided && (
                    <div className="mt-2 flex gap-3">
                      <a
                        href={`/metrics?edit=${m.id}${showWithdrawn ? "&withdrawn=1" : ""}`}
                        className="ia-link font-mono text-xs uppercase tracking-wide2"
                      >
                        Edit
                      </a>
                      <form action={submitVoidMetric}>
                        <input type="hidden" name="metricEventId" value={m.id} />
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
          href={showWithdrawn ? "/metrics" : "/metrics?withdrawn=1"}
          className="ia-link mt-6 block font-mono text-xs uppercase tracking-wide2"
        >
          {showWithdrawn ? "Hide withdrawn" : "Show withdrawn"}
        </a>
      </Panel>
    </main>
  );
}
