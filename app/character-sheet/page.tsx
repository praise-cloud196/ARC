import { withReadTransaction } from "@/lib/with-transaction";
import { computeIdentity } from "@/lib/identity";
import { listOutcomes } from "@/lib/quests";
import { SCORED_DOMAINS } from "@/lib/domains";
import { SystemVoice } from "@/app/components/SystemVoice";

export default async function CharacterSheetPage() {
  const { identity, outcomes } = await withReadTransaction(async (client) => ({
    identity: await computeIdentity(client),
    outcomes: await listOutcomes(client),
  }));

  return (
    <main className="mx-auto max-w-xl px-6 py-12 text-ink">
      <SystemVoice as="div" size="sm" className="text-ink-faint mb-8">
        Character Sheet
      </SystemVoice>

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
        <SystemVoice size="sm" className="text-ink-muted">
          Outcomes
        </SystemVoice>
        <ul className="mt-3 space-y-3">
          {outcomes.length === 0 && <li className="text-ink-faint font-sans text-sm">None recorded yet.</li>}
          {outcomes.map((outcome) => (
            <li key={outcome.id} className="font-sans text-ink border-l-2 border-accent-faint pl-3">
              {outcome.statement}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
