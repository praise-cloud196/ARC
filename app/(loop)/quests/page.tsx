import { withReadTransaction } from "@/lib/with-transaction";
import { listUndertakings, listProbes, listOutcomes } from "@/lib/quests";
import { computeLogicalDay, getTimezone } from "@/lib/logical-day";
import { DOMAINS } from "@/lib/domains";
import { Panel } from "@/app/components/Panel";
import { Grid, GridCell, orphanSpanClass } from "@/app/components/GridCell";
import { SystemVoice } from "@/app/components/SystemVoice";
import { BackLink } from "@/app/components/BackLink";
import { ProbeResolutionCard } from "@/app/components/ProbeResolutionCard";
import {
  submitAbandonQuest,
  submitAchieveOutcome,
  submitCompleteUndertaking,
  submitProbe,
  submitUndertaking,
  submitUndertakingStep,
} from "./actions";

/**
 * milestone-5-spec.md §7: four sections per architecture-and-ux-v1.0.md
 * §4.4. Commitments already has its own route with its own weekly lock —
 * this page links out to it rather than rebuilding it. Reached from the
 * character sheet, like Marks/Metrics/Notes/Stances; not in the persistent
 * Nav (not a daily action).
 */
export const dynamic = "force-dynamic";

const TIER_OPTIONS = [
  { value: 1, label: "Tier 1 — routine, ≤30 min" },
  { value: 2, label: "Tier 2 — substantial, 30–90 min" },
  { value: 3, label: "Tier 3 — demanding, 90+ min" },
] as const;

export default async function QuestsPage() {
  const { undertakings, probes, outcomes } = await withReadTransaction(async (client) => {
    const today = computeLogicalDay(new Date(), getTimezone());
    return {
      undertakings: await listUndertakings(client),
      probes: await listProbes(client, today),
      outcomes: await listOutcomes(client),
    };
  });

  const activeUndertakings = undertakings.filter((u) => u.status === "active");
  const activeProbes = probes.filter((p) => p.status === "active");

  return (
    <main className="px-6 py-12">
      <Panel size="wide" header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Quests</div>}>
        <BackLink href="/character-sheet" label="← Character Sheet" />

        {/* Commitments */}
        <section className="mb-10">
          <SystemVoice size="sm" className="text-ink-muted mb-3 block">
            Commitments
          </SystemVoice>
          <p className="font-sans text-ink-faint text-sm">
            Declared and completed weekly.{" "}
            <a href="/commitments" className="ia-link">
              Go to Commitments →
            </a>
          </p>
        </section>

        {/* Undertakings */}
        <section className="mb-10">
          <SystemVoice size="sm" className="text-ink-muted mb-3 block">
            Undertakings
          </SystemVoice>

          <form action={submitUndertaking} className="mb-6 max-w-md space-y-3 border border-border p-4">
            <label className="block space-y-2">
              <SystemVoice size="sm">Statement</SystemVoice>
              <input
                type="text"
                name="statement"
                required
                className="ia w-full border border-border bg-surface p-2 font-sans text-ink"
              />
            </label>
            <button type="submit" className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
              Start Undertaking
            </button>
            {activeUndertakings.length >= 3 && (
              <p className="font-sans text-ink-faint text-xs">3 active already — complete or abandon one first.</p>
            )}
          </form>

          {undertakings.length === 0 ? (
            <p className="text-ink-faint font-sans text-sm">None yet.</p>
          ) : (
            <Grid>
              {undertakings.map((u, i) => (
                <GridCell key={u.id} className={orphanSpanClass(i, undertakings.length)}>
                  <p className="font-sans text-ink">{u.statement}</p>
                  <p className="text-ink-faint mt-1 font-mono text-xs">
                    {u.status} &middot; {u.stepCount} step{u.stepCount === 1 ? "" : "s"}
                  </p>

                  {u.status === "active" && (
                    <div className="mt-3 space-y-3">
                      <form action={submitUndertakingStep} className="flex items-end gap-2">
                        <input type="hidden" name="undertakingId" value={u.id} />
                        <select name="tier" required className="ia border border-border bg-surface p-1.5 font-sans text-ink text-xs">
                          {TIER_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="ia-link font-mono text-xs uppercase tracking-wide2">
                          Add step
                        </button>
                      </form>

                      <details>
                        <summary className="ia-link cursor-pointer font-mono text-xs uppercase tracking-wide2">Complete</summary>
                        <form action={submitCompleteUndertaking} className="mt-2 space-y-2">
                          <input type="hidden" name="undertakingId" value={u.id} />
                          <SystemVoice size="sm">Mark this? (optional)</SystemVoice>
                          <textarea
                            name="note"
                            rows={2}
                            placeholder="What changed because of this?"
                            className="ia w-full border border-border bg-surface p-2 font-sans text-ink text-sm"
                          />
                          <button type="submit" className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
                            Complete
                          </button>
                        </form>
                      </details>

                      <form action={submitAbandonQuest}>
                        <input type="hidden" name="questId" value={u.id} />
                        <button type="submit" className="ia-link font-mono text-xs uppercase tracking-wide2">
                          Abandon
                        </button>
                      </form>
                    </div>
                  )}
                </GridCell>
              ))}
            </Grid>
          )}
        </section>

        {/* Probes */}
        <section className="mb-10">
          <SystemVoice size="sm" className="text-ink-muted mb-3 block">
            Probes
          </SystemVoice>

          <form action={submitProbe} className="mb-6 max-w-md space-y-3 border border-border p-4">
            <label className="block space-y-2">
              <SystemVoice size="sm">Statement</SystemVoice>
              <input type="text" name="statement" required className="ia w-full border border-border bg-surface p-2 font-sans text-ink" />
            </label>
            <label className="block space-y-2">
              <SystemVoice size="sm">Decision date</SystemVoice>
              <input type="date" name="decisionDate" required className="ia w-full border border-border bg-surface p-2 font-sans text-ink" />
            </label>
            <label className="block space-y-2">
              <SystemVoice size="sm">Signal</SystemVoice>
              <input type="text" name="signal" required className="ia w-full border border-border bg-surface p-2 font-sans text-ink" />
            </label>
            <button type="submit" className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
              Start Probe
            </button>
            {activeProbes.length >= 2 && (
              <p className="font-sans text-ink-faint text-xs">2 active already — resolve one first.</p>
            )}
          </form>

          {probes.length === 0 ? (
            <p className="text-ink-faint font-sans text-sm">None yet.</p>
          ) : (
            <div className="space-y-4">
              {probes.map((p) =>
                p.needsResolution ? (
                  <ProbeResolutionCard key={p.id} probe={p} />
                ) : (
                  <GridCell key={p.id}>
                    <p className="font-sans text-ink">{p.statement}</p>
                    <p className="text-ink-faint mt-1 font-mono text-xs">
                      {p.status} &middot; decision {p.decisionDate} &middot; signal: {p.signal}
                    </p>
                  </GridCell>
                )
              )}
            </div>
          )}
        </section>

        {/* Outcomes */}
        <section>
          <SystemVoice size="sm" className="text-ink-muted mb-3 block">
            Outcomes
          </SystemVoice>
          {outcomes.length === 0 ? (
            <p className="text-ink-faint font-sans text-sm">None recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {outcomes.map((o) => (
                <GridCell key={o.id}>
                  <p className="font-sans text-ink">{o.statement}</p>
                  <p className="text-ink-faint mt-1 font-mono text-xs">{o.status}</p>

                  {o.status === "active" && (
                    <div className="mt-3 space-y-3">
                      <details>
                        <summary className="ia-link cursor-pointer font-mono text-xs uppercase tracking-wide2">Achieved</summary>
                        <form action={submitAchieveOutcome} className="mt-2 space-y-2">
                          <input type="hidden" name="outcomeId" value={o.id} />
                          <label className="block space-y-2">
                            <SystemVoice size="sm">Domain</SystemVoice>
                            <select name="domain" required className="ia w-full border border-border bg-surface p-2 font-sans text-ink">
                              {DOMAINS.map((domain) => (
                                <option key={domain} value={domain}>
                                  {domain}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block space-y-2">
                            <SystemVoice size="sm">What changed because of this?</SystemVoice>
                            <textarea name="note" required rows={2} className="ia w-full border border-border bg-surface p-2 font-sans text-ink text-sm" />
                          </label>
                          <button type="submit" className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent">
                            Confirm achieved
                          </button>
                        </form>
                      </details>

                      <form action={submitAbandonQuest}>
                        <input type="hidden" name="questId" value={o.id} />
                        <button type="submit" className="ia-link font-mono text-xs uppercase tracking-wide2">
                          Abandon
                        </button>
                      </form>
                    </div>
                  )}
                </GridCell>
              ))}
            </div>
          )}
        </section>
      </Panel>
    </main>
  );
}
