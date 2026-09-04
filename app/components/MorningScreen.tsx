import { Panel } from "./Panel";
import { SystemVoice } from "./SystemVoice";
import { ProbeResolutionCard } from "./ProbeResolutionCard";
import type { MorningScreenData } from "@/lib/loop";

/**
 * Morning (milestone-4-spec.md §5, PRD §12.1) — the emotional surface, full
 * visual investment. Rank, momentum state, season and day number, active
 * main quest, today's commitments. Nothing else. Rendered inside a System
 * panel (docs/design-revision-v1.md §7) — this screen gets the most
 * attention of anything in the product.
 *
 * The no-commitment day copy is specified verbatim (milestone-4-spec.md
 * §5) — rendered exactly, not paraphrased:
 *
 *   DAY 37 · SEASON 01
 *   No commitments today.
 *   MAIN QUEST — Build a stable, independent future
 *   Momentum: Strong
 *
 *   Nothing is required of you today.
 *
 * The with-commitments case has no PRD-given verbatim block, so it mirrors
 * that same line structure (commitment list in place of "No commitments
 * today.", no closing line since something *is* required) rather than
 * inventing an unrelated layout.
 */
export function MorningScreen({ data }: { data: MorningScreenData }) {
  const { identity, momentum, seasonNumber, dayNumber, mainQuest, todaysCommitments, probesAwaitingResolution } = data;
  const hasCommitments = todaysCommitments.length > 0;
  const dayLine =
    seasonNumber !== null && dayNumber !== null
      ? `DAY ${dayNumber} · SEASON ${String(seasonNumber).padStart(2, "0")}`
      : "BEFORE SEASON 01";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Panel
        ambient
        header={
          <div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">
            {dayLine}
          </div>
        }
      >
        <div className="space-y-3 text-center">
          <div className="text-accent font-mono text-[30px] uppercase tracking-[0.08em]">
            Rank <span className="rank-drift">{identity.rank}</span>
          </div>

          {hasCommitments ? (
            <ul className="space-y-1 py-2">
              {todaysCommitments.map((c) => (
                <li key={c.id} className="font-sans text-ink text-[15px]">
                  {c.label}
                </li>
              ))}
            </ul>
          ) : (
            <SystemVoice as="div" size="base" className="text-ink py-2">
              No commitments today.
            </SystemVoice>
          )}

          {mainQuest && (
            <SystemVoice as="div" size="base" className="text-ink-muted">
              Main Quest — <span className="font-sans normal-case tracking-normal text-ink">{mainQuest}</span>
            </SystemVoice>
          )}

          <SystemVoice as="div" size="base" className="text-ink-muted">
            Momentum: {momentum.state}
          </SystemVoice>

          {!hasCommitments && <p className="font-sans text-ink-muted mt-4 text-[14px]">Nothing is required of you today.</p>}
        </div>
      </Panel>

      {probesAwaitingResolution.length > 0 && (
        <div className="mt-6 w-full max-w-md space-y-4">
          {probesAwaitingResolution.map((probe) => (
            <ProbeResolutionCard key={probe.id} probe={probe} />
          ))}
        </div>
      )}
    </div>
  );
}
