import { SystemVoice } from "./SystemVoice";
import type { MorningScreenData } from "@/lib/loop";

/**
 * Morning (milestone-4-spec.md §5, PRD §12.1) — the emotional surface, full
 * visual investment. Rank, momentum state, season and day number, active
 * main quest, today's commitments. Nothing else.
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
  const { identity, momentum, seasonNumber, dayNumber, mainQuest, todaysCommitments } = data;
  const hasCommitments = todaysCommitments.length > 0;
  const dayLine =
    seasonNumber !== null && dayNumber !== null
      ? `DAY ${dayNumber} · SEASON ${String(seasonNumber).padStart(2, "0")}`
      : "BEFORE SEASON 01";

  return (
    <div className="fade-in flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <SystemVoice as="div" size="lg" className="text-accent">
        Rank {identity.rank}
      </SystemVoice>

      <div className="mt-14 max-w-md space-y-3">
        <SystemVoice as="div" size="sm" className="text-ink-faint">
          {dayLine}
        </SystemVoice>

        {hasCommitments ? (
          <ul className="space-y-1 py-2">
            {todaysCommitments.map((c) => (
              <li key={c.id} className="font-sans text-ink text-lg">
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
      </div>

      {!hasCommitments && (
        <p className="font-sans text-ink-muted mt-10 text-base">Nothing is required of you today.</p>
      )}
    </div>
  );
}
