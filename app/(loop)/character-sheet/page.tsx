import { withReadTransaction } from "@/lib/with-transaction";
import { computeIdentity } from "@/lib/identity";
import { listOutcomes } from "@/lib/quests";
import { SCORED_DOMAINS } from "@/lib/domains";
import { Panel } from "@/app/components/Panel";
import { GridCell } from "@/app/components/GridCell";
import { SystemVoice } from "@/app/components/SystemVoice";

// Reads live DB state on every load — see app/page.tsx's comment on this
// same line for why it has to be forced (a raw `pg` query doesn't trip
// Next's static/dynamic analysis on its own).
export const dynamic = "force-dynamic";

export default async function CharacterSheetPage() {
  const { identity, outcomes } = await withReadTransaction(async (client) => ({
    identity: await computeIdentity(client),
    outcomes: await listOutcomes(client),
  }));

  return (
    <main className="px-6 py-12">
      <Panel
        size="wide"
        header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Character Sheet</div>}
      >
        <div className="text-ink">
          <section className="mb-10">
            <SystemVoice as="div" size="lg" className="text-accent">
              Rank {identity.rank}
            </SystemVoice>
            <p className="text-ink-faint mt-1 text-xs">Tenure: {identity.tenureDays} day{identity.tenureDays === 1 ? "" : "s"}</p>
          </section>

          <section className="mb-10 space-y-3">
            <SystemVoice size="sm" className="text-ink-muted">
              Domains
            </SystemVoice>
            {SCORED_DOMAINS.map((domain) => (
              <div key={domain} className="flex items-center justify-between border-b border-border py-2">
                <span className="font-sans capitalize">{domain}</span>
                <SystemVoice size="sm">Level {identity.domainLevels[domain]}</SystemVoice>
              </div>
            ))}
          </section>

          <section className="mb-10">
            <SystemVoice size="sm" className="text-ink-muted">
              Marks
            </SystemVoice>
            <p className="font-sans mt-2">{identity.marksCount}</p>
          </section>

          <section>
            <SystemVoice size="sm" className="text-ink-muted mb-3 block">
              Outcomes
            </SystemVoice>
            {outcomes.length === 0 ? (
              <p className="text-ink-faint font-sans text-sm">None recorded yet.</p>
            ) : (
              // design-revision-v2.md §2: grid is for short, uniform items —
              // Outcomes are paragraph-length statements, so a 2-column grid
              // makes the varying text lengths read as ragged. Single
              // full-width column instead.
              <div className="space-y-4">
                {outcomes.map((outcome) => (
                  <GridCell key={outcome.id}>
                    <p className="font-sans text-ink">{outcome.statement}</p>
                  </GridCell>
                ))}
              </div>
            )}
          </section>

          <section className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6">
            <a href="/marks" className="ia-link font-mono text-xs uppercase tracking-wide2">
              Marks
            </a>
            <a href="/metrics" className="ia-link font-mono text-xs uppercase tracking-wide2">
              Metrics
            </a>
            <a href="/notes" className="ia-link font-mono text-xs uppercase tracking-wide2">
              Notes
            </a>
            <a href="/stances" className="ia-link font-mono text-xs uppercase tracking-wide2">
              Stances
            </a>
          </section>
        </div>
      </Panel>
    </main>
  );
}
