import { withReadTransaction } from "@/lib/with-transaction";
import { getAuditProgress, isDomainSelfAssessmentComplete } from "@/lib/audit";
import { computeProposedStartingRank } from "@/lib/rank";
import { DOMAINS } from "@/lib/domains";
import { AUDIT_MIN_RETROACTIVE_MARKS } from "@/lib/calibration";
import { RANKS } from "@/lib/calibration";
import { BackLink } from "@/app/components/BackLink";
import { SystemVoice } from "@/app/components/SystemVoice";
import {
  continueFromMarks,
  continueFromMetrics,
  continueFromStances,
  submitCompleteAudit,
  submitDomainNotes,
  submitMetric,
  submitOpenSeason,
  submitOutcomes,
  submitRetroactiveMark,
  submitStance,
} from "./actions";

// Reads live DB state on every load (resumeStep, each step's progress
// query) — already implicitly dynamic via searchParams, but explicit so it
// doesn't silently regress if that read is ever refactored away. See
// app/page.tsx's comment for the general reason.
export const dynamic = "force-dynamic";

type Step = "domains" | "marks" | "metrics" | "stances" | "outcomes" | "season" | "rank";

const STEP_ORDER: Step[] = ["domains", "marks", "metrics", "stances", "outcomes", "season", "rank"];

async function resumeStep(): Promise<Step> {
  return withReadTransaction(async (client) => {
    const progress = await getAuditProgress(client);
    if (progress.completed) return "rank";
    if (!(await isDomainSelfAssessmentComplete(client))) return "domains";
    if (progress.retroactiveMarks.count < AUDIT_MIN_RETROACTIVE_MARKS) return "marks";
    if (progress.outcomesRecorded >= 3 && !progress.seasonOpened) return "season";
    if (progress.outcomesRecorded >= 3) return "rank";
    return "marks"; // stances/metrics/outcomes have no hard minimum beyond marks; land back where the user can move forward
  });
}

function StepNav({ current }: { current: Step }) {
  return (
    <>
      <BackLink href="/" label="Today" realNav />
      <SystemVoice as="div" size="sm" className="text-ink-faint mb-8">
        Step {STEP_ORDER.indexOf(current) + 1} of {STEP_ORDER.length} — Baseline Audit
      </SystemVoice>
    </>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const params = await searchParams;
  const step = (params.step as Step) ?? (await resumeStep());

  return (
    <main className="mx-auto max-w-xl px-6 py-12 text-ink">
      <StepNav current={step} />

      {step === "domains" && <DomainsStep />}
      {step === "marks" && <MarksStep />}
      {step === "metrics" && <MetricsStep />}
      {step === "stances" && <StancesStep />}
      {step === "outcomes" && <OutcomesStep />}
      {step === "season" && <SeasonStep />}
      {step === "rank" && <RankStep />}
    </main>
  );
}

function DomainsStep() {
  return (
    <form action={submitDomainNotes} className="space-y-6">
      <h1 className="font-sans text-xl">Where things stand</h1>
      <p className="text-ink-muted text-sm">A short note on each domain, as it stands today.</p>
      {DOMAINS.map((domain) => (
        <label key={domain} className="block space-y-2">
          <SystemVoice size="sm">{domain}</SystemVoice>
          <textarea
            name={`note-${domain}`}
            required
            rows={3}
            className="w-full rounded border border-border bg-surface p-3 font-sans text-ink"
          />
        </label>
      ))}
      <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
        Continue
      </button>
    </form>
  );
}

async function MarksStep() {
  const { marks } = await withReadTransaction(async (client) => {
    const progress = await getAuditProgress(client);
    return { marks: progress.retroactiveMarks };
  });
  const met = marks.count >= AUDIT_MIN_RETROACTIVE_MARKS;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sans text-xl">Retroactive Marks</h1>
        <p className="text-ink-muted text-sm">
          Past achievements. What changed because of this? At least {AUDIT_MIN_RETROACTIVE_MARKS} required — logged
          so far: {marks.count}.
        </p>
      </div>

      <form action={submitRetroactiveMark} className="space-y-4 border border-border p-4">
        <label className="block space-y-2">
          <SystemVoice size="sm">Domain</SystemVoice>
          <select name="domain" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink">
            <option value="career">Career</option>
            <option value="body">Body</option>
            <option value="attention">Attention</option>
          </select>
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">When it happened</SystemVoice>
          <input type="date" name="occurredAt" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">What changed because of this?</SystemVoice>
          <textarea name="note" required rows={2} className="w-full rounded border border-border bg-surface p-3 font-sans text-ink" />
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Artifact (optional)</SystemVoice>
          <input type="text" name="artifact" className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <button type="submit" className="border border-border px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-ink">
          Add Mark
        </button>
      </form>

      <form action={continueFromMarks}>
        <button
          type="submit"
          disabled={!met}
          className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent disabled:opacity-30"
        >
          Continue
        </button>
        {!met && (
          <p className="text-ink-faint mt-2 text-xs">
            {AUDIT_MIN_RETROACTIVE_MARKS - marks.count} more needed to continue.
          </p>
        )}
      </form>
    </div>
  );
}

async function MetricsStep() {
  const count = await withReadTransaction(async (client) => {
    const progress = await getAuditProgress(client);
    return progress.metricsRecorded;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sans text-xl">Body baseline</h1>
        <p className="text-ink-muted text-sm">Current values for whatever measurements matter to you. Logged so far: {count}.</p>
      </div>

      <form action={submitMetric} className="space-y-4 border border-border p-4">
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
        <button type="submit" className="border border-border px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-ink">
          Add Metric
        </button>
      </form>

      <form action={continueFromMetrics}>
        <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
          Continue
        </button>
      </form>
    </div>
  );
}

async function StancesStep() {
  const count = await withReadTransaction(async (client) => {
    const progress = await getAuditProgress(client);
    return progress.stancesNamed;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sans text-xl">Stances</h1>
        <p className="text-ink-muted text-sm">
          Behaviours you want a stance toward. Named so far: {count}. &ldquo;Not now&rdquo; means untracked, uncounted, never referenced again.
        </p>
      </div>

      <form action={submitStance} className="space-y-4 border border-border p-4">
        <label className="block space-y-2">
          <SystemVoice size="sm">Behaviour</SystemVoice>
          <input type="text" name="behaviour" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink" />
        </label>
        <label className="block space-y-2">
          <SystemVoice size="sm">Stance</SystemVoice>
          <select name="stance" required className="w-full rounded border border-border bg-surface p-2 font-sans text-ink">
            <option value="observing">Observing</option>
            <option value="reducing">Reducing</option>
            <option value="abstaining">Abstaining</option>
            <option value="not_now">Not now</option>
          </select>
        </label>
        <button type="submit" className="border border-border px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-ink">
          Add Stance
        </button>
      </form>

      <form action={continueFromStances}>
        <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
          Continue
        </button>
      </form>
    </div>
  );
}

function OutcomesStep() {
  return (
    <form action={submitOutcomes} className="space-y-6">
      <div>
        <h1 className="font-sans text-xl">The three statements</h1>
        <p className="text-ink-muted text-sm">Recorded verbatim, as top-level Outcomes.</p>
      </div>
      {[1, 2, 3].map((n) => (
        <label key={n} className="block space-y-2">
          <SystemVoice size="sm">Statement {n}</SystemVoice>
          <textarea name={`statement-${n}`} required rows={2} className="w-full rounded border border-border bg-surface p-3 font-sans text-ink" />
        </label>
      ))}
      <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
        Continue
      </button>
    </form>
  );
}

function SeasonStep() {
  return (
    <form action={submitOpenSeason} className="space-y-6">
      <div>
        <h1 className="font-sans text-xl">Season 01</h1>
        <p className="text-ink-muted text-sm">Opening the record.</p>
      </div>
      <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
        Open Season 01
      </button>
    </form>
  );
}

async function RankStep() {
  const proposal = await withReadTransaction((client) => computeProposedStartingRank(client));
  const eligibleRanks = RANKS.slice(0, RANKS.indexOf(proposal.rank) + 1);

  return (
    <form action={submitCompleteAudit} className="space-y-6">
      <div>
        <h1 className="font-sans text-xl">Starting rank</h1>
        <SystemVoice as="div" size="lg" className="text-accent mt-2">
          {proposal.rank}
        </SystemVoice>
        <p className="text-ink-muted mt-2 text-sm">{proposal.explanation}</p>
        <p className="text-ink-faint mt-2 text-xs">You may adjust this down. Never up.</p>
      </div>
      <label className="block space-y-2">
        <SystemVoice size="sm">Starting rank</SystemVoice>
        <select name="startingRank" defaultValue={proposal.rank} className="w-full rounded border border-border bg-surface p-2 font-sans text-ink">
          {eligibleRanks.map((rank) => (
            <option key={rank} value={rank}>
              {rank}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent">
        Complete Audit
      </button>
    </form>
  );
}
